import React, { useEffect, useState, useCallback, useMemo, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getTemplateDetail, submitDocument, saveDraft, getDocumentDetail, updateDraft, updateDocument } from '../api/approvalApi';
import { Button, Alert, Box, CircularProgress, Paper, TextField, Typography, List, ListItem, ListItemText, TableContainer, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import SendIcon from '@mui/icons-material/Send';
import PeopleIcon from '@mui/icons-material/People';
import ApprovalLineModal from '../components/ApprovalLineModal';
import ApprovalTypeChip from '../components/ApprovalTypeChip';
import VacationForm from '../forms/VacationForm';
import DynamicApprovalTable from '../components/DynamicApprovalTable';
import BusinessTripForm from '../forms/BusinessTripForm';
import ExpenseForm from '../forms/ExpenseForm';
import { getJobGradeLabel } from '../../../utils/labelUtils';
import { useSnackbarContext } from '../../../components/utils/SnackbarContext';
import { UserProfileContext } from '../../../App';

// --- 헬퍼 함수들 ---
const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 휴가 기간 계산 로직
export const calculateDuration = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end - start;
  if (diffTime < 0) return 0;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
};

// 템플릿 키에 따라 적절한 폼 컴포넌트를 반환하는 헬퍼 컴포넌트
const DynamicFormRenderer = ({ templateKey, formData, onFormChange }) => {
  switch (templateKey) {
    case 'VACATION':
      return <VacationForm formData={formData} onFormChange={onFormChange} />;
    case 'BUSINESSTRIP':
      return <BusinessTripForm formData={formData} onFormChange={onFormChange} />;
    case 'EXPENSE':
      return <ExpenseForm formData={formData} onFormChange={onFormChange} />;
    default:
      // DB에 temp_key가 있지만 React 폼이 없는 경우
      if(templateKey) {
        return <Alert severity="warning">해당 양식에 대한 React 폼이 구현되지 않았습니다. (Template Key: {templateKey})</Alert>;
      }
      // temp_key 자체가 없는 경우 (데이터 로딩 중 등)
      return <Alert severity="info">양식을 불러오는 중입니다...</Alert>;
  }
};

// 템플릿 키에 따라 formData의 초기값을 설정하는 함수
const getInitialFormData = templateKey => {
  const commonData = { createDate: getTodayDate() };

  switch (templateKey) {
    case 'VACATION':
      return {
        ...commonData,
        vacationType: "",
        startDate: "",
        endDate: "",
        duration: 0,
        reason: "",
      };
    case 'BUSINESSTRIP':
      return {
        ...commonData,
        startDate: "",
        endDate: "",
        destination: "",
        transportation: "",
        purpose: "",
        note: "",
        travelerEmpNo: "",
        travelerName: "",
        travelerPosition: "",
        travelerDept: "",
      };
    case 'EXPENSE':
      return {
        ...commonData,
        purpose: "",
        items: [],
        totalAmount: 0,
      }
    
    default:
      // 템플릿 키가 'VACATION' 등이 아닐 경우 공통 데이터만 반환
      return commonData;
  }
};


