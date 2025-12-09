import React, { useEffect, useState, useCallback } from 'react';
import { getEmailDetail, downloadAttachment, markMailAsRead, moveToTrash, toggleFavoriteStatus } from '../api/emailApi';
import http from '../../../api/http';
import JSZip from 'jszip';
import {
  Box, Typography, Divider, Paper, IconButton, Chip, Tooltip, Button,
  Snackbar, Alert
} from '@mui/material';
import ReplyIcon from '@mui/icons-material/Reply';
import ForwardIcon from '@mui/icons-material/Forward';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import Star from '@mui/icons-material/Star';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { useParams, useNavigate, useOutletContext, useLocation } from 'react-router-dom';
import { useContext } from "react";
import { UserProfileContext, MailCountContext } from "../../../App";
import ConfirmDialog from "../../../components/utils/ConfirmDialog";
import { useSnackbarContext } from "../../../components/utils/SnackbarContext";
import { UNREAD_REFRESH_FLAG, UNREAD_PENDING_IDS_KEY } from "../constants";

// 파일 사이즈 변환
function formatBytes(bytes) {
  if (isNaN(bytes) || !bytes) return '-';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return +(bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}

// 상태에 따라 라벨 한글 변환 함수 (메일 상태 표시에 사용)
function getStatusLabel(emailStatus) {
  if (emailStatus === "SENT") return "발신완료";
  if (emailStatus === "FAILED" || emailStatus === "FAIL" || emailStatus === "BOUNCE") return "발신실패";
  if (emailStatus === "TRASH") return "휴지통";
  if (emailStatus === "DELETED") return "삭제됨";
  return emailStatus;
}

function MailDetailPage() {
  const { emailId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showSnack } = useSnackbarContext();
  const [mailDetail, setMailDetail] = useState(null);
  const [snack, setSnack] = useState({ open: false, severity: 'info', message: '' });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { refreshUnreadCount } = useOutletContext();
  const { userProfile } = useContext(UserProfileContext) || {};
  const mailCountContext = useContext(MailCountContext);
  const { refreshInboxCount, refreshFavoriteCount, setUnreadCountDirectly } = mailCountContext || {};
  const userEmail = userProfile?.email;
  const fromTab = location.state?.fromTab; // 어느 탭에서 왔는지 확인

  const decrementSidebarUnread = useCallback(() => {
    if (typeof setUnreadCountDirectly === "function") {
      setUnreadCountDirectly(prev => Math.max(0, prev - 1));
    }
  }, [setUnreadCountDirectly]);

  const markUnreadListNeedsRefresh = useCallback(() => {
    sessionStorage.setItem(UNREAD_REFRESH_FLAG, 'true');
  }, []);

  const addPendingUnreadId = useCallback((id) => {
    if (!id) return;
    try {
      const raw = sessionStorage.getItem(UNREAD_PENDING_IDS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) {
        sessionStorage.setItem(UNREAD_PENDING_IDS_KEY, JSON.stringify([id]));
        return;
      }
      if (!arr.includes(id)) {
        arr.push(id);
        sessionStorage.setItem(UNREAD_PENDING_IDS_KEY, JSON.stringify(arr));
      }
    } catch (err) {
      console.error("[MailDetailPage] addPendingUnreadId error", err);
    }
  }, []);
  
  useEffect(() => {
  if (!emailId || !userEmail) return;

  getEmailDetail(emailId, userEmail).then(res => {
    const data = res.data.data;
    console.log("[MailDetailPage] getEmailDetail 응답:", data);
    console.log("[MailDetailPage] favoriteStatus:", data.favoriteStatus, "type:", typeof data.favoriteStatus);
    
    // favoriteStatus가 null이나 undefined일 경우 false로 처리
    const favoriteStatus = data.favoriteStatus === true || data.favoriteStatus === 'true';
    setMailDetail({
      ...data,
      favoriteStatus: favoriteStatus
    });

    // 백엔드의 getEmailDetail에서 이미 읽음 처리를 했으므로,
    // 응답의 emailReadYn을 확인합니다.
    // 백엔드에서 읽음 처리를 했으면 emailReadYn이 true로 반환되어야 합니다.
    const isUnread = data.emailReadYn === false || data.emailReadYn === null || data.emailReadYn === undefined;
    const wasReadByBackend = data.emailReadYn === true;
    
    console.log("[MailDetailPage] 읽음 상태 확인:", {
      emailId,
      emailReadYn: data.emailReadYn,
      isUnread,
      wasReadByBackend,
      fromTab
    });
    
    if (isUnread) {
      // 백엔드에서 읽음 처리가 안 된 경우에만 프론트엔드에서 처리
      console.log("[MailDetailPage] 백엔드에서 읽음 처리가 안 됨, 프론트엔드에서 처리");
      markMailAsRead(emailId, userEmail)
        .then(() => {
          decrementSidebarUnread();
          if (fromTab === "unread") {
            addPendingUnreadId(Number(emailId));
            markUnreadListNeedsRefresh();
          }
          // DB 반영을 위한 대기 후 카운트 업데이트
          setTimeout(() => {
            // useOutletContext에서 받은 refreshUnreadCount 호출
            if (refreshUnreadCount) {
              refreshUnreadCount();
            }
            // mailCountContext의 refreshUnreadCount도 호출 (사이드바 뱃지 업데이트)
            if (mailCountContext?.refreshUnreadCount) {
              mailCountContext.refreshUnreadCount();
            }
            if (refreshInboxCount) {
              refreshInboxCount(); // 받은 메일함 전체 개수도 새로고침
            }
            // mailCountContext의 refreshInboxCount도 명시적으로 호출
            if (mailCountContext?.refreshInboxCount) {
              mailCountContext.refreshInboxCount();
            }
            
            // 안읽은 메일 탭에서 왔다면 목록 새로고침을 위한 이벤트 발생
            if (fromTab === "unread") {
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('refreshUnreadMailList'));
              }, 300);
            }
          }, 500);
        })
        .catch(err => {
          console.error("markMailAsRead error in MailDetailPage:", err);
          // 에러가 발생해도 안읽은 메일 탭에서 왔다면 이벤트 발생
          if (fromTab === "unread") {
            markUnreadListNeedsRefresh();
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('refreshUnreadMailList'));
            }, 500);
          }
        });
    } else if (wasReadByBackend) {
      // 백엔드에서 읽음 처리를 했으므로 카운트만 업데이트
      console.log("[MailDetailPage] 백엔드에서 읽음 처리 완료, 카운트 업데이트");
      setTimeout(() => {
        // useOutletContext에서 받은 refreshUnreadCount 호출
        if (refreshUnreadCount) {
          refreshUnreadCount();
        }
        // mailCountContext의 refreshUnreadCount도 호출 (사이드바 뱃지 업데이트)
        if (mailCountContext?.refreshUnreadCount) {
          mailCountContext.refreshUnreadCount();
        }
        if (refreshInboxCount) {
          refreshInboxCount(); // 받은 메일함 전체 개수도 새로고침
        }
        // mailCountContext의 refreshInboxCount도 명시적으로 호출
        if (mailCountContext?.refreshInboxCount) {
          mailCountContext.refreshInboxCount();
        }
        
        // 안읽은 메일 탭에서 왔다면 목록 새로고침을 위한 이벤트 발생
        if (fromTab === "unread") {
          markUnreadListNeedsRefresh();
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('refreshUnreadMailList'));
          }, 300);
        }
      }, 300); // 백엔드에서 이미 처리했으므로 짧은 대기 시간
    } else {
      // 이미 읽은 메일이지만 안읽은 메일 탭에서 왔다면 목록 새로고침 (상태 동기화)
      if (fromTab === "unread") {
        markUnreadListNeedsRefresh();
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('refreshUnreadMailList'));
        }, 300);
      }
    }
  }).catch(err => {
    console.error("[MailDetailPage] getEmailDetail error:", err);
  });
}, [emailId, userEmail, refreshUnreadCount, mailCountContext, refreshInboxCount, fromTab, decrementSidebarUnread, markUnreadListNeedsRefresh, addPendingUnreadId]);


  if (!mailDetail) return <div>Loading...</div>;

  const handleDownload = (fileId, fileName) => {
    downloadAttachment(fileId, fileName);
  };

  // 중요 메일 토글 핸들러
  const handleToggleFavorite = async () => {
    if (!emailId || !userEmail) {
      showSnack('메일 정보를 찾을 수 없습니다.', 'error');
      return;
    }

    try {
      const res = await toggleFavoriteStatus(emailId, userEmail);
      const newStatus = res?.data?.data;
      
      // 메일 상세 정보 업데이트
      setMailDetail(prev => ({
        ...prev,
        favoriteStatus: newStatus
      }));

      showSnack(
        newStatus ? '중요 메일로 설정되었습니다.' : '중요 메일 해제되었습니다.',
        'success'
      );
      
      // 중요 메일 개수 새로고침
      if (refreshFavoriteCount) {
        setTimeout(() => {
          refreshFavoriteCount();
        }, 100);
      }
    } catch (err) {
      console.error('handleToggleFavorite error', err);
      showSnack('중요 메일 설정 중 오류가 발생했습니다.', 'error');
    }
  };

  // 전체 첨부파일 다운로드 (.zip)
  const handleDownloadAll = async () => {
    if (!mailDetail?.attachments || mailDetail.attachments.length === 0) {
      setSnack({ open: true, severity: 'warning', message: '다운로드할 첨부파일이 없습니다.' });
      return;
    }

    try {
      const zip = new JSZip();
      
      // 모든 첨부파일을 다운로드하여 ZIP에 추가
      const downloadPromises = mailDetail.attachments.map(async (file) => {
        try {
          const response = await http.get(`/email/file/download/${file.fileId}`, { 
            responseType: 'blob' 
          });
          zip.file(file.fileName, response.data);
        } catch (err) {
          console.error(`Failed to download file ${file.fileName}:`, err);
          throw err;
        }
      });

      await Promise.all(downloadPromises);

      // ZIP 파일 생성 및 다운로드
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attachments_${emailId || 'email'}.zip`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSnack({ open: true, severity: 'success', message: '모든 첨부파일이 다운로드되었습니다.' });
    } catch (err) {
      console.error('handleDownloadAll error', err);
      setSnack({ open: true, severity: 'error', message: '첨부파일 다운로드 중 오류가 발생했습니다.' });
    }
  };

  // 답장 핸들러
  const handleReply = async () => {
    if (!mailDetail) {
      setSnack({ open: true, severity: 'error', message: '메일 정보를 찾을 수 없습니다.' });
      return;
    }

    try {
      // 메일 상세 정보 가져오기 (cc, bcc 정보 포함)
      const detailRes = await getEmailDetail(emailId, userEmail);
      const mailDetailData = detailRes?.data?.data || mailDetail;

      // 답장 정보 구성
      const replyData = {
        originalEmail: {
          emailId: mailDetailData.emailId,
          senderEmail: mailDetailData.senderEmail || mailDetail.senderEmail,
          senderName: mailDetailData.senderName || mailDetail.senderName,
          emailTitle: mailDetailData.emailTitle || mailDetail.emailTitle,
          sentTime: mailDetailData.sentTime || mailDetailData.emailSentTime || mailDetail.sentTime,
          recipientAddresses: mailDetailData.recipientAddresses || mailDetail.toRecipients?.map(r => r.emailRecipientAddress) || [],
          ccAddresses: mailDetailData.ccAddresses || mailDetail.ccRecipients?.map(r => r.emailRecipientAddress) || [],
          bccAddresses: mailDetailData.bccAddresses || mailDetail.bccRecipients?.map(r => r.emailRecipientAddress) || [],
          emailContent: mailDetailData.emailContent || mailDetail.emailContent || ''
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
    if (!mailDetail) {
      setSnack({ open: true, severity: 'error', message: '메일 정보를 찾을 수 없습니다.' });
      return;
    }

    try {
      // 메일 상세 정보 가져오기 (cc, bcc 정보 포함)
      const detailRes = await getEmailDetail(emailId, userEmail);
      const mailDetailData = detailRes?.data?.data || mailDetail;

      // 전달 정보 구성
      const forwardData = {
        originalEmail: {
          emailId: mailDetailData.emailId,
          senderEmail: mailDetailData.senderEmail || mailDetail.senderEmail,
          senderName: mailDetailData.senderName || mailDetail.senderName,
          emailTitle: mailDetailData.emailTitle || mailDetail.emailTitle,
          sentTime: mailDetailData.sentTime || mailDetailData.emailSentTime || mailDetail.sentTime,
          recipientAddresses: mailDetailData.recipientAddresses || mailDetail.toRecipients?.map(r => r.emailRecipientAddress) || [],
          ccAddresses: mailDetailData.ccAddresses || mailDetail.ccRecipients?.map(r => r.emailRecipientAddress) || [],
          bccAddresses: mailDetailData.bccAddresses || mailDetail.bccRecipients?.map(r => r.emailRecipientAddress) || [],
          emailContent: mailDetailData.emailContent || mailDetail.emailContent || ''
        }
      };

      // 메일쓰기 페이지로 이동 (location.state로 전달 정보 전달)
      navigate('/email/write', { state: { forwardData } });
    } catch (err) {
      console.error("handleForward error", err);
      setSnack({ open: true, severity: 'error', message: '메일 상세 정보를 가져오는 중 오류가 발생했습니다.' });
    }
  };

  // 삭제 핸들러
  const handleDelete = async () => {
    if (!emailId) {
      setSnack({ open: true, severity: 'error', message: '메일 ID를 찾을 수 없습니다.' });
      return;
    }

    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    setDeleteDialogOpen(false);
    if (!emailId) return;

    try {
      await moveToTrash([emailId]); // 휴지통으로 이동
      setSnack({ open: true, severity: 'success', message: '메일을 휴지통으로 이동했습니다.' });
      
      // 이전 페이지로 이동
      setTimeout(() => {
        navigate(-1);
      }, 1000);
    } catch (err) {
      console.error('handleDelete error', err);
      setSnack({ open: true, severity: 'error', message: '메일 삭제 중 오류가 발생했습니다.' });
    }
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      bgcolor: "#f8fafb",
      overflow: 'hidden'
    }}>
      {/* 상단 액션 버튼 */}
      <Box sx={{ 
        p: 2, 
        bgcolor: "#fff", 
        borderBottom: "1px solid #e5e7eb",
        display: 'flex', 
        alignItems: "center", 
        justifyContent: 'space-between', 
        gap: 1,
        flexShrink: 0
      }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Tooltip title="답장"><IconButton color="inherit" onClick={handleReply}><ReplyIcon /></IconButton></Tooltip>
          <Tooltip title="전달"><IconButton color="inherit" onClick={handleForward}><ForwardIcon /></IconButton></Tooltip>
          <Tooltip title="삭제"><IconButton color="inherit" onClick={handleDelete}><DeleteIcon /></IconButton></Tooltip>
          <Tooltip title={(mailDetail.favoriteStatus === true || mailDetail.favoriteStatus === 'true') ? "중요 해제" : "중요 표시"}>
            <IconButton 
              onClick={handleToggleFavorite}
              sx={{ 
                color: (mailDetail.favoriteStatus === true || mailDetail.favoriteStatus === 'true') ? "#ffc107" : "inherit",
                '&:hover': {
                  bgcolor: (mailDetail.favoriteStatus === true || mailDetail.favoriteStatus === 'true') ? 'rgba(255, 193, 7, 0.1)' : 'rgba(0, 0, 0, 0.04)'
                }
              }}
            >
              {(mailDetail.favoriteStatus === true || mailDetail.favoriteStatus === 'true') ? (
                <Star sx={{ color: "#ffc107", fontSize: 28 }} />
              ) : (
                <StarIcon sx={{ color: "inherit", fontSize: 28 }} />
              )}
            </IconButton>
          </Tooltip>
        </Box>
        <Box>
          <Tooltip title="더보기"><IconButton><MoreVertIcon /></IconButton></Tooltip>
        </Box>
      </Box>
      
      {/* 스크롤 가능한 메일 내용 영역 */}
      <Box sx={{ 
        flex: 1, 
        overflowY: 'auto', 
        overflowX: 'hidden',
        bgcolor: "#fff"
      }}>
        <Box sx={{ 
          maxWidth: '100%', 
          mx: 'auto', 
          p: 3,
          height: '100%'
        }}>
          <Paper elevation={0} sx={{ 
            p: 4, 
            borderRadius: 2, 
            boxShadow: 2,
            height: 'fit-content',
            minHeight: '100%'
          }}>
        {/* 제목, 상태, 중요표시 */}
        <Box sx={{ pb: 1, mb: 2, borderBottom: "1px solid #ececec", display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, flex: 1 }}>{mailDetail.emailTitle}</Typography>
          {mailDetail.emailStatus && (
            <Chip
              label={getStatusLabel(mailDetail.emailStatus)}
              color={mailDetail.emailStatus === "SENT" ? "success" : mailDetail.emailStatus === "FAILED" ? "error" : "default"}
              size="small"
              sx={{ fontWeight: 500 }}
            />
          )}
          {(mailDetail.favoriteStatus === true || mailDetail.favoriteStatus === 'true') && (
            <Star sx={{ color: "#ffc107", ml: 1 }} fontSize="small" />
          )}
        </Box>
        {/* 송신자/수신자 블록 */}
        <Box sx={{ display: 'flex', alignItems: "center", gap: 2, mb: 1, flexWrap: "wrap" }}>
          <Typography fontWeight={600} fontSize={15}>보낸사람:</Typography>
          <Chip
            color="info"
            label={`${mailDetail.senderEmail || '-'}${mailDetail.senderDept ? ' / ' + mailDetail.senderDept : ''}`}
            size="small"
            sx={{ mr: 1, fontWeight: 500 }}
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: "center", flexWrap: "wrap", gap: 2, mb: 1 }}>
          <Typography fontWeight={600} fontSize={15}>받는사람:</Typography>
          {(() => {
            // 이메일 주소 기준으로 중복 제거
            const seen = new Set();
            return (mailDetail.toRecipients || []).filter(r => {
              const address = r.emailRecipientAddress?.toLowerCase();
              if (seen.has(address)) {
                return false;
              }
              seen.add(address);
              return true;
            }).map(r => (
              <Chip
                label={`${r.emailRecipientAddress}${r.userDept ? ' / ' + r.userDept : ''}`}
                key={r.emailRecipientId}
                size="small"
                sx={{ mr: 1 }}
              />
            ));
          })()}
        </Box>
        {(() => {
          // 참조(CC) 중복 제거
          const seen = new Set();
          const uniqueCcRecipients = (mailDetail.ccRecipients || []).filter(r => {
            const address = r.emailRecipientAddress?.toLowerCase();
            if (seen.has(address)) {
              return false;
            }
            seen.add(address);
            return true;
          });
          return uniqueCcRecipients.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: "center", flexWrap: "wrap", gap: 2, mb: 1 }}>
              <Typography color="textSecondary" fontSize={15}>참조:</Typography>
              {uniqueCcRecipients.map(r =>
                <Chip
                  label={`${r.emailRecipientAddress}${r.userDept ? ' / ' + r.userDept : ''}`}
                  key={r.emailRecipientId}
                  size="small"
                  variant="outlined"
                  sx={{ mr: 1, color: "#90b2cc" }}
                />
              )}
            </Box>
          );
        })()}
        {(() => {
          // 숨은참조(BCC) 중복 제거
          const seen = new Set();
          const uniqueBccRecipients = (mailDetail.bccRecipients || []).filter(r => {
            const address = r.emailRecipientAddress?.toLowerCase();
            if (seen.has(address)) {
              return false;
            }
            seen.add(address);
            return true;
          });
          return uniqueBccRecipients.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: "center", flexWrap: "wrap", gap: 2, mb: 1 }}>
              <Typography color="textSecondary" fontSize={15}>숨은참조:</Typography>
              {uniqueBccRecipients.map(r =>
                <Chip
                  label={`${r.emailRecipientAddress}${r.userDept ? ' / ' + r.userDept : ''}`}
                  key={r.emailRecipientId}
                  size="small"
                  variant="outlined"
                  sx={{ mr: 1, color: "#b09dcc" }}
                />
              )}
            </Box>
          );
        })()}
        {/* 보낸 날짜 라인 */}
        <Box sx={{ mt: 0.5, mb: 2, color: "#777", fontSize: 14 }}>
          보낸날짜: {mailDetail.sentTime ? (() => {
            try {
              let d;
              const dateStr = String(mailDetail.sentTime);
              
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
                d = typeof mailDetail.sentTime === "string" ? new Date(mailDetail.sentTime) : mailDetail.sentTime;
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
            } catch {
              return "-";
            }
          })() : "-"}
        </Box>
        {/* === 첨부파일 영역 (파일명 표시/다운로드) === */}
        {(mailDetail.attachments && mailDetail.attachments.length > 0) && (
          <Box sx={{
            width: "100%",
            mt: 2, mb: 2, bgcolor: "#f6faff", borderRadius: 1,
            py: 1.2, border: "1px solid #e2ecfa"
          }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1, px: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <AttachFileIcon sx={{ color: "#7da8e3", mr: 1 }} />
                <Typography fontWeight={600} fontSize={15}>
                  첨부파일 {mailDetail.attachments.length}개
                </Typography>
              </Box>
              {mailDetail.attachments.length > 1 && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AttachFileIcon />}
                  onClick={handleDownloadAll}
                  sx={{ ml: 2 }}
                >
                  전체 다운로드 (.zip)
                </Button>
              )}
            </Box>
            <Box sx={{
              display: "flex",
              gap: 1,
              flexWrap: "wrap",
              width: "100%",
              px: 2
            }}>
              {mailDetail.attachments.map(file => (
                <Chip
                  icon={<AttachFileIcon />}
                  label={`${file.fileName} (${formatBytes(file.fileSize)})`}
                  onClick={() => handleDownload(file.fileId, file.fileName)}
                  clickable
                  key={file.fileId}
                  sx={{
                    mr: 1,
                    px: 1.8,
                    py: 1.1,
                    fontWeight: 500,
                    bgcolor: "#f4f6fa",
                    borderRadius: "6px",
                    fontSize: "15px"
                  }}
                />
              ))}
            </Box>
          </Box>
        )}
        <Divider sx={{ my: 2 }} />
        <Box sx={{
          minHeight: 120,
          bgcolor: "#f3f3f3",
          borderRadius: 1,
          p: 3,
          fontSize: 15,
          lineHeight: 1.7,
          mb: 2,
          whiteSpace: "pre-wrap",
          border: "1px solid #efefef",
          wordBreak: "break-word",
          overflowWrap: "break-word"
        }}>
          {mailDetail.emailContent}
        </Box>
          </Paper>
        </Box>
      </Box>

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
        message="이 메일을 휴지통으로 이동하시겠습니까?"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </Box>
  );
}

export default MailDetailPage;