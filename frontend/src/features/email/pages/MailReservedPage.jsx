import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Button,
  Chip,
  Pagination,
  CircularProgress,
  Checkbox,
  Tooltip,
  Avatar,
  Stack,
  Tooltip as MuiTooltip,
  Menu,
  MenuItem
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CancelIcon from "@mui/icons-material/Cancel";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useNavigate } from "react-router-dom";
import {  fetchScheduledMails } from "../api/emailApi";
import { useContext } from "react";
import { UserProfileContext } from "../../../App";
import { useSnackbarContext } from "../../../components/utils/SnackbarContext";
import ConfirmDialog from "../../../components/utils/ConfirmDialog";

/**
 * 예약메일함 페이지 (테이블형)
 * - 체크박스 선택, 개별/일괄 예약 취소(서버 API가 있는 경우 사용)
 * - 상세 클릭 시 /email/:emailId 로 이동
 * - 백엔드의 Page 래퍼 형식에 유연하게 대응
 */

const MailReservedPage = () => {
  const { showSnack } = useSnackbarContext();
  const [page, setPage] = useState(1); // UI: 1-based
  const [size, setSize] = useState(10); // 페이지당 항목 수 (5 또는 10 선택 가능)
  const [total, setTotal] = useState(0);
  const [mails, setMails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [sizeMenuAnchor, setSizeMenuAnchor] = useState(null); // 페이지 크기 선택 메뉴
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmEmailId, setConfirmEmailId] = useState(null);

  const { userProfile } = useContext(UserProfileContext) || {};
  const userEmail = userProfile?.email;
  const navigate = useNavigate();

  const safe = (fn, def) => {
    try {
      return fn();
    } catch (e) {
      return def;
    }
  };

  const parsePageResponse = (res) => {
    const candA = safe(() => res.data.data, null);
    const candB = safe(() => res.data, null);
    const candC = res || null;
    const candidates = [candA, candB, candC].filter(Boolean);

    for (const cand of candidates) {
      if (cand && Array.isArray(cand.content)) {
        return {
          content: cand.content,
          totalElements:
            typeof cand.totalElements === "number"
              ? cand.totalElements
              : cand.content.length
        };
      }
      if (Array.isArray(cand)) {
        return { content: cand, totalElements: cand.length };
      }
      if (cand && Array.isArray(cand.data)) {
        return {
          content: cand.data,
          totalElements: cand.total || cand.data.length || 0
        };
      }
    }
    return { content: [], totalElements: 0 };
  };

  const load = async (p = page) => {
    if (!userEmail) {
      setMails([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchScheduledMails(userEmail, p - 1, size);
      const parsed = parsePageResponse(res);
      setMails(parsed.content || []);
      setTotal(typeof parsed.totalElements === "number" ? parsed.totalElements : 0);
      setSelected(new Set());
    } catch (err) {
      console.error("fetchScheduledMails failed:", err);
      setMails([]);
      setTotal(0);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(page);
    // eslint-disable-next-line
  }, [page, size, userEmail]);

  const handleSelectToggle = (id) => {
    setSelected((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  };

  const allChecked = mails.length > 0 && selected.size === mails.length;
  const isIndeterminate = selected.size > 0 && selected.size < mails.length;

  const handleSelectAll = (checked) => {
    if (checked) setSelected(new Set(mails.map((m) => m.emailId)));
    else setSelected(new Set());
  };

  // 예약 취소 (서버에 cancel API가 있다면 /api/v1/email/{id}/cancel 같은 엔드포인트 호출)
  const cancelScheduled = (emailId) => {
    setConfirmEmailId(emailId);
    setConfirmDialogOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!confirmEmailId) return;
    const emailId = confirmEmailId;
    setConfirmDialogOpen(false);
    try {
      // Try calling expected cancel endpoint. If your backend path differs, adapt it.
      const resp = await fetch(`/api/v1/email/${emailId}/cancel`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" }
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || "예약취소 실패");
      }
      showSnack("예약이 취소되었습니다.", 'success');
      load(page);
    } catch (err) {
      console.error("cancelScheduled failed:", err);
      showSnack("예약 취소 중 오류가 발생했습니다.", 'error');
    } finally {
      setConfirmEmailId(null);
    }
  };

  const handleCancelSelected = () => {
    if (selected.size === 0) {
      showSnack("취소할 예약메일을 선택하세요.", 'warning');
      return;
    }
    setConfirmEmailId('batch');
    setConfirmDialogOpen(true);
  };

  const handleConfirmBatchCancel = async () => {
    setConfirmDialogOpen(false);
    // iterate and cancel (could be optimized server-side with batch API)
    let successCount = 0;
    let failCount = 0;
    for (const id of Array.from(selected)) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const resp = await fetch(`/api/v1/email/${id}/cancel`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" }
        });
        if (resp.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        failCount++;
      }
    }
    if (successCount > 0) {
      showSnack(`${successCount}개의 예약메일이 취소되었습니다.`, 'success');
    }
    if (failCount > 0) {
      showSnack(`${failCount}개의 예약메일 취소에 실패했습니다.`, 'error');
    }
    load(page);
    setConfirmEmailId(null);
  };

  const formatDateTime = (v) => {
    try {
      if (!v) return "-";
      
      let d;
      const dateStr = String(v);
      
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
        d = new Date(v);
      }
      
      if (isNaN(d.getTime())) return "-";
      
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
      console.error('[MailReservedPage] formatDateTime 에러:', error, v);
      return "-";
    }
  };

  // helper: sender avatar initials
  const initials = (nameOrEmail) => {
    if (!nameOrEmail) return "U";
    const parts = nameOrEmail.split(/[\s@._-]+/).filter(Boolean);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  };

  return (
    <Box sx={{ p: 4, minHeight: "100vh", bgcolor: "#fafbfd", position: 'relative' }}>
      <Paper elevation={0} sx={{ p: 3, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            예약메일함
          </Typography>
          <Chip label={`총 ${total}개`} sx={{ bgcolor: "#eceff1", fontWeight: 700 }} />
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined" size="small" onClick={() => load(1)} disabled={loading}>
            새로고침
          </Button>
          <Button
            variant="contained"
            size="small"
            color="error"
            startIcon={<CancelIcon />}
            onClick={handleCancelSelected}
            disabled={selected.size === 0 || loading}
          >
            선택 취소
          </Button>
          <Paper 
            sx={{ display: 'inline-flex', alignItems: 'center', px: 0.5, cursor: 'pointer', ml: 2 }}
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
        </Stack>

        <Table sx={{ minWidth: 900 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: "#f8fafd", borderBottom: "2px solid #e1e3ea" }}>
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  indeterminate={isIndeterminate}
                  checked={allChecked}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }}>발신자</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>제목</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>예약일시</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>받는사람</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>상태</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>액션</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Box sx={{ py: 4 }}>
                    <CircularProgress />
                  </Box>
                </TableCell>
              </TableRow>
            ) : Array.isArray(mails) && mails.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  예약된 메일이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              mails.map((mail) => (
                <TableRow key={mail.emailId} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={selected.has(mail.emailId)}
                      onChange={() => handleSelectToggle(mail.emailId)}
                    />
                  </TableCell>

                  <TableCell
                    sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
                    onClick={() => navigate(`/email/${mail.emailId}`)}
                  >
                    <Avatar sx={{ width: 32, height: 32, mr: 1, bgcolor: "primary.main", fontSize: 14 }}>
                      {initials(mail.senderName || mail.senderEmail)}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {mail.senderName || mail.senderEmail || "-"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {mail.senderDept || ""}
                      </Typography>
                    </Box>
                  </TableCell>

                  <TableCell onClick={() => navigate(`/email/${mail.emailId}`)} sx={{ cursor: "pointer", maxWidth: 420 }}>
                    <Tooltip title={mail.emailTitle || "-"}>
                      <Typography noWrap>{mail.emailTitle || "-"}</Typography>
                    </Tooltip>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      {mail.emailContent ? (mail.emailContent.length > 140 ? `${mail.emailContent.slice(0, 140)}...` : mail.emailContent) : ""}
                    </Typography>
                  </TableCell>

                  <TableCell onClick={() => navigate(`/email/${mail.emailId}`)} sx={{ cursor: "pointer" }}>
                    {formatDateTime(mail.reservedAt)}
                  </TableCell>

                  <TableCell onClick={() => navigate(`/email/${mail.emailId}`)} sx={{ cursor: "pointer" }}>
                    {Array.isArray(mail.recipientAddresses) && mail.recipientAddresses.length > 0 ? (
                      <Stack direction="row" spacing={0.5}>
                        {mail.recipientAddresses.slice(0, 3).map((r, idx) => (
                          <Chip key={r + idx} label={r} size="small" />
                        ))}
                        {mail.recipientAddresses.length > 3 && (
                          <MuiTooltip title={mail.recipientAddresses.join(", ")}>
                            <Chip label={`+${mail.recipientAddresses.length - 3}`} size="small" />
                          </MuiTooltip>
                        )}
                      </Stack>
                    ) : (
                      "-"
                    )}
                  </TableCell>

                  <TableCell align="right">
                    <Chip label={mail.emailStatus || "-"} size="small" />
                  </TableCell>

                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Tooltip title="상세보기">
                        <IconButton size="small" onClick={() => navigate(`/email/${mail.emailId}`)}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="예약취소">
                        <IconButton size="small" onClick={() => cancelScheduled(mail.emailId)}>
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", my: 3 }}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              페이지 {page} / {Math.max(1, Math.ceil(total / size))}
            </Typography>
          </Box>
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
        title="예약메일 취소"
        message={
          confirmEmailId === 'batch'
            ? `선택한 ${selected.size}개의 예약메일을 취소하시겠습니까?`
            : "선택한 예약메일을 취소하시겠습니까?"
        }
        onConfirm={confirmEmailId === 'batch' ? handleConfirmBatchCancel : handleConfirmCancel}
        onCancel={() => {
          setConfirmDialogOpen(false);
          setConfirmEmailId(null);
        }}
      />
    </Box>
  );
};

export default MailReservedPage;