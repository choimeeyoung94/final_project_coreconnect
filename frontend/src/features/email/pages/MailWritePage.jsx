import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Input,
  Chip,
  Autocomplete,
  Divider,
  Stack,
  Tooltip
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import CancelIcon from "@mui/icons-material/Cancel";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import dayjs from "dayjs";
import {
  sendMail,
  saveDraftMail,
  getDraftDetail,
} from "../api/emailApi";
import { useLocation, useNavigate } from "react-router-dom";
import { useContext } from "react";
import { UserProfileContext } from "../../../App";
import { useSnackbarContext } from "../../../components/utils/SnackbarContext";
import AddressBookDialog from "../components/AddressBookDialog";
import ConfirmDialog from "../../../components/utils/ConfirmDialog";


const emailSuggestions = [
  "admin@gmail.com",
  "ehddnras@gmail.com",
  "lyc@gmail.com",
  "shark@gmail.com",
  "choimeeyoung2@gmail.com",
  "sss@naver.com"
];

function MailWritePage() {
  const { showSnack } = useSnackbarContext();
  const [form, setForm] = useState({
    emailId: null,
    recipientAddress: [],
    ccAddresses: [],
    bccAddresses: [],
    emailTitle: "",
    emailContent: "",
    attachments: [], // elements: { name, file } for new files OR { name, fileId } for existing draft files
    replyToEmailId: null // 답장할 원본 메일 ID
  });
  const [reservedAt, setReservedAt] = useState(null); // 예약발송 시각 (dayjs)
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  
  // Autocomplete의 현재 입력값 추적 (엔터를 치지 않아도 인식하기 위함)
  const [recipientInputValue, setRecipientInputValue] = useState("");
  const [ccInputValue, setCcInputValue] = useState("");
  const [bccInputValue, setBccInputValue] = useState("");
  
  // 주소록 팝업 상태
  const [addressBookOpen, setAddressBookOpen] = useState(false);
  const [addressBookType, setAddressBookType] = useState(null); // "recipient", "cc", "bcc"
  
  // 취소 확인 다이얼로그 상태
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);


  const location = useLocation();
  const navigate = useNavigate();
  const draftId = new URLSearchParams(location.search).get("draftId");
  const replyData = location.state?.replyData; // 답장 모드 데이터
  const forwardData = location.state?.forwardData; // 전달 모드 데이터
  const { userProfile } = useContext(UserProfileContext) || {};
  const userEmail = userProfile?.email;

  // 조직도 → 메일쓰기 자동 입력 mailTo 값 받기
  const mailTo = location.state?.mailTo || null;
  useEffect(() => {
    if (mailTo) {
      setForm(f => ({
        ...f,
        recipientAddress: [mailTo]
      }));
    }
  }, [mailTo]);

  // 답장/전달 모드일 때 원본 메일 정보 포맷팅 함수
  const formatOriginalEmailInfo = (originalEmail, mode = 'reply') => {
    const formatDate = (date) => {
      if (!date) return '-';
      try {
        const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
        return d.toLocaleString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch {
        return '-';
      }
    };

    let info = `\n\n`;
    info += `────────────────────────────────────────\n`;
    info += `발신자: ${originalEmail.senderName || originalEmail.senderEmail || '-'} <${originalEmail.senderEmail || '-'}>\n`;
    info += `제목: ${originalEmail.emailTitle || '-'}\n`;
    info += `일자: ${formatDate(originalEmail.sentTime)}\n`;
    
    if (originalEmail.recipientAddresses && originalEmail.recipientAddresses.length > 0) {
      info += `받는사람: ${originalEmail.recipientAddresses.join(', ')}\n`;
    }
    
    if (originalEmail.ccAddresses && originalEmail.ccAddresses.length > 0) {
      info += `참조: ${originalEmail.ccAddresses.join(', ')}\n`;
    }
    
    if (originalEmail.bccAddresses && originalEmail.bccAddresses.length > 0) {
      info += `숨은 참조: ${originalEmail.bccAddresses.join(', ')}\n`;
    }
    
    info += `────────────────────────────────────────\n`;
    
    if (originalEmail.emailContent) {
      info += `\n${originalEmail.emailContent}\n`;
    }
    
    if (mode === 'forward') {
      info += `\n전달 메시지를 입력하세요\n`;
    } else {
      info += `\n답장을 입력하세요\n`;
    }
    
    return info;
  };

  // 답장 모드 초기화
  useEffect(() => {
    if (replyData && replyData.originalEmail && userEmail) {
      const original = replyData.originalEmail;
      
      // 제목에 "Re: " 추가 (이미 있으면 추가하지 않음)
      let replyTitle = original.emailTitle || '';
      if (replyTitle && !replyTitle.startsWith('Re: ') && !replyTitle.startsWith('RE: ')) {
        replyTitle = `Re: ${replyTitle}`;
      }
      
      // 받는 사람: 원본 메일의 발신자
      const recipientAddress = original.senderEmail ? [original.senderEmail] : [];
      
      // 참조: 원본 메일의 참조 (본인 제외)
      const ccAddresses = (original.ccAddresses || []).filter(addr => 
        addr && addr.trim() && addr.toLowerCase() !== userEmail.toLowerCase()
      );
      
      // 숨은 참조: 원본 메일의 숨은 참조 (본인 제외)
      const bccAddresses = (original.bccAddresses || []).filter(addr => 
        addr && addr.trim() && addr.toLowerCase() !== userEmail.toLowerCase()
      );
      
      // 원본 메일의 받는 사람 중 본인을 제외한 나머지를 참조에 추가
      const otherRecipients = (original.recipientAddresses || []).filter(addr => 
        addr && addr.trim() && 
        addr.toLowerCase() !== userEmail.toLowerCase() &&
        addr.toLowerCase() !== original.senderEmail?.toLowerCase()
      );
      otherRecipients.forEach(addr => {
        if (!ccAddresses.includes(addr)) {
          ccAddresses.push(addr);
        }
      });
      
      // 메일 내용: 원본 메일 정보 + 답장 입력 안내
      const replyContent = formatOriginalEmailInfo(original, 'reply');
      
      setForm({
        emailId: null,
        recipientAddress: recipientAddress,
        ccAddresses: ccAddresses,
        bccAddresses: bccAddresses,
        emailTitle: replyTitle,
        emailContent: replyContent,
        attachments: [],
        replyToEmailId: original.emailId // 원본 메일 ID 저장
      });
      
      // location.state 초기화 (뒤로가기 시 중복 적용 방지)
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [replyData, userEmail, navigate, location.pathname]);

  // 전달 모드 초기화
  useEffect(() => {
    if (forwardData && forwardData.originalEmail && userEmail) {
      const original = forwardData.originalEmail;
      
      // 제목에 "Fw: " 추가 (이미 있으면 추가하지 않음)
      let forwardTitle = original.emailTitle || '';
      if (forwardTitle && !forwardTitle.startsWith('Fw: ') && !forwardTitle.startsWith('Fwd: ') && 
          !forwardTitle.startsWith('FW: ') && !forwardTitle.startsWith('FWD: ')) {
        forwardTitle = `Fw: ${forwardTitle}`;
      }
      
      // 받는 사람: 비워둠 (사용자가 직접 입력)
      const recipientAddress = [];
      
      // 참조: 비워둠 (사용자가 선택적으로 추가)
      const ccAddresses = [];
      
      // 숨은 참조: 비워둠 (사용자가 선택적으로 추가)
      const bccAddresses = [];
      
      // 메일 내용: 원본 메일 정보 + 전달 입력 안내
      const forwardContent = formatOriginalEmailInfo(original, 'forward');
      
      setForm({
        emailId: null,
        recipientAddress: recipientAddress,
        ccAddresses: ccAddresses,
        bccAddresses: bccAddresses,
        emailTitle: forwardTitle,
        emailContent: forwardContent,
        attachments: [],
        replyToEmailId: null // 전달은 replyToEmailId 없음
      });
      
      // location.state 초기화 (뒤로가기 시 중복 적용 방지)
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [forwardData, userEmail, navigate, location.pathname]);

  // 임시보관함 불러오기
  useEffect(() => {
    if (draftId && userEmail && !replyData && !forwardData) {
      console.log("[MailWritePage] 임시저장 메일 불러오기 - draftId:", draftId);
      getDraftDetail(draftId, userEmail).then(res => {
        const data = res.data.data;
        console.log("[MailWritePage] 임시저장 메일 데이터:", data, "emailId:", data.emailId);
        setForm({
          emailId: data.emailId, // ★ 중요: emailId를 설정하여 다음 임시저장 시 업데이트되도록 함
          recipientAddress: data.recipientAddresses || [],
          ccAddresses: data.ccAddresses || [],
          bccAddresses: data.bccAddresses || [],
          emailTitle: data.emailTitle || "",
          emailContent: data.emailContent || "",
          // Draft attachments might come as objects with fileId/fileName — preserve for display
          attachments: (data.attachments || []).map(f => ({
            name: f.fileName || f.fileName,
            fileId: f.fileId || null
          }))
        });
        // 예약 메일이면 예약시간 값도 추출 (백엔드 연동 시 reservedAt 필드를 사용)
        if (data.reservedAt) {
          setReservedAt(dayjs(data.reservedAt));
        }
      }).catch(err => {
        console.warn("getDraftDetail error:", err);
      });
    }
  }, [draftId, userEmail, replyData, forwardData]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    setForm((f) => ({
      ...f,
      attachments: [
        ...f.attachments,
        ...files.map(file => ({ name: file.name, file }))
      ]
    }));
    // reset input value to allow same file re-add if needed
    e.target.value = null;
  };

  const handleRemoveAttachment = (idx) => {
    setForm(f => ({
      ...f,
      attachments: f.attachments.filter((_, i) => i !== idx)
    }));
  };

  const handleFieldChange = (field, value) => {
    setForm(f => ({
      ...f,
      [field]: value
    }));
  };

  const buildSendFormData = (payload) => {
    // payload is plain object with fields that match backend DTO:
    // recipientAddress, ccAddresses, bccAddresses, emailTitle, emailContent, emailId(optional), reservedAt(optional), existingAttachmentIds, emailType, replyToEmailId
    const fd = new FormData();
    // Attach JSON payload as 'data' part (server expects 'data' part as JSON)
    fd.append('data', new Blob([JSON.stringify(payload)], { type: 'application/json' }));

    // Append files that are File objects
    form.attachments.forEach((att) => {
      if (att.file && att.file instanceof File) {
        fd.append('attachments', att.file, att.name);
      }
      // If attachment has fileId (already uploaded/draft attachment), include its id in JSON payload (handled in payload)
    });

    return fd;
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      if (!form.emailTitle) {
        showSnack("임시저장하려면 제목은 입력해야 합니다.", "warning");
        setSavingDraft(false);
        return;
      }

      // build draft DTO — include existing attachment fileIds but do not re-upload files
      // ★ 중요: emailId가 있으면 반드시 전달하여 기존 메일이 업데이트되도록 함
      const currentEmailId = form.emailId; // 현재 폼의 emailId
      console.log("[MailWritePage] handleSaveDraft - form.emailId:", currentEmailId, 
                  "userEmail:", userEmail, "draftId:", draftId);
      
      // draftId가 있으면 emailId로 사용 (임시저장 메일을 불러온 경우)
      // ★ 중요: emailId가 0이거나 유효하지 않으면 null로 처리
      let emailIdToSend = currentEmailId || (draftId ? parseInt(draftId) : null);
      if (emailIdToSend !== null && (isNaN(emailIdToSend) || emailIdToSend <= 0)) {
        emailIdToSend = null; // 유효하지 않은 emailId는 null로 처리
      }
      console.log("[MailWritePage] handleSaveDraft - emailIdToSend:", emailIdToSend, 
                  "(currentEmailId:", currentEmailId, ", draftId:", draftId, ")");
      
      if (!emailIdToSend) {
        console.log("[MailWritePage] handleSaveDraft - 새 임시저장 메일 생성 (emailId 없음)");
      } else {
        console.log("[MailWritePage] handleSaveDraft - 기존 임시저장 메일 업데이트 (emailId:", emailIdToSend, ")");
      }
      
      const draftData = {
        emailId: emailIdToSend, // ★ 중요: null이면 새로 생성, 있으면 업데이트 (0이나 유효하지 않은 값은 null)
        recipientAddress: form.recipientAddress,
        ccAddresses: form.ccAddresses,
        bccAddresses: form.bccAddresses,
        emailTitle: form.emailTitle,
        emailContent: form.emailContent,
        emailFolder: "DRAFT",
        reservedAt: reservedAt ? reservedAt.format("YYYY-MM-DDTHH:mm:ss") : null,
        // collect fileIds of existing attachments (if any)
        existingAttachmentIds: form.attachments
          .filter(a => a.fileId)
          .map(a => a.fileId)
      };
      console.log("[MailWritePage] handleSaveDraft - draftData:", JSON.stringify(draftData, null, 2));
      console.log("[MailWritePage] handleSaveDraft - draftData.emailId:", draftData.emailId, "type:", typeof draftData.emailId);

      // ★ 중요: 항상 FormData를 사용하여 multipart/form-data로 전송
      // 백엔드가 multipart/form-data만 받으므로, 파일이 없어도 FormData를 사용해야 함
      const fd = new FormData();
      fd.append('data', new Blob([JSON.stringify(draftData)], { type: 'application/json' }));
      
      // 새 파일이 있으면 첨부
      const newFiles = form.attachments.filter(a => a.file && a.file instanceof File);
      if (newFiles.length > 0) {
        newFiles.forEach(f => fd.append('attachments', f.file, f.name));
        console.log("[MailWritePage] handleSaveDraft - 새 파일 첨부:", newFiles.length, "개");
      }
      
      // FormData 내용 확인 (디버깅용)
      console.log("[MailWritePage] handleSaveDraft - FormData 생성 완료, emailId 포함 여부 확인");
      const dataBlob = new Blob([JSON.stringify(draftData)], { type: 'application/json' });
      dataBlob.text().then(text => {
        console.log("[MailWritePage] handleSaveDraft - FormData 'data' part 내용:", text);
        const parsed = JSON.parse(text);
        console.log("[MailWritePage] handleSaveDraft - 파싱된 emailId:", parsed.emailId);
      });
      
      const savedDraftResponse = await saveDraftMail(fd);

      // 응답에서 emailId를 가져와서 유지 (다음 임시저장 시 업데이트를 위해)
      const savedEmailId = savedDraftResponse?.data?.data?.emailId;
      const wasUpdate = emailIdToSend != null; // 전송한 emailId가 있었는지 확인
      console.log("[MailWritePage] 임시저장 완료 - savedEmailId:", savedEmailId, 
                  "전송한 emailId:", emailIdToSend, "wasUpdate:", wasUpdate);

      if (!savedEmailId) {
        console.error("[MailWritePage] ⚠️ 임시저장 응답에 emailId가 없습니다!");
        showSnack("임시저장은 완료되었지만 응답에 메일 ID가 없습니다.", "warning");
      }

      // 성공 메시지 (생성/업데이트 구분)
      showSnack(
        wasUpdate ? "임시저장 메일이 업데이트되었습니다!" : "임시저장되었습니다!", 
        "success"
      );

      // ★ 중요: emailId를 반드시 유지하여 다음 임시저장 시 같은 메일이 업데이트되도록 함
      // 폼을 완전히 초기화하지 않고 emailId만 업데이트
      if (savedEmailId) {
        setForm(f => {
          const updated = {
            ...f,
            emailId: savedEmailId // ★ 중요: emailId를 유지하여 다음 임시저장 시 같은 메일이 업데이트되도록 함
          };
          console.log("[MailWritePage] emailId 유지 - 이전:", f.emailId, "→ 이후:", savedEmailId);
          return updated;
        });
      } else {
        console.warn("[MailWritePage] ⚠️ savedEmailId가 없어서 emailId를 유지할 수 없습니다.");
        // emailId가 없어도 폼은 유지 (사용자가 계속 편집할 수 있도록)
      }

      // 임시저장 성공 후 임시보관함 목록 페이지로 이동
      navigate("/email/draftbox");
    } catch (e) {
      console.error("[MailWritePage] saveDraft error:", e);
      console.error("[MailWritePage] error response:", e?.response);
      const errorMessage = e?.response?.data?.message || e?.response?.data?.data || e.message || "임시저장 실패";
      showSnack("임시저장 실패: " + errorMessage, "error");
      
      // 예외 발생 시에도 emailId는 유지 (사용자가 다시 시도할 수 있도록)
      if (form.emailId) {
        console.log("[MailWritePage] 예외 발생했지만 emailId 유지:", form.emailId);
      }
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      // recipientAddress 배열에서 빈 문자열이나 공백만 있는 항목을 제거하고 유효한 이메일만 필터링
      let validRecipients = (form.recipientAddress || [])
        .map(addr => typeof addr === 'string' ? addr.trim() : addr)
        .filter(addr => addr && addr.length > 0);
      
      // 엔터를 치지 않고 입력만 한 경우, 현재 입력값을 추가
      const trimmedRecipientInput = recipientInputValue?.trim();
      if (trimmedRecipientInput && trimmedRecipientInput.length > 0 && !validRecipients.includes(trimmedRecipientInput)) {
        validRecipients = [...validRecipients, trimmedRecipientInput];
      }
      
      if (!validRecipients.length) {
        showSnack("받는사람(수신자)을 입력해주세요.", "warning");
        setSending(false);
        return;
      }
      if (!form.emailTitle) {
        showSnack("제목을 입력해주세요.", "warning");
        setSending(false);
        return;
      }
      if (!form.emailContent) {
        showSnack("본문을 입력해주세요.", "warning");
        setSending(false);
        return;
      }

      // IMPORTANT:
      // Build payload keys to exactly match backend EmailSendRequestDTO property names.
      const payload = {
        emailId: form.emailId,
        recipientAddress: validRecipients,                 // backend expects recipientAddress (array) - use filtered valid recipients
        ccAddresses: (() => {
          let validCc = (form.ccAddresses || [])
            .map(addr => typeof addr === 'string' ? addr.trim() : addr)
            .filter(addr => addr && addr.length > 0);
          const trimmedCcInput = ccInputValue?.trim();
          if (trimmedCcInput && trimmedCcInput.length > 0 && !validCc.includes(trimmedCcInput)) {
            validCc = [...validCc, trimmedCcInput];
          }
          return validCc;
        })(),  // ccAddresses (array) - filter empty and include current input
        bccAddresses: (() => {
          let validBcc = (form.bccAddresses || [])
            .map(addr => typeof addr === 'string' ? addr.trim() : addr)
            .filter(addr => addr && addr.length > 0);
          const trimmedBccInput = bccInputValue?.trim();
          if (trimmedBccInput && trimmedBccInput.length > 0 && !validBcc.includes(trimmedBccInput)) {
            validBcc = [...validBcc, trimmedBccInput];
          }
          return validBcc;
        })(),  // bccAddresses (array) - filter empty and include current input
        emailTitle: form.emailTitle,                       // emailTitle (string)
        emailContent: form.emailContent,                   // emailContent (string) <-- NOT NULL in DB
        emailType: form.emailType || null,
        replyToEmailId: form.replyToEmailId || null,
        existingAttachmentIds: form.attachments
                                 .filter(a => a.fileId)
                                 .map(a => a.fileId),
        reservedAt: reservedAt ? reservedAt.format("YYYY-MM-DDTHH:mm:ss") : null
      };

      // Log payload for debug (dev only)
      console.debug("[MailWritePage] send payload:", payload);

      const fd = buildSendFormData(payload);

      // Debug FormData entries (overview)
      const debugEntries = [...fd.entries()].map(([k, v]) => {
        if (v instanceof File) return [k, `File:${v.name} (${v.size} bytes)`];
        if (v instanceof Blob) return [k, "<Blob: JSON>"];
        return [k, v];
      });
      console.debug("[MailWritePage] FormData entries (overview):", debugEntries);

      // Debug blob JSON contents (async)
      (async () => {
        for (const [k, v] of fd.entries()) {
          if (v instanceof Blob && v.type === "application/json") {
            try {
              const txt = await v.text();
              console.debug(`[MailWritePage] FormData part '${k}' JSON:`, JSON.parse(txt));
            } catch (err) {
              console.warn("[MailWritePage] failed to parse blob JSON for part", k, err);
            }
          }
        }
      })();

      // sendMail should accept multipart/form-data FormData
      // IMPORTANT: do not set Content-Type header manually in sendMail; let browser set boundary.
      await sendMail(fd);

      showSnack(reservedAt ? "예약메일이 정상적으로 등록되었습니다!" : "메일이 정상적으로 발송되었습니다!", "success");

      // 메일 전송 후 보낸 메일함으로 이동 (예약 메일이 아닌 경우만)
      // reservedAt이 null이거나 현재 시간 이전인 경우 즉시 발송된 메일
      const isReservedMail = reservedAt && reservedAt.isAfter(dayjs());
      
      // reset form
      setForm({
        emailId: null,
        recipientAddress: [],
        ccAddresses: [],
        bccAddresses: [],
        emailTitle: "",
        emailContent: "",
        attachments: []
      });
      setReservedAt(null);
      // 입력값도 초기화
      setRecipientInputValue("");
      setCcInputValue("");
      setBccInputValue("");
      
      // 즉시 발송된 메일인 경우 보낸 메일함으로 이동
      if (!isReservedMail) {
        navigate("/email/sent");
      }
    } catch (e) {
      console.error("sendMail error:", e);
      showSnack("메일 전송 실패: " + (e?.response?.data?.message || e.message || "알 수 없는 오류"), "error");
    } finally {
      setSending(false);
    }
  };


  return (
    <Box sx={{ py: 3, px: 4, position: 'relative' }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
        <Typography variant="h5" fontWeight={700} sx={{ mr: 2 }}>
          메일쓰기
        </Typography>
        <KeyboardArrowDownIcon />
        <Box sx={{ flex: 1 }} />
        {/* 취소 버튼 */}
        <Button
          variant="outlined"
          startIcon={<CancelIcon />}
          onClick={() => setCancelDialogOpen(true)}
          sx={{ ml: 1, bgcolor: '#fff', boxShadow: 1 }}
        >
          취소
        </Button>
      </Box>
      <Paper
        elevation={0}
        sx={{
          border: "1px solid #e3e4ea",
          borderRadius: 2.5,
          p: 2.5,
          bgcolor: "#fff",
          mb: 2
        }}
      >

        <Box sx={{ display: "flex", alignItems: "center", mb: 0.7 }}>
          <Typography sx={{ width: 85, fontWeight: 700 }}>받는사람</Typography>
          <Box 
            sx={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover', borderRadius: 1 }
            }}
            onClick={() => {
              setAddressBookType("recipient");
              setAddressBookOpen(true);
            }}
          >
            <Autocomplete
              multiple
              freeSolo
              options={emailSuggestions}
              value={form.recipientAddress}
              inputValue={recipientInputValue}
              onInputChange={(e, newInputValue) => {
                setRecipientInputValue(newInputValue);
              }}
              onChange={(e, value) => {
                // 빈 문자열이나 공백만 있는 항목을 필터링하고 trim 처리
                const filteredValue = value
                  .map(addr => typeof addr === 'string' ? addr.trim() : addr)
                  .filter(addr => addr && addr.length > 0);
                const prevLength = form.recipientAddress?.length || 0;
                setForm(f => ({ ...f, recipientAddress: filteredValue }));
                // 값이 추가되면 입력값 초기화 (칩이 생성되면 입력 필드 비우기)
                if (filteredValue.length > prevLength) {
                  setRecipientInputValue("");
                }
              }}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip variant="outlined" label={option} {...getTagProps({ index })} key={option + index} />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="이메일 주소 입력 (클릭하여 주소록에서 선택)"
                  variant="standard"
                  sx={{ minWidth: 240 }}
                  onBlur={(e) => {
                    // 포커스를 잃을 때 입력 중인 값이 있으면 처리
                    const inputValue = e.target.value?.trim();
                    if (inputValue && inputValue.length > 0) {
                      const currentAddresses = form.recipientAddress || [];
                      if (!currentAddresses.includes(inputValue)) {
                        setForm(f => ({ ...f, recipientAddress: [...currentAddresses, inputValue] }));
                      }
                    }
                    // 포커스를 잃으면 항상 입력 필드 비우기 (칩으로 변환된 후에도 남아있는 텍스트 제거)
                    setRecipientInputValue("");
                  }}
                />
              )}
              sx={{ flex: 1, pointerEvents: 'none' }}
            />
          </Box>
          <Button 
            size="small" 
            sx={{ ml: 1, minWidth: 50, fontSize: 13 }}
            onClick={() => {
              setAddressBookType("recipient");
              setAddressBookOpen(true);
            }}
          >
            주소록
          </Button>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", mb: 0.7 }}>
          <Typography sx={{ width: 85, fontWeight: 700 }}>참조</Typography>
          <Box 
            sx={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover', borderRadius: 1 }
            }}
            onClick={() => {
              setAddressBookType("cc");
              setAddressBookOpen(true);
            }}
          >
            <Autocomplete
              multiple
              freeSolo
              options={emailSuggestions}
              value={form.ccAddresses}
              inputValue={ccInputValue}
              onInputChange={(e, newInputValue) => {
                setCcInputValue(newInputValue);
              }}
              onChange={(e, value) => {
                // 빈 문자열이나 공백만 있는 항목을 필터링하고 trim 처리
                const filteredValue = value
                  .map(addr => typeof addr === 'string' ? addr.trim() : addr)
                  .filter(addr => addr && addr.length > 0);
                const prevLength = form.ccAddresses?.length || 0;
                setForm(f => ({ ...f, ccAddresses: filteredValue }));
                // 값이 추가되면 입력값 초기화 (칩이 생성되면 입력 필드 비우기)
                if (filteredValue.length > prevLength) {
                  setCcInputValue("");
                }
              }}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip variant="outlined" label={option} {...getTagProps({ index })} key={option + index} />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="이메일 주소 입력 (클릭하여 주소록에서 선택)"
                  variant="standard"
                  sx={{ minWidth: 240 }}
                  onBlur={(e) => {
                    // 포커스를 잃을 때 입력 중인 값이 있으면 처리
                    const inputValue = e.target.value?.trim();
                    if (inputValue && inputValue.length > 0) {
                      const currentAddresses = form.ccAddresses || [];
                      if (!currentAddresses.includes(inputValue)) {
                        setForm(f => ({ ...f, ccAddresses: [...currentAddresses, inputValue] }));
                      }
                    }
                    // 포커스를 잃으면 항상 입력 필드 비우기 (칩으로 변환된 후에도 남아있는 텍스트 제거)
                    setCcInputValue("");
                  }}
                />
              )}
              sx={{ flex: 1, pointerEvents: 'none' }}
            />
          </Box>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", mb: 0.7 }}>
          <Typography sx={{ width: 85, fontWeight: 700 }}>숨은참조</Typography>
          <Box 
            sx={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover', borderRadius: 1 }
            }}
            onClick={() => {
              setAddressBookType("bcc");
              setAddressBookOpen(true);
            }}
          >
            <Autocomplete
            multiple
            freeSolo
            options={emailSuggestions}
            value={form.bccAddresses}
            inputValue={bccInputValue}
            onInputChange={(e, newInputValue) => {
              setBccInputValue(newInputValue);
            }}
            onChange={(e, value) => {
              // 빈 문자열이나 공백만 있는 항목을 필터링하고 trim 처리
              const filteredValue = value
                .map(addr => typeof addr === 'string' ? addr.trim() : addr)
                .filter(addr => addr && addr.length > 0);
              const prevLength = form.bccAddresses?.length || 0;
              setForm(f => ({ ...f, bccAddresses: filteredValue }));
              // 값이 추가되면 입력값 초기화 (칩이 생성되면 입력 필드 비우기)
              if (filteredValue.length > prevLength) {
                setBccInputValue("");
              }
            }}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip variant="outlined" label={option} {...getTagProps({ index })} key={option + index} />
              ))
            }
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="이메일 주소 입력 (클릭하여 주소록에서 선택)"
                  variant="standard"
                  sx={{ minWidth: 240 }}
                  onBlur={(e) => {
                    // 포커스를 잃을 때 입력 중인 값이 있으면 처리
                    const inputValue = e.target.value?.trim();
                    if (inputValue && inputValue.length > 0) {
                      const currentAddresses = form.bccAddresses || [];
                      if (!currentAddresses.includes(inputValue)) {
                        setForm(f => ({ ...f, bccAddresses: [...currentAddresses, inputValue] }));
                      }
                    }
                    // 포커스를 잃으면 항상 입력 필드 비우기 (칩으로 변환된 후에도 남아있는 텍스트 제거)
                    setBccInputValue("");
                  }}
                />
              )}
              sx={{ flex: 1, pointerEvents: 'none' }}
            />
          </Box>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", mb: 0.7 }}>
          <Typography sx={{ width: 85, fontWeight: 700 }}>제목</Typography>
          <TextField
            variant="standard"
            fullWidth
            value={form.emailTitle}
            onChange={e => {
              // ⭐ 제목 최대 100자 제한
              const value = e.target.value;
              if (value.length <= 100) {
                handleFieldChange("emailTitle", value);
              }
            }}
            placeholder="제목 (최대 100자)"
            inputProps={{ maxLength: 100 }}
            helperText={`${form.emailTitle.length}/100`}
            sx={{ mr: 2 }}
          />
        </Box>
        {/* 예약 발송 입력란 추가 */}
        <Box sx={{ display: "flex", alignItems: "center", mb: 0.7 }}>
          <Typography sx={{ width: 85, fontWeight: 700 }}>예약 발송</Typography>
          <DateTimePicker
            value={reservedAt}
            onChange={setReservedAt}
            minDateTime={dayjs()}
            slotProps={{ textField: { variant: 'standard', sx: { minWidth: 220 } } }}
          />
        </Box>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <AttachFileIcon fontSize="small" sx={{ mr: 1, color: "#666" }} />
          <Input type="file" inputProps={{ multiple: true }} onChange={handleFileChange} />
          <Box sx={{ ml: 2, color: "text.secondary", fontSize: 13 }}>
            최대 20MB, 1회에 5MB까지
          </Box>
        </Box>
        <Box sx={{ mb: 2 }}>
          {form.attachments.map((file, idx) => (
            <Chip
              key={file.name + idx}
              label={file.name}
              sx={{ mr: 1, mb: 0.5 }}
              onDelete={() => handleRemoveAttachment(idx)}
            />
          ))}
        </Box>
        <Box sx={{ mb: 2 }}>
          <TextField
            label="본문"
            value={form.emailContent}
            onChange={e => {
              // ⭐ 본문 최대 5000자 제한
              const value = e.target.value;
              if (value.length <= 5000) {
                handleFieldChange("emailContent", value);
              }
            }}
            fullWidth
            multiline
            rows={10}
            variant="outlined"
            placeholder="내용을 입력하세요 (최대 5000자)"
            inputProps={{ maxLength: 5000 }}
            helperText={`${form.emailContent.length}/5000`}
            sx={{
              "& .MuiInputBase-root": {
                overflow: "auto",
                wordBreak: "break-word",
                whiteSpace: "pre-wrap"
              },
              "& .MuiInputBase-input": {
                overflow: "auto",
                wordBreak: "break-word",
                whiteSpace: "pre-wrap"
              }
            }}
          />
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", mt: 3 }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<SendIcon />}
            sx={{ mr: 2, minWidth: 120, fontWeight: 700 }}
            onClick={handleSend}
            disabled={sending}
          >
            {sending ? "전송 중..." : "메일 발송"}
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<SaveOutlinedIcon />}
            sx={{ minWidth: 120, fontWeight: 700 }}
            disabled={sending || savingDraft}
            onClick={handleSaveDraft}
          >
            {savingDraft ? "임시 저장 중..." : "임시 저장"}
          </Button>
        </Box>
      </Paper>

      {/* 주소록 팝업 */}
      <AddressBookDialog
        open={addressBookOpen}
        onClose={() => {
          setAddressBookOpen(false);
          setAddressBookType(null);
        }}
        onConfirm={(emails) => {
          // 중복 제거를 위해 기존 주소와 합치고 중복 제거
          const existingEmails = addressBookType === "recipient" 
            ? form.recipientAddress 
            : addressBookType === "cc"
            ? form.ccAddresses
            : form.bccAddresses;
          
          const mergedEmails = [...new Set([...existingEmails, ...emails])];
          
          if (addressBookType === "recipient") {
            setForm(f => ({ ...f, recipientAddress: mergedEmails }));
          } else if (addressBookType === "cc") {
            setForm(f => ({ ...f, ccAddresses: mergedEmails }));
          } else if (addressBookType === "bcc") {
            setForm(f => ({ ...f, bccAddresses: mergedEmails }));
          }
        }}
        initialSelectedEmails={
          // 받는사람, 참조, 숨은참조 중 한 곳에라도 들어간 모든 이메일을 전달하여 선택 불가 처리
          [...new Set([
            ...(form.recipientAddress || []),
            ...(form.ccAddresses || []),
            ...(form.bccAddresses || [])
          ])]
        }
      />
      
      {/* 취소 확인 다이얼로그 */}
      <ConfirmDialog
        open={cancelDialogOpen}
        title="메일 작성 취소"
        message="작성 중인 메일을 취소하시겠습니까?"
        onConfirm={() => {
          setCancelDialogOpen(false);
          navigate(-1);
        }}
        onCancel={() => setCancelDialogOpen(false)}
      />
    </Box>
  );
}

export default MailWritePage;