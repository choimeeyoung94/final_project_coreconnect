import React, { useEffect, useState, useContext, useMemo } from 'react';
import { 
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell, 
  IconButton, ButtonGroup, Button, InputBase, Divider, Checkbox, Chip, Pagination, Menu, MenuItem, Select, LinearProgress,
  Snackbar, Alert
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ReplyIcon from '@mui/icons-material/Reply';
import DeleteIcon from '@mui/icons-material/Delete';
import ForwardIcon from '@mui/icons-material/Forward';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SyncIcon from '@mui/icons-material/Sync';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';

import { fetchSentbox, moveToTrash, getEmailDetail } from '../api/emailApi';
import { useNavigate } from 'react-router-dom';
import { UserProfileContext } from '../../../App';
import ConfirmDialog from '../../../components/utils/ConfirmDialog';

/*
  상태에 따라 라벨 한글 변환 함수 (메일 상태 표시에 사용)
*/
function getStatusLabel(emailStatus) {
  if (emailStatus === "SENT") return "발신완료";
  if (emailStatus === "FAILED" || emailStatus === "FAIL" || emailStatus === "BOUNCE") return "발신실패";
  if (emailStatus === "TRASH") return "휴지통";
  if (emailStatus === "DELETED") return "삭제됨";
  return emailStatus;
}

/*
  상태에 따라 칩 색상 결정 함수 (메일 상태 표시에 사용)
*/
function getStatusColor(emailStatus) {
  if (emailStatus === "SENT") return "success";
  if (emailStatus === "FAILED" || emailStatus === "FAIL" || emailStatus === "BOUNCE") return "error";
  if (emailStatus === "TRASH") return "warning";
  if (emailStatus === "DELETED") return "default";
  return "default";
}

/*
  보낸메일함 페이지 컴포넌트
  - 보낸 메일 목록 조회, 삭제, 페이징, 메일 정보 표시, 선택 등 담당
*/
const MailSentBoxPage = () => {
  // UserProfileContext에서 userProfile을 가져와 이메일을 추출
  const { userProfile } = useContext(UserProfileContext) || {};
  const userEmail = userProfile?.email;

  // 상태 정의: 메일 목록, 페이징, 선택 등
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10); // 페이지당 항목 수 (5 또는 10 선택 가능)
  const [total, setTotal] = useState(0);
  const [sizeMenuAnchor, setSizeMenuAnchor] = useState(null); // 페이지 크기 선택 메뉴
  const [mails, setMails] = useState([]);
  const [searchType, setSearchType] = useState("TITLE_CONTENT");
  const [appliedSearchType, setAppliedSearchType] = useState("TITLE_CONTENT");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [sortOrder, setSortOrder] = useState("desc"); // 날짜 정렬 순서: "desc" (내림차순, 최신순), "asc" (오름차순, 오래된순)
  const [isRefreshing, setIsRefreshing] = useState(false); // 새로고침 로딩 상태
  const [selected, setSelected] = useState(new Set());
  const [snack, setSnack] = useState({ open: false, severity: 'info', message: '' });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const navigate = useNavigate();

  /*
    보낸 메일 목록을 서버에서 조회하는 함수 (userEmail, page, size 기준)
  */
  const load = async (
    pageIdx = page,
    pageSize = size,
    keywordParam = appliedKeyword,
    searchTypeParam = appliedSearchType
  ) => {
    if (!userEmail) {
      // userEmail이 없으면 리스트를 클리어 및 중단
      console.log("No userEmail, skipping fetchSentbox");
      setTotal(0); setMails([]);
      return Promise.resolve();
    }

    // 디버깅 로그: API 요청 직전 파라미터 확인
    console.log("fetchSentbox() called with:", userEmail, pageIdx, pageSize, searchTypeParam, keywordParam);

    return fetchSentbox(userEmail, pageIdx - 1, pageSize, searchTypeParam, keywordParam)
      .then(res => {
        // 응답 전체를 출력하여 구조 확인
        console.log('fetchSentbox response:', res);
        const boxData = res?.data?.data;
        const mailList = Array.isArray(boxData?.content) ? boxData.content : [];
        setMails(mailList);
        setTotal(typeof boxData?.totalElements === "number" ? boxData.totalElements : 0);
      })
      .catch(err => {
        setMails([]);
        setTotal(0);
        console.error("fetchSentbox error", err);
        throw err;
      });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await load();
    } catch (err) {
      console.error("handleRefresh error", err);
    } finally {
      // 로딩바가 잠깐 보이도록 최소 시간 대기 (UX 개선)
      setTimeout(() => {
        setIsRefreshing(false);
      }, 300);
    }
  };

  // 날짜순 정렬 토글 핸들러
  const handleSortByDate = () => {
    setSortOrder(prev => prev === "desc" ? "asc" : "desc");
  };

  // 메일 목록을 날짜순으로 정렬
  const sortedMails = useMemo(() => {
    if (!Array.isArray(mails) || mails.length === 0) return mails;
    
    const sorted = [...mails].sort((a, b) => {
      const dateA = a.sentTime ? new Date(a.sentTime).getTime() : 0;
      const dateB = b.sentTime ? new Date(b.sentTime).getTime() : 0;
      
      if (sortOrder === "asc") {
        // 오름차순: 오래된 메일부터
        return dateA - dateB;
      } else {
        // 내림차순: 최신 메일부터 (기본값)
        return dateB - dateA;
      }
    });
    
    return sorted;
  }, [mails, sortOrder]);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    const keyword = search.trim();
    const type = searchType;
    setAppliedKeyword(keyword);
    setAppliedSearchType(type);
    setPage(1);
    load(1, size, keyword, type);
  };

  // page, size, userEmail 바뀔 때마다 메일 목록 새로고침
  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [page, size, userEmail, appliedKeyword, appliedSearchType]);

  /*
    메일 행 선택/해제용 핸들러
    id: 선택/해제할 이메일의 emailId
  */
  const toggleSelect = (id) => {
    setSelected(prev => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id); else copy.add(id);
      return copy;
    });
  };

  /*
    여러 메일을 휴지통(삭제) 처리
    - 체크박스 선택 후 삭제 버튼 클릭 시 동작
  */
  const handleDeleteSelected = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      setSnack({ open: true, severity: 'warning', message: '삭제할 메일을 선택하세요.' });
      return;
    }
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    const ids = Array.from(selected);
    setDeleteDialogOpen(false);

    try {
      await moveToTrash(ids); // 휴지통으로 이동
      setSnack({ open: true, severity: 'success', message: `${ids.length}개의 메일을 휴지통으로 이동했습니다.` });
      setSelected(prev => {
        const s = new Set(prev);
        ids.forEach(id => s.delete(id));
        return s;
      });
      await load();      // 새로고침: 이동한 항목 즉시 사라짐
    } catch (err) {
      console.error('handleDeleteSelected error', err);
      setSnack({ open: true, severity: 'error', message: '메일 삭제 중 오류가 발생했습니다.' });
    }
  };

  // 답장 핸들러
  const handleReply = async () => {
    if (selected.size === 0) {
      setSnack({ open: true, severity: 'warning', message: '답장할 메일을 선택해주세요.' });
      return;
    }

    // 선택된 메일 중 첫 번째 메일 사용
    const selectedMailId = Array.from(selected)[0];
    const selectedMail = sortedMails.find(m => m.emailId === selectedMailId);
    
    if (!selectedMail) {
      setSnack({ open: true, severity: 'error', message: '선택한 메일을 찾을 수 없습니다.' });
      return;
    }

    try {
      // 메일 상세 정보 가져오기 (cc, bcc 정보 포함)
      const detailRes = await getEmailDetail(selectedMailId, userEmail);
      const mailDetail = detailRes?.data?.data || selectedMail;

      // 답장 정보 구성
      const replyData = {
        originalEmail: {
          emailId: mailDetail.emailId,
          senderEmail: mailDetail.senderEmail || selectedMail.senderEmail,
          senderName: mailDetail.senderName || selectedMail.senderName,
          emailTitle: mailDetail.emailTitle || selectedMail.emailTitle,
          sentTime: mailDetail.sentTime || mailDetail.emailSentTime || selectedMail.sentTime,
          recipientAddresses: mailDetail.recipientAddresses || selectedMail.recipientAddresses || [],
          ccAddresses: mailDetail.ccAddresses || [],
          bccAddresses: mailDetail.bccAddresses || [],
          emailContent: mailDetail.emailContent || ''
        }
      };

      // 메일쓰기 페이지로 이동 (location.state로 답장 정보 전달)
      navigate('/email/write', { state: { replyData } });
    } catch (err) {
      console.error("handleReply error", err);
      setSnack({ open: true, severity: 'error', message: '메일 상세 정보를 가져오는 중 오류가 발생했습니다.' });
    }
  };

  // 전달 핸들러
  const handleForward = async () => {
    if (selected.size === 0) {
      setSnack({ open: true, severity: 'warning', message: '전달할 메일을 선택해주세요.' });
      return;
    }

    // 선택된 메일 중 첫 번째 메일 사용
    const selectedMailId = Array.from(selected)[0];
    const selectedMail = sortedMails.find(m => m.emailId === selectedMailId);
    
    if (!selectedMail) {
      setSnack({ open: true, severity: 'error', message: '선택한 메일을 찾을 수 없습니다.' });
      return;
    }

    try {
      // 메일 상세 정보 가져오기 (cc, bcc 정보 포함)
      const detailRes = await getEmailDetail(selectedMailId, userEmail);
      const mailDetail = detailRes?.data?.data || selectedMail;

      // 전달 정보 구성
      const forwardData = {
        originalEmail: {
          emailId: mailDetail.emailId,
          senderEmail: mailDetail.senderEmail || selectedMail.senderEmail,
          senderName: mailDetail.senderName || selectedMail.senderName,
          emailTitle: mailDetail.emailTitle || selectedMail.emailTitle,
          sentTime: mailDetail.sentTime || mailDetail.emailSentTime || selectedMail.sentTime,
          recipientAddresses: mailDetail.recipientAddresses || selectedMail.recipientAddresses || [],
          ccAddresses: mailDetail.ccAddresses || [],
          bccAddresses: mailDetail.bccAddresses || [],
          emailContent: mailDetail.emailContent || ''
        }
      };

      // 메일쓰기 페이지로 이동 (location.state로 전달 정보 전달)
      navigate('/email/write', { state: { forwardData } });
    } catch (err) {
      console.error("handleForward error", err);
      setSnack({ open: true, severity: 'error', message: '메일 상세 정보를 가져오는 중 오류가 발생했습니다.' });
    }
  };

  // 전체 행이 선택됐는지(체크박스UI용)
  const allChecked = sortedMails.length > 0 && selected.size === sortedMails.length;
  // indeterminate(선택 일부만, 전체X, 0개X)
  const isIndeterminate = selected.size > 0 && selected.size < sortedMails.length;

  /*
    렌더링 부분: 메일함 타이틀 + 도구 + 메일 테이블 + 페이지네이션
  */
  return (
    <Box sx={{ p: 4, bgcolor: "#fafbfd", minHeight: "100vh", position: 'relative' }}>
      {/* 로딩바 - 상단 고정 */}
      {isRefreshing && (
        <LinearProgress 
          sx={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1300,
            height: 4
          }} 
        />
      )}
      <Paper elevation={0} sx={{ p: 3, borderRadius: 2 }}>
        {/* 상단 타이틀 및 툴바 */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>보낸메일함</Typography>
          <Typography sx={{ ml: 2, color: 'text.secondary', fontSize: 15 }}>
            전체메일 <b>{total}</b>
          </Typography>
          <Box sx={{ flex: 1 }} />
          {/* 검색창 */}
          <Box
            component="form"
            onSubmit={handleSearchSubmit}
            sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}
          >
            <Select
              size="small"
              value={searchType}
              onChange={e => setSearchType(e.target.value)}
              sx={{
                minWidth: 130,
                bgcolor: '#f8fafb',
                borderRadius: 1,
                border: '1px solid #e2e6ea'
              }}
            >
              <MenuItem value="TITLE">제목</MenuItem>
              <MenuItem value="CONTENT">내용</MenuItem>
              <MenuItem value="TITLE_CONTENT">제목+내용</MenuItem>
            </Select>
            <Paper
              sx={{
                display: 'flex',
                alignItems: 'center',
                width: 250,
                p: '2px 8px',
                borderRadius: 1,
                bgcolor: "#f8fafb",
                border: '1px solid #e2e6ea'
              }}
            >
              <InputBase
                sx={{ flex: 1 }}
                placeholder="검색어를 입력하세요"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <IconButton type="submit" sx={{ p: '6px' }}>
                <SearchIcon fontSize="small" />
              </IconButton>
            </Paper>
          </Box>
        </Box>

        {/* 툴바 버튼들 */}
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, mb: 2 }}>
          <ButtonGroup variant="text" sx={{ gap: 1 }}>
            <Button 
              startIcon={<ReplyIcon />} 
              onClick={handleReply}
              disabled={selected.size !== 1}
            >
              답장
            </Button>
            <Button startIcon={<DeleteIcon />} onClick={handleDeleteSelected}>삭제</Button>
            <Button 
              startIcon={<ForwardIcon />} 
              onClick={handleForward}
              disabled={selected.size !== 1}
            >
              전달
            </Button>
          </ButtonGroup>
          <Box sx={{ flex: 1 }} />
          <IconButton onClick={handleSortByDate} title={sortOrder === "desc" ? "날짜순 내림차순 (최신순)" : "날짜순 오름차순 (오래된순)"}>
            {sortOrder === "desc" ? <ArrowDownwardIcon /> : <ArrowUpwardIcon />}
          </IconButton>
          <IconButton onClick={handleRefresh}><SyncIcon /></IconButton>
          <Paper 
            sx={{ ml: 1, display: "inline-flex", alignItems: "center", px: 0.5, cursor: 'pointer' }}
            onClick={(e) => setSizeMenuAnchor(e.currentTarget)}
          >
            <Typography sx={{ px: 0.5, fontWeight: 500, fontSize: 15 }}>{size}</Typography>
            <IconButton size="small"><MoreVertIcon fontSize="small" /></IconButton>
          </Paper>
          <Menu
            anchorEl={sizeMenuAnchor}
            open={Boolean(sizeMenuAnchor)}
            onClose={() => setSizeMenuAnchor(null)}
          >
            <MenuItem 
              onClick={() => {
                setSize(5);
                setPage(1);
                setSizeMenuAnchor(null);
              }}
              selected={size === 5}
            >
              5개씩 보기
            </MenuItem>
            <MenuItem 
              onClick={() => {
                setSize(10);
                setPage(1);
                setSizeMenuAnchor(null);
              }}
              selected={size === 10}
            >
              10개씩 보기
            </MenuItem>
          </Menu>
        </Box>
        <Divider sx={{ mb: 2 }} />

        {/* 메일 목록 테이블 */}
        <Table sx={{ minWidth: 900 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: "#f8fafd", borderBottom: '2px solid #e1e3ea' }}>
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  indeterminate={isIndeterminate}
                  checked={allChecked}
                  onChange={e => {
                    if (e.target.checked) {
                      setSelected(new Set(sortedMails.map(m => m.emailId)));
                    } else {
                      setSelected(new Set());
                    }
                  }} 
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }}>수신자</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>제목</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>일자</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>상태</TableCell>
              <TableCell sx={{ fontWeight: 700 }}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(Array.isArray(sortedMails) && sortedMails.length === 0) ? (
              <TableRow>
                <TableCell colSpan={6} align="center">보낸 메일이 없습니다.</TableCell>
              </TableRow>
            ) : (
              sortedMails.map((mail) => (
                <TableRow
                  key={mail.emailId}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => navigate(`/email/${mail.emailId}`)}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      size="small"
                      checked={selected.has(mail.emailId)}
                      onChange={() => toggleSelect(mail.emailId)}
                    />
                  </TableCell>
                  <TableCell
                    sx={{
                      maxWidth: 200,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <Box
                      sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "100%",
                        minWidth: 0,
                      }}
                    >
                      {(mail.recipientAddresses || []).join(", ") || "-"}
                    </Box>
                    {mail.ccAddresses && mail.ccAddresses.length > 0 && (
                      <Box
                        sx={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "100%",
                          minWidth: 0,
                          color: '#90b2cc',
                          fontSize: 12,
                          mt: 0.5,
                        }}
                      >
                        cc: {mail.ccAddresses.join(", ")}
                      </Box>
                    )}
                    {mail.bccAddresses && mail.bccAddresses.length > 0 && (
                      <Box
                        sx={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "100%",
                          minWidth: 0,
                          color: '#b09dcc',
                          fontSize: 12,
                          mt: 0.5,
                        }}
                      >
                        bcc: {mail.bccAddresses.join(", ")}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell
                    sx={{
                      maxWidth: 400,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "100%",
                        minWidth: 0,
                        display: "inline-block",
                      }}
                    >
                      {mail.emailTitle}
                    </Box>
                    {mail.fileIds && mail.fileIds.length > 0 && (
                      <Chip label={`첨부 ${mail.fileIds.length}개`} size="small" color="info" sx={{ ml: 1 }} />
                    )}
                  </TableCell>
                  <TableCell>
                    {mail.sentTime ? new Date(mail.sentTime).toLocaleString() : "-"}
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      label={getStatusLabel(mail.emailStatus)}
                      color={getStatusColor(mail.emailStatus)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {/* 눈모양 아이콘(상세보기) 제거됨 */}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* 페이지네이션 */}
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
          <Pagination
            count={Math.ceil(total / size)}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
          />
        </Box>
      </Paper>

      {/* Snackbar 알림 */}
      <Snackbar 
        open={snack.open} 
        autoHideDuration={5000} 
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnack({ ...snack, open: false })} severity={snack.severity} sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>

      {/* 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="메일 삭제"
        message={`선택한 ${selected.size}개의 메일을 휴지통으로 이동하시겠습니까?`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </Box>
  );
};

export default MailSentBoxPage;