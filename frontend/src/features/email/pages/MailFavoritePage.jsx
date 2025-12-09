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
import SyncIcon from '@mui/icons-material/Sync';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import StarIcon from '@mui/icons-material/Star';

import { fetchFavoriteMails, moveToTrash, getEmailDetail, toggleFavoriteStatus } from '../api/emailApi';
import { useNavigate } from 'react-router-dom';
import { UserProfileContext, MailCountContext } from '../../../App';
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
  중요 메일함 페이지 컴포넌트
  - 중요 메일 목록 조회, 삭제, 페이징, 메일 정보 표시, 선택 등 담당
*/
const MailFavoritePage = () => {
  // UserProfileContext에서 userProfile을 가져와 이메일을 추출
  const { userProfile } = useContext(UserProfileContext) || {};
  const mailCountContext = useContext(MailCountContext);
  const { refreshFavoriteCount } = mailCountContext || {};
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
  const [sortOrder, setSortOrder] = useState("asc"); // 날짜 정렬 순서: "asc" (오름차순, 오래된순), "desc" (내림차순, 최신순)
  const [isRefreshing, setIsRefreshing] = useState(false); // 새로고침 로딩 상태
  const [selected, setSelected] = useState(new Set());
  const [snack, setSnack] = useState({ open: false, severity: 'info', message: '' });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const navigate = useNavigate();

  /*
    중요 메일 목록을 서버에서 조회하는 함수 (userEmail, page, size 기준)
  */
  const load = async (
    pageIdx = page,
    pageSize = size,
    keywordParam = appliedKeyword,
    searchTypeParam = appliedSearchType
  ) => {
    if (!userEmail) {
      console.log("No userEmail, skipping fetchFavoriteMails");
      setTotal(0); setMails([]);
      return Promise.resolve();
    }

    return fetchFavoriteMails(userEmail, pageIdx - 1, pageSize, searchTypeParam, keywordParam)
      .then(res => {
        const boxData = res?.data?.data;
        const mailList = Array.isArray(boxData?.content) ? boxData.content : [];
        setMails(mailList);
        setTotal(typeof boxData?.totalElements === "number" ? boxData.totalElements : 0);
      })
      .catch(err => {
        setMails([]);
        setTotal(0);
        console.error("fetchFavoriteMails error:", err);
      });
  };

  // 컴포넌트 마운트 시 및 userEmail, page, size, 검색 조건 변경 시 목록 로드
  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [page, size, userEmail, appliedKeyword, appliedSearchType]);

  // 검색 제출 핸들러
  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    const keyword = search.trim();
    const type = searchType;
    setAppliedKeyword(keyword);
    setAppliedSearchType(type);
    setPage(1);
    // useEffect가 appliedKeyword와 appliedSearchType 변경을 감지하여 load()를 호출함
  };

  // 날짜순 정렬 토글 핸들러
  // 첫 번째 클릭: 오름차순(asc), 두 번째 클릭: 내림차순(desc)
  const handleSortByDate = () => {
    const newOrder = sortOrder === "asc" ? "desc" : "asc";
    setSortOrder(newOrder);
  };

  // 정렬된 메일 목록 (useMemo로 최적화)
  const sortedMails = useMemo(() => {
    if (!mails || mails.length === 0) return [];
    
    const sorted = [...mails].sort((a, b) => {
      const dateA = a.sentTime ? new Date(a.sentTime).getTime() : 0;
      const dateB = b.sentTime ? new Date(b.sentTime).getTime() : 0;
      
      if (sortOrder === "asc") {
        return dateA - dateB; // 오름차순 (오래된순)
      } else {
        return dateB - dateA; // 내림차순 (최신순)
      }
    });
    
    return sorted;
  }, [mails, sortOrder]);

  // 새로고침 핸들러
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await load();
    } catch (err) {
      console.error("handleRefresh error:", err);
    } finally {
      // 로딩바가 잠깐 보이도록 최소 시간 대기 (UX 개선)
      setTimeout(() => {
        setIsRefreshing(false);
      }, 300);
    }
  };

  // 여러 메일을 휴지통(삭제) 처리
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
      await moveToTrash(ids);
      setSnack({ open: true, severity: 'success', message: `${ids.length}개의 메일을 휴지통으로 이동했습니다.` });
      setSelected(prev => {
        const s = new Set(prev);
        ids.forEach(id => s.delete(id));
        return s;
      });
      await load();
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

    const selectedMailId = Array.from(selected)[0];
    const selectedMail = sortedMails.find(m => m.emailId === selectedMailId);
    
    if (!selectedMail) {
      setSnack({ open: true, severity: 'error', message: '선택한 메일을 찾을 수 없습니다.' });
      return;
    }

    try {
      const detailRes = await getEmailDetail(selectedMailId, userEmail);
      const mailDetail = detailRes?.data?.data || selectedMail;

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

    const selectedMailId = Array.from(selected)[0];
    const selectedMail = sortedMails.find(m => m.emailId === selectedMailId);
    
    if (!selectedMail) {
      setSnack({ open: true, severity: 'error', message: '선택한 메일을 찾을 수 없습니다.' });
      return;
    }

    try {
      const detailRes = await getEmailDetail(selectedMailId, userEmail);
      const mailDetail = detailRes?.data?.data || selectedMail;

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

      navigate('/email/write', { state: { forwardData } });
    } catch (err) {
      console.error("handleForward error", err);
      setSnack({ open: true, severity: 'error', message: '메일 상세 정보를 가져오는 중 오류가 발생했습니다.' });
    }
  };

  // 중요 해제 핸들러
  const handleUnfavorite = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      setSnack({ open: true, severity: 'warning', message: '중요 해제할 메일을 선택하세요.' });
      return;
    }

    try {
      await Promise.all(ids.map(id => toggleFavoriteStatus(id, userEmail)));
      setSnack({ open: true, severity: 'success', message: `${ids.length}개의 메일을 중요 해제했습니다.` });
      setSelected(new Set());
      await load();
      
      // 중요 메일 개수 새로고침
      if (refreshFavoriteCount) {
        setTimeout(() => {
          refreshFavoriteCount();
        }, 100);
      }
    } catch (err) {
      console.error('handleUnfavorite error', err);
      setSnack({ open: true, severity: 'error', message: '중요 해제 중 오류가 발생했습니다.' });
    }
  };

  // 전체 행이 선택됐는지(체크박스UI용)
  const allChecked = sortedMails.length > 0 && selected.size === sortedMails.length;
  const isIndeterminate = selected.size > 0 && selected.size < sortedMails.length;

  // 전체 선택/해제 토글
  const handleToggleAll = () => {
    if (allChecked) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sortedMails.map(m => m.emailId)));
    }
  };

  // 개별 행 선택/해제 토글
  const handleToggleRow = (emailId) => {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(emailId)) {
        s.delete(emailId);
      } else {
        s.add(emailId);
      }
      return s;
    });
  };

  // 날짜 포맷 (YYYY-MM-DD HH:mm)
  const formatSentTime = (sentTime) => {
    if (!sentTime) return '-';
    try {
      let d;
      const dateStr = String(sentTime);
      
      // ISO 8601 형식인 경우 (서버에서 "2025-11-25T00:42:00" 형식으로 보냄)
      if (dateStr.includes('T')) {
        // 타임존 정보가 없으면 한국 시간(UTC+9)으로 간주하여 파싱
        if (!dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.match(/-\d{2}:\d{2}$/)) {
          // "2025-11-25T00:42:00" 형식을 한국 시간으로 파싱
          const [datePart, timePart] = dateStr.split('T');
          const [year, month, day] = datePart.split('-');
          const [timeOnly] = (timePart || '').split('.');
          const [hour, minute, second = '00'] = (timeOnly || '').split(':');
          
          // UTC로 Date 객체 생성 후 한국 시간(UTC+9)으로 변환
          d = new Date(Date.UTC(
            parseInt(year, 10),
            parseInt(month, 10) - 1,
            parseInt(day, 10),
            parseInt(hour, 10),
            parseInt(minute, 10),
            parseInt(second, 10)
          ));
          // 한국 시간은 UTC+9이므로 9시간을 빼서 UTC로 변환
          d = new Date(d.getTime() - (9 * 60 * 60 * 1000));
        } else {
          d = new Date(dateStr);
        }
      } else {
        d = (typeof sentTime === "string" || typeof sentTime === "number") ? new Date(sentTime) : sentTime;
      }
      
      // 한국 시간으로 변환하여 포맷팅
      const koreaTimeStr = d.toLocaleString('en-US', { timeZone: 'Asia/Seoul' });
      const koreaTime = new Date(koreaTimeStr);
      const yyyy = koreaTime.getFullYear();
      const mm = String(koreaTime.getMonth() + 1).padStart(2, "0");
      const dd = String(koreaTime.getDate()).padStart(2, "0");
      const HH = String(koreaTime.getHours()).padStart(2, "0");
      const mi = String(koreaTime.getMinutes()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd} ${HH}:${mi}`;
    } catch (error) {
      console.error('[MailFavoritePage] formatSentTime 에러:', error, sentTime);
      return '-';
    }
  };

  // 메일 행 클릭(상세진입)
  const handleMailRowClick = (mail) => {
    navigate(`/email/${mail.emailId}`);
  };

  return (
    <Box sx={{ flex: 1, p: 3, bgcolor: "#f8fafb", minHeight: "100vh", position: 'relative' }}>
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
        {/* 제목 */}
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h5" fontWeight={700}>
            중요 메일
          </Typography>
        </Box>

        {/* 검색창 및 툴바 */}
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
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
                minWidth: 120,
                height: 36,
                fontSize: 14
              }}
            >
              <MenuItem value="TITLE_CONTENT">제목+내용</MenuItem>
              <MenuItem value="TITLE">제목</MenuItem>
              <MenuItem value="CONTENT">내용</MenuItem>
            </Select>
            <Paper
              sx={{ display: 'flex', alignItems: 'center', width: 300, height: 36, p: '2px 4px' }}
            >
              <InputBase
                sx={{ ml: 1, flex: 1, fontSize: 14 }}
                placeholder="검색어 입력"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchSubmit(e);
                  }
                }}
              />
              <IconButton onClick={handleSearchSubmit} sx={{ p: '6px' }}>
                <SearchIcon fontSize="small" />
              </IconButton>
            </Paper>
          </Box>

          {/* 툴바 버튼들 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, position: 'relative' }}>
            <IconButton 
              onClick={handleSortByDate} 
              title={sortOrder === "asc" ? "날짜순 내림차순 (최신순)" : "날짜순 오름차순 (오래된순)"}
            >
              {sortOrder === "asc" ? <ArrowDownwardIcon /> : <ArrowUpwardIcon />}
            </IconButton>
            <IconButton onClick={handleRefresh}>
              <SyncIcon />
            </IconButton>
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
            <Button startIcon={<StarIcon />} onClick={handleUnfavorite}>중요 해제</Button>
          </ButtonGroup>
        </Box>

        {/* 테이블 */}
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={allChecked}
                  indeterminate={isIndeterminate}
                  onChange={handleToggleAll}
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }}>제목</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>발신자</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>날짜</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>상태</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedMails.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                  <Typography color="textSecondary">중요 메일이 없습니다.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              sortedMails.map((mail) => (
                <TableRow
                  key={mail.emailId}
                  hover
                  onClick={() => handleMailRowClick(mail)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(mail.emailId)}
                      onChange={() => handleToggleRow(mail.emailId)}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <StarIcon sx={{ color: "#f1ac00", fontSize: 18 }} />
                      <Typography
                        sx={{
                          fontWeight: selected.has(mail.emailId) ? 600 : 400,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 400
                        }}
                      >
                        {mail.emailTitle || '(제목 없음)'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{mail.senderName || mail.senderEmail || '-'}</TableCell>
                  <TableCell>{formatSentTime(mail.sentTime)}</TableCell>
                  <TableCell>
                    {mail.emailStatus && (
                      <Chip
                        label={getStatusLabel(mail.emailStatus)}
                        color={getStatusColor(mail.emailStatus)}
                        size="small"
                        sx={{ fontWeight: 500 }}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* 페이징 */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={Math.ceil(total / size)}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
          />
        </Box>

        {/* 페이지 크기 선택 메뉴 */}
        <Menu
          anchorEl={sizeMenuAnchor}
          open={Boolean(sizeMenuAnchor)}
          onClose={() => setSizeMenuAnchor(null)}
        >
          <MenuItem onClick={() => { setSize(5); setSizeMenuAnchor(null); setPage(1); }}>5개씩 보기</MenuItem>
          <MenuItem onClick={() => { setSize(10); setSizeMenuAnchor(null); setPage(1); }}>10개씩 보기</MenuItem>
        </Menu>
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

export default MailFavoritePage;