function NewDocumentPage() {
  const navigate = useNavigate();
  const { templateId, documentId } = useParams();
  const isEditMode = !!documentId;  // 수정 모드인지 확인하는 플래그

  const { showSnack } = useSnackbarContext();

  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [files, setFiles] = useState([]);
  const [approvalLine, setApprovalLine] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const currentUser = useContext(UserProfileContext)?.userProfile;

  // formData의 초기값을 공통 값으로만 설정
  const [formData, setFormData] = useState({
    createDate: getTodayDate(),
  });

  // 하위 폼 컴포넌트(VacationForm 등)에서 호출할 핸들러
  const handleFormChange = useCallback((e) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      
      // 휴가 기간 계산 로직은 'VACATION' 폼에만 해당되므로
      // 'VACATION' 폼 내부에서 처리하거나, 여기서 templateKey를 확인해야 함
      if (selectedTemplate?.temp_key === 'VACATION' && (name === 'startDate' || name === 'endDate')) {
        newData.duration = calculateDuration(newData.startDate, newData.endDate);
      }

      // 지출 총 금액 계산 로직
      if (selectedTemplate?.temp_key === 'EXPENSE' && name === 'items') {
        const newTotal = value.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        newData.totalAmount = newTotal;
      }
      return newData;
    });
  }, [selectedTemplate]);


  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const fetchDocumentForEdit = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await getDocumentDetail(documentId);
        const doc = res.data;

        if (!doc.temp_key) {
          console.error("API 응답 오류:", doc);
          throw new Error("getDocumentDetail 응답에 'temp_key' 필드가 포함되어야 합니다.");
        }

        setDocumentTitle(doc.documentTitle);
        setApprovalLine(doc.approvalLines || []);

        setSelectedTemplate({
          templateId: doc.templateId,
          templateName: doc.templateName,
          temp_key: doc.temp_key,
          tempHtmlContent: doc.tempHtmlContent
        });

        const parsedData = JSON.parse(doc.documentContent || '{}');
        setFormData(parsedData);

      } catch (error) {
        console.error("Error fetching document detail for edit:", error);
        setError("임시저장 문서를 불러오는 데 실패했습니다: " + error.message);
      } finally {
        setLoading(false);
      }
    };

    const fetchTemplateForNew = async () => {
      try {
        setLoading(true);
        setError(null);
        setApprovalLine([]);
        const detailRes = await getTemplateDetail(templateId);
        console.log("detailResponse", detailRes)

        if(!detailRes.data.temp_key) {
          setError("API 응답에 'temp_key'가 포함되어 있지 않습니다.");
          return;
        }

        const templateData = {
          ...detailRes.data,
          templateId: detailRes.data.templateId || templateId
        };

        setSelectedTemplate(templateData);
        setDocumentTitle(detailRes.data.templateName || "");
        setFormData(getInitialFormData(detailRes.data.temp_key));

      } catch (error) {
        console.error("Error fetching template detail:", error);
        setError("선택된 양식 내용을 불러오는 데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    if (isEditMode) {
      fetchDocumentForEdit();
    } else if (templateId) {
      fetchTemplateForNew();
    } else {
      setError("잘못된 접근입니다. (ID 없음)");
      setLoading(false);
    }

  }, [documentId, templateId, isEditMode]);

  const handleFileChange = e => {
    setFiles(Array.from(e.target.files));
  };

  const handleModalSubmit = selectedLineFromModal => {
    const remappedLine = selectedLineFromModal.map(line => ({
      ...line,
      approvalType: line.type
    }));
    setApprovalLine(remappedLine);
  };

  const handleSubmit = async isDraft => {
    if (!selectedTemplate) {
      showSnack("템플릿 정보가 로드되지 않았습니다.", "error");
      return;
    }

    // ... (기존 제목 체크 코드) ...
    if (!documentTitle.trim()) {
      showSnack("문서 제목을 입력해주세요.", "warning");
      return;
    }

    // ============================================================
    // [추가할 코드] 휴가 신청서일 경우 날짜 필수 입력 체크 (백엔드 에러 방지용)
    // ============================================================
    if (selectedTemplate.temp_key === 'VACATION' && !isDraft) {
        // 1. 날짜가 비어있는지 확인
        if (!formData.startDate || !formData.endDate) {
            showSnack("휴가 시작일과 종료일을 모두 선택해주세요.", "warning");
            return; 
        }
        
        // 2. 휴가 종류가 비어있는지 확인
        if (!formData.vacationType) {
            showSnack("휴가 종류를 선택해주세요.", "warning");
            return;
        }

        // (선택사항) 날짜 형식이 yyyy-MM-dd 인지 확실히 하기 위해 로그 확인 가능
        // console.log("전송할 날짜:", formData.startDate, formData.endDate);
    }
  
    if (!isDraft) {
      const hasApprover = approvalLine.some(line =>
        (line.type || line.approvalType) === 'APPROVE'
      );
      if (!hasApprover) {
        showSnack("최소 1명의 결재자를 지정해야 합니다.", "warning");
        setModalOpen(true);
        return;
      }
    }
  
    const documentDataJson = JSON.stringify(formData);
    const formattedApprovalLines = approvalLine.map(line => ({
      userId: line.userId,
      type: line.type || line.approvalType,
    }));
  
    const formDataToSend = new FormData();
    files.forEach(file => {
      formDataToSend.append("files", file);
    });

    setLoading(true);
    try {
      let res;

      if (isEditMode) {
        const requestDTO = {
          templateId: parseInt(selectedTemplate.templateId),
          documentTitle: documentTitle,
          documentDataJson: documentDataJson,
          approvalLines: formattedApprovalLines
        };
        formDataToSend.append("dto", new Blob([JSON.stringify(requestDTO)], { type: "application/json" }));

        if (isDraft) {
          res = await updateDraft(documentId, formDataToSend);
          showSnack(`문서가 수정되어 임시저장되었습니다.`, "success");
        } else {
          res = await updateDocument(documentId, formDataToSend);
          showSnack(`문서가 수정되어 상신되었습니다.`, "success");
        }
        navigate(`/e-approval/doc/${documentId}`);
      } else {
        if (!selectedTemplate.templateId) {
          console.error("selectedTemplate에 templateId가 없습니다.", selectedTemplate);
          throw new Error("템플릿 ID를 찾을 수 없습니다.");
        }
        const requestDTO = {
          templateId: parseInt(selectedTemplate.templateId),
          documentTitle: documentTitle,
          documentDataJson: documentDataJson,
          approvalLines: formattedApprovalLines
        };
        formDataToSend.append("dto", new Blob([JSON.stringify(requestDTO)], { type: "application/json" }));

        if (isDraft) {
          res = await saveDraft(formDataToSend);
          showSnack(`문서가 임시저장되었습니다.`, "success");
        } else {
          res = await submitDocument(formDataToSend);
          showSnack(`문서가 성공적으로 상신되었습니다.`, "success");
        }

        if (res && res.data) {
          navigate(`/e-approval/doc/${res.data}`);
        } else {
          navigate("/e-approval");
        }
      }

    } catch (error) {
      console.error("문서 처리 실패:", error);
      const errorMsg = error.response?.data?.message || `문서 ${isDraft ? '저장' : '상신'}에 실패했습니다.`;
      showSnack(errorMsg, "error");
    } finally {
      setLoading(false);
    }

  };


  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}><CircularProgress /></Box>;
  if (error) return (
    <Box sx={{ mt: 4 }}>
      <Alert severity='error'>{error}</Alert>
      <Button variant='outlined' sx={{ mt: 2 }} onClick={() => navigate(-1)}>뒤로 가기</Button>
    </Box>
  )
  if (!selectedTemplate) return <Alert severity='warning'>선택된 양식 정보를 찾을 수 없습니다.</Alert>;

  return (
    <Box>
      {error && (
        <Alert
          severity='error'
          onClose={() => setError(null)}
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      )}

      <Typography variant='h5' gutterBottom sx={{ fontWeight: "bold" }}>
        {isEditMode ? "결재 문서 수정" : "새 결재 문서 작성"}
      </Typography>
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          label="문서 제목"
          value={documentTitle}
          onChange={e => setDocumentTitle(e.target.value)}
          required
        />
      </Paper>

      <Paper elevation={3} sx={{ p: 4 }}>
        {/* --- 문서 양식 영역 레이아웃 --- */}
        {/* 공통 스타일 div */}
        <div style={{ width: '750px', margin: '0 auto', padding: '30px', border: '1px solid #ddd', fontFamily: "'Malgun Gothic', sans-serif" }}>
          
          {/* 1. 제목 (공통) */}
          <h1 style={{ fontSize: '32px', margin: '0', textAlign: 'center', paddingBottom: '10px', marginBottom: '20px', borderBottom: '2px solid #333' }}>
            {selectedTemplate.templateName}
          </h1>

          {/* 2. 기안자 정보 (좌) / 결재란 (우) Flex 컨테이너 (공통) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            
            {/* 2-1. 기안자 정보 테이블 (좌측) - (공통) */}
            <div style={{ width: '55%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <TableBody>
                  <tr>
                    <td style={{ border: '1px solid #ccc', backgroundColor: '#f8f8f8', padding: '10px', width: '100px', textAlign: 'center', fontWeight: 'bold' }}>기안자</td>
                    <td style={{ border: '1px solid #ccc', padding: '10px' }}>{currentUser?.name}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #ccc', backgroundColor: '#f8f8f8', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>소속</td>
                    <td style={{ border: '1px solid #ccc', padding: '10px' }}>{currentUser?.deptName}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #ccc', backgroundColor: '#f8f8f8', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>기안일</td>
                    <td style={{ border: '1px solid #ccc', padding: '10px' }}>{formData.createDate}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #ccc', backgroundColor: '#f8f8f8', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>문서번호</td>
                    <td style={{ border: '1px solid #ccc', padding: '10px', color: '#999' }}>
                      {isEditMode ? documentId : '(자동채번)'}
                    </td>
                  </tr>
                </TableBody>
              </table>
            </div>
            
            {/* 2-2. 결재란 (우측) - (공통) */}
            <div style={{ width: 'auto' }}>
              <DynamicApprovalTable approvers={approvalLine} drafter={currentUser} />
            </div>
          </div>

          {/* 3. 신청 내용 (하단) 
            하드코딩된 폼 대신 DynamicFormRenderer 컴포넌트를 사용
          */}
          <DynamicFormRenderer
            templateKey={selectedTemplate.temp_key}
            formData={formData}
            onFormChange={handleFormChange}
          />

        </div>
        {/* --- 문서 양식 영역 끝 --- */}

        {/* 하단 결재선/파일첨부/버튼 영역 (공통) */}
        <Box sx={{ mt: 3, p: 2, border: '1px dashed #ccc', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant='h6' sx={{ fontWeight: 'bold' }}>결재선</Typography>
            <Button variant='outlined' startIcon={<PeopleIcon />} onClick={() => setModalOpen(true)}>결재선 지정</Button>
          </Box>
          {approvalLine.length === 0 ? (
            <Typography variant='body2' color='text.secondary'>'결재선 지정' 버튼을 눌러 결재자를 선택하세요.</Typography>
          ) : (
            <List dense>
              {approvalLine.map((line, index) => (
                <ListItem key={line.lineId} disablePadding>
                  <ApprovalTypeChip type={line.type || line.approvalType} size="small" sx={{ mr: 1.5, minWidth: '50px' }} />
                  <ListItemText primary={`${index + 1}. ${line.name} (${getJobGradeLabel(line.positionName)})`} secondary={line.deptName} />
                </ListItem>
              ))}
            </List>
          )}
        </Box>

        <Box sx={{ mt: 3, borderTop: '1px solid #eee', pt: 2 }}>
          <Typography variant='body1' sx={{ mb: 1, fontWeight: 'bold' }}>파일 첨부</Typography>
          <input type='file' multiple onChange={handleFileChange} />
          {files.length > 0 && <Typography variant='caption' sx={{ display: 'block', mt: 1 }}>{files.length}개 파일 첨부됨</Typography>}
        </Box>

        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button variant="outlined" startIcon={<SaveIcon />} onClick={() => handleSubmit(true)} disabled={loading}>임시 저장</Button>
          <Button variant="contained" color="primary" startIcon={<SendIcon />} onClick={() => handleSubmit(false)} disabled={loading || !documentTitle.trim() || approvalLine.length === 0}>결재 상신</Button>
        </Box>
      </Paper>

      <ApprovalLineModal open={modalOpen} handleClose={() => setModalOpen(false)} currentLine={approvalLine} handleSubmitLine={handleModalSubmit} />
    </Box>
  );
}

export default NewDocumentPage;