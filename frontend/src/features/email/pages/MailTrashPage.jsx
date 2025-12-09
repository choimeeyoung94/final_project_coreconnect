import React, { useEffect, useState } from "react";
import {
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  Button, Checkbox, Chip, Pagination, CircularProgress, IconButton, Menu, MenuItem
} from "@mui/material";
// import VisibilityIcon from "@mui/icons-material/Visibility"; // 눈모양 제거
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import RestoreIcon from "@mui/icons-material/Restore";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useNavigate } from "react-router-dom";
import {
  fetchTrashMails,   // 휴지통 메일 목록 조회
  deleteMails,       // "선택 삭제" - 휴지통에서 영구삭제({mailIds:[...]}로 호출)
  emptyTrash,        // "휴지통 비우기" - 휴지통 전체 영구삭제
  restoreFromTrash   // "복원" - 휴지통에서 메일 복원
} from "../api/emailApi";
import SyncIcon from "@mui/icons-material/Sync";
import { useContext } from "react";
import { UserProfileContext } from "../../../App";
import { useSnackbarContext } from "../../../components/utils/SnackbarContext";
import ConfirmDialog from "../../../components/utils/ConfirmDialog";

const MailTrashPage = () => {
  const { showSnack } = useSnackbarContext();
  // 페이지, 사이즈, 총개수, 메일리스트, 선택Set, 로딩상태
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10); // 페이지당 항목 수 (5 또는 10 선택 가능)
  const [total, setTotal] = useState(0);
  const [sizeMenuAnchor, setSizeMenuAnchor] = useState(null); // 페이지 크기 선택 메뉴
  const [mails, setMails] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // 'empty' or 'delete'
  const { userProfile } = useContext(UserProfileContext) || {};
  const userEmail = userProfile?.email;
  const navigate = useNavigate();

  // 응답 파싱 유틸
  const parsePageResponse = (res) => {
    const maybe = (path) => { try { return path(); } catch { return undefined; } };
    const r = res;
    const a = maybe(() => r.data.data);
    const b = maybe(() => r.data);
    const c = maybe(() => r);
    const candidates = [a, b, c].filter(Boolean);
    let pageObj = null;
    for (const cand of candidates) {
      if (Array.isArray(cand)) { pageObj = { content: cand, totalElements: cand.length }; break; }
      if (cand && (Array.isArray(cand.content) || typeof cand.totalElements !== "undefined")) { pageObj = cand; break; }
      if (cand && typeof cand === "object" && Object.keys(cand).length > 0) {
        const possibleArray = Object.keys(cand).every(k => /^\d+$/.test(k));
        if (possibleArray) {
          const arr = Object.keys(cand).sort((x, y) => Number(x) - Number(y)).map(k => cand[k]);
          pageObj = { content: arr, totalElements: arr.length }; break;
        }
      }
    }
    if (!pageObj && Array.isArray(r.data)) pageObj = { content: r.data, totalElements: r.data.length };
    if (!pageObj) return { content: [], totalElements: 0, raw: res };
    const content = Array.isArray(pageObj.content) ? pageObj.content : [];
    const totalElements = typeof pageObj.totalElements === "number"
      ? pageObj.totalElements
      : (pageObj.total ? pageObj.total : content.length);
    return { content, totalElements, pageObj };
  };

  // 휴지통 메일 목록 fetch
  const load = async (p = page) => {
    if (!userEmail) { setMails([]); setTotal(0); return; }
    setLoading(true);
    try {
      const res = await fetchTrashMails(userEmail, p - 1, size);
      const parsed = parsePageResponse(res);
      setMails(parsed.content || []);
      setTotal(typeof parsed.totalElements === "number" ? parsed.totalElements : 0);
      setSelected(new Set());
    } catch {
      setMails([]); setTotal(0); setSelected(new Set());
    } finally { setLoading(false); }
  };
  useEffect(() => { load(page); }, [page, size, userEmail]);

  const handleRefresh = () => {
    load(page);
  };

  // 전체/일부 체크 상태 유틸
  const allChecked = mails.length > 0 && selected.size === mails.length;
  const isIndeterminate = selected.size > 0 && selected.size < mails.length;

  // 체크박스 토글
  const toggleSelect = (id) => {
    setSelected(prev => {
      const copy = new Set(prev);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });
  };

  /**
   * 휴지통 비우기: 선택된 메일 있으면 deleteMails({ mailIds })로 영구삭제,
   * 없으면 전체 비우기(영구삭제)
   */
  const handleEmptyTrash = () => {
    if (selected.size > 0) {
      setConfirmAction('delete');
      setConfirmDialogOpen(true);
    } else {
      setConfirmAction('empty');
      setConfirmDialogOpen(true);
    }
  };

  const handleConfirmAction = async () => {
    setConfirmDialogOpen(false);
    setLoading(true);
    try {
      if (confirmAction === 'delete' && selected.size > 0) {
        const ids = Array.from(selected);
        await deleteMails({ mailIds: ids });
        showSnack(`${ids.length}개의 메일을 영구 삭제했습니다.`, 'success');
      } else if (confirmAction === 'empty') {
        await emptyTrash();
        showSnack("휴지통이 비워졌습니다.", 'success');
      }
      setPage(1);
      await load(1);
      setSelected(new Set());
    } catch {
      showSnack("휴지통 비우기/삭제 중 오류 발생!", 'error');
      setLoading(false);
    } finally {
      setLoading(false);
      setConfirmAction(null);
    }
  };

  // 선택 삭제(휴지통에서 영구삭제)
  const handleDeleteSelected = () => {
    if (selected.size === 0) {
      showSnack("삭제할 메일을 선택해 주세요.", 'warning');
      return;
    }
    setConfirmAction('delete');
    setConfirmDialogOpen(true);
  };

  // 선택된 메일 복원
  const handleRestoreSelected = async () => {
    if (selected.size === 0) {
      showSnack("복원할 메일을 선택해 주세요.", 'warning');
      return;
    }
    
    const ids = Array.from(selected);
    setLoading(true);
    try {
      await restoreFromTrash(ids);
      showSnack(`${ids.length}개의 메일이 복원되었습니다.`, 'success');
      setSelected(new Set());
      await load(page);
    } catch (err) {
      console.error('handleRestoreSelected error', err);
      showSnack("메일 복원 중 오류가 발생했습니다.", 'error');
    } finally {
      setLoading(false);
    }
  };

  // 날짜 포맷 함수 (YYYY-MM-DD HH:mm)
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
      console.error('[MailTrashPage] formatSentTime 에러:', error, sentTime);
      return '-';
    }
  };


  return (
    <Box sx={{ p: 4, minHeight: "100vh", bgcolor: "#fafbfd", position: 'relative' }}>
      <Paper elevation={0} sx={{ p: 3, borderRadius: 2 }}>
        {/* 상단 툴바 / 타이틀 */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            휴지통
          </Typography>
          <Chip label={`총 ${total}개`} sx={{ ml: 2, bgcolor: "#eceff1", fontWeight: 700 }} />
          <Box sx={{ flex: 1 }} />
          <Button
            variant="outlined"
            color="success"
            size="small"
            sx={{ mr: 1 }}
            startIcon={<RestoreIcon />}
            disabled={selected.size === 0 || loading}
            onClick={handleRestoreSelected}
          >
            복원
          </Button>
          <Button
            variant="outlined"
            color="primary"
            size="small"
            sx={{ mr: 1 }}
            disabled={selected.size === 0 || loading}
            onClick={handleDeleteSelected}
          >
            선택 삭제
          </Button>
          <Button
            variant="contained"
            color="error"
            size="small"
            startIcon={<DeleteForeverIcon />}
            onClick={handleEmptyTrash}
            disabled={loading || total === 0}
          >
            휴지통 비우기
          </Button>
          <IconButton onClick={handleRefresh} disabled={loading} sx={{ ml: 1 }}>
            <SyncIcon />
          </IconButton>
          <Box sx={{ ml: 2, display: 'flex', alignItems: 'center' }}>
            <Paper 
              sx={{ display: 'inline-flex', alignItems: 'center', px: 0.5, cursor: 'pointer' }}
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
        </Box>

        {/* 메일 테이블 */}
        <Table sx={{ minWidth: 900 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: "#f8fafd", borderBottom: '2px solid #e1e3ea' }}>
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  indeterminate={isIndeterminate}
                  checked={allChecked}
                  onChange={e => {
                    if (e.target.checked) setSelected(new Set(mails.map(m => m.emailId)));
                    else setSelected(new Set());
                  }}
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }}>발신자</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>제목</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>일자</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>받는사람 메일주소</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Box sx={{ py: 4 }}>
                    <CircularProgress />
                  </Box>
                </TableCell>
              </TableRow>
            ) : Array.isArray(mails) && mails.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">휴지통에 메일이 없습니다.</TableCell>
              </TableRow>
            ) : (
              mails.map(mail => (
                <TableRow
                  key={mail.emailId}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => navigate(`/email/${mail.emailId}`)}
                >
                  <TableCell padding="checkbox" onClick={e => e.stopPropagation()}>
                    <Checkbox
                      size="small"
                      checked={selected.has(mail.emailId)}
                      onChange={() => toggleSelect(mail.emailId)}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {mail.senderEmail || mail.senderName || '-'}
                  </TableCell>
                  <TableCell>{mail.emailTitle || '-'}</TableCell>
                  <TableCell>{formatSentTime(mail.sentTime)}</TableCell>
                  <TableCell sx={{ fontSize: 13 }}>
                    {Array.isArray(mail.recipientAddresses) && mail.recipientAddresses.length > 0
                      ? mail.recipientAddresses.map((email, idx) => (
                        <span key={email + idx}>
                          {email}
                          {idx < mail.recipientAddresses.length - 1 ? ', ' : ''}
                        </span>
                      ))
                      : '-'
                    }
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* 하단 페이징 */}
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
          <Pagination
            count={Math.max(1, Math.ceil(total / size))}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
          />
        </Box>
      </Paper>
      
      <ConfirmDialog
        open={confirmDialogOpen}
        title={confirmAction === 'empty' ? "휴지통 비우기" : "메일 영구 삭제"}
        message={
          confirmAction === 'empty' 
            ? "휴지통을 완전히 비우시겠습니까? (복구 불가)"
            : `선택한 ${selected.size}개의 메일을 완전히 삭제하시겠습니까? (복구 불가)`
        }
        onConfirm={handleConfirmAction}
        onCancel={() => {
          setConfirmDialogOpen(false);
          setConfirmAction(null);
        }}
      />
    </Box>
  );
};

export default MailTrashPage;