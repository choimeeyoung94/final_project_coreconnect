import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  IconButton,
  Popover,
  Typography,
  Divider,
  List,
  ListItem,
  Chip,
  Tabs,
  Tab,
  Button,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { formatTime } from "../../../../utils/TimeUtils";
import { getNotificationTypeLabel } from "../../../../utils/labelUtils";
import {
  getAllUnreadNotifications,
  getNotificationPage,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../../../../features/notification/api/notificationAPI";

export default function NotificationPopover({
  anchorEl,
  open,
  onClose,
  onNotificationCountChange,
}) {
  const navigate = useNavigate();
  const [unreadList, setUnreadList] = useState([]);
  // "전체 알림" 탭: 읽은 것도 같이, 20개씩 더 보기
  const [tab, setTab] = useState("unread");
  const [allList, setAllList] = useState([]);
  const [allPage, setAllPage] = useState(0);
  const [allLast, setAllLast] = useState(true);
  const [loadingAll, setLoadingAll] = useState(false);

  const loadAllPage = useCallback(async (page) => {
    try {
      setLoadingAll(true);
      const data = await getNotificationPage("all", page, 20);
      setAllList(prev => (page === 0 ? data.content : [...prev, ...data.content]));
      setAllPage(page);
      setAllLast(data.last);
    } catch (err) {
      console.error("[NotificationPopover] 전체 알림 조회 실패:", err);
    } finally {
      setLoadingAll(false);
    }
  }, []);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [markAllAsReadTimestamp, setMarkAllAsReadTimestamp] = useState(null); // "모두 읽음" 처리 시간 추적

  // 알림 시간 표시 함수 (상대 시간 또는 절대 시간)
  const formatNotificationTime = (sentAt) => {
    if (!sentAt) return "";
    
    try {
      let date;
      
      // ISO 8601 형식인 경우 (예: "2025-01-15T10:30:00" 또는 "2025-01-15T10:30:00+09:00")
      if (typeof sentAt === 'string' && sentAt.includes('T')) {
        // 시간대 정보가 없으면 한국 시간대(UTC+9)로 가정
        if (!sentAt.includes('+') && !sentAt.includes('Z') && !sentAt.includes('-', 10)) {
          // "2025-01-15T10:30:00" 형식인 경우 한국 시간대로 해석
          date = new Date(sentAt + '+09:00');
        } else {
          date = new Date(sentAt);
        }
      } 
      // "yyyy-MM-dd HH:mm:ss" 형식인 경우 (예: "2025-01-15 10:30:00")
      else if (typeof sentAt === 'string' && sentAt.includes(' ')) {
        // 공백을 T로 변경하고 한국 시간대 추가
        const isoString = sentAt.replace(' ', 'T') + '+09:00';
        date = new Date(isoString);
      }
      // 기타 형식
      else {
        date = new Date(sentAt);
      }
      
      // 유효한 날짜인지 확인
      if (isNaN(date.getTime())) {
        console.warn('[formatNotificationTime] 잘못된 날짜 형식:', sentAt);
        return "";
      }
      
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      // 상대 시간 표시
      if (diffMins < 1) return "방금 전";
      if (diffMins < 60) return `${diffMins}분 전`;
      if (diffHours < 24) return `${diffHours}시간 전`;
      if (diffDays < 7) return `${diffDays}일 전`;
      
      // 7일 이상 지난 경우 날짜 표시 ("10월 17일", 올해가 아니면 "2025년 10월 17일")
      const monthDay = `${date.getMonth() + 1}월 ${date.getDate()}일`;
      return date.getFullYear() === now.getFullYear() ? monthDay : `${date.getFullYear()}년 ${monthDay}`;
    } catch (error) {
      console.error('[formatNotificationTime] 날짜 파싱 오류:', error, 'sentAt:', sentAt);
      return "";
    }
  };

  // 알림 타입별 색상 설정
  const getNotificationTypeColor = (type) => {
    switch (type?.toUpperCase()) {
      case "EMAIL":
        return { bgcolor: "#1976d2", color: "#fff" }; // 파란색
      case "NOTICE":
        return { bgcolor: "#ed6c02", color: "#fff" }; // 주황색
      case "APPROVAL":
        return { bgcolor: "#d32f2f", color: "#fff" }; // 빨간색
      case "SCHEDULE":
        return { bgcolor: "#2e7d32", color: "#fff" }; // 초록색
      case "CHAT":
        return { bgcolor: "#9c27b0", color: "#fff" }; // 보라색
      default:
        return { bgcolor: "#757575", color: "#fff" }; // 회색
    }
  };

  // 알림 클릭 시 상세 페이지로 이동
  const handleNotificationClick = async (notif) => {
    try {
      // Optimistic Update: 읽음 처리 전에 즉시 목록에서 제거 (더 나은 UX)
      setUnreadList(prevList => {
        const newList = prevList.filter(item => item.notificationId !== notif.notificationId);
        // 알림 개수 변경 콜백 호출
        if (onNotificationCountChange) {
          onNotificationCountChange(newList.length);
        }
        return newList;
      });
      
      // "전체 알림" 탭 목록에서는 지우지 않고 읽음으로 표시만 바꿈
      setAllList(prevList => prevList.map(item =>
        item.notificationId === notif.notificationId ? { ...item, readYn: true } : item));

      // 알림 읽음 처리 (실패해도 페이지 이동은 진행)
      try {
        await markNotificationAsRead(notif.notificationId);
        console.log(`[NotificationPopover] 알림 읽음 처리 완료 - notificationId: ${notif.notificationId}`);
      } catch (readError) {
        console.error("[NotificationPopover] 알림 읽음 처리 실패:", readError);
        // 읽음 처리 실패해도 이미 목록에서 제거했으므로 그대로 진행
      }
      
      // 알림 타입에 따라 다른 페이지로 이동
      const type = notif.notificationType?.toUpperCase();
      switch (type) {
        case "EMAIL":
          // 메일 알림의 경우 메일 목록 페이지로 이동 (메시지에서 emailId 추출이 어려우므로)
          navigate("/email");
          break;
        case "APPROVAL": {
          // 결재 알림의 경우 메시지 내용에 따라 다른 페이지로 이동
          const message = notif.message || "";
          
          // "새로운 결재 요청이 도착했습니다" 메시지가 있는 경우 결재 홈으로 이동
          if (message.includes("새로운 결재 요청이 도착했습니다")) {
            navigate("/e-approval");
          } 
          // "최종 승인되었습니다" 메시지가 있고 documentId가 있는 경우 문서 상세 페이지로 이동
          else if (message.includes("최종 승인되었습니다") && notif.documentId) {
            navigate(`/e-approval/doc/${notif.documentId}`);
          }
          // documentId가 있는 경우 문서 상세 페이지로 이동
          else if (notif.documentId) {
            navigate(`/e-approval/doc/${notif.documentId}`);
          } 
          // 그 외의 경우 결재 홈으로 이동
          else {
            navigate("/e-approval");
          }
          break;
        }
        case "NOTICE":
          // 공지사항 알림의 경우 boardId가 있으면 상세 페이지로, 없으면 목록 페이지로
          if (notif.boardId) {
            navigate(`/board/detail/${notif.boardId}`);
          } else {
            navigate("/board");
          }
          break;
        case "SCHEDULE":
          // 일정 알림의 경우 scheduleId가 있으면 쿼리 파라미터로 전달하여 캘린더 페이지로 이동
          if (notif.scheduleId) {
            navigate(`/calendar?scheduleId=${notif.scheduleId}`);
          } else {
            navigate("/calendar");
          }
          break;
        case "CHAT":
          // 채팅 알림의 경우 roomId가 있으면 해당 채팅방으로 이동
          if (notif.roomId) {
            navigate("/chat", { state: { selectedRoomId: notif.roomId } });
          } else {
            navigate("/chat");
          }
          break;
        default:
          // 알 수 없는 타입의 경우 홈으로 이동
          navigate("/home");
      }
      
      // 백그라운드에서 알림 목록 새로고침 (서버와 동기화)
      // 팝오버가 열려있을 때만 새로고침 (닫혀있으면 불필요)
      if (open) {
        setTimeout(async () => {
          try {
            await loadNotifications();
          } catch (loadError) {
            console.error("[NotificationPopover] 알림 목록 새로고침 실패:", loadError);
          }
        }, 300); // 약간의 딜레이를 두어 페이지 이동 후 실행
      }
      
      onClose(); // 팝오버 닫기
    } catch (err) {
      console.error("[NotificationPopover] 알림 처리 중 오류 발생:", err);
    }
  };

  const loadNotifications = useCallback(async () => {
    try {
      setLoadingNotifications(true);
      
      // 모든 안읽은 알림을 내림차순으로 한 번에 가져오기
      const allNotifications = await getAllUnreadNotifications();
      
      console.log("🔔 [NotificationPopover] API 응답:", allNotifications);
      console.log("🔔 [NotificationPopover] 응답 타입:", typeof allNotifications);
      console.log("🔔 [NotificationPopover] 배열 여부:", Array.isArray(allNotifications));
      console.log("🔔 [NotificationPopover] 길이:", allNotifications?.length);
      
      if (allNotifications && Array.isArray(allNotifications) && allNotifications.length > 0) {
        console.log("🔔 [NotificationPopover] 첫 번째 알림 샘플:", allNotifications[0]);
        
        // UnreadNotificationListDTO 필드명에 맞춰 매핑
        const sortedNotifications = allNotifications
          .map(notif => {
            // DTO 필드명: notificationId, message, senderName, sentAt, notificationType
            const notificationId = notif.notificationId;
            const message = notif.message;
            const notificationType = notif.notificationType;
            const sentAt = notif.sentAt; // LocalDateTime이 JSON으로 변환된 형태
            const senderName = notif.senderName;
            
            console.log("🔔 [NotificationPopover] 매핑된 알림:", {
              notificationId,
              message,
              notificationType,
              sentAt,
              senderName,
              documentId: notif.documentId,
              boardId: notif.boardId,
              scheduleId: notif.scheduleId,
              원본객체: notif
            });
            
            // scheduleId 매핑 (여러 필드명 확인)
            const scheduleId = notif.scheduleId || notif.schId || notif.schedule_id || null;
            
            return {
              notificationId,
              message,
              notificationType,
              sentAt,
              senderName,
              documentId: notif.documentId || null, // 백엔드에서 documentId 추가됨
              boardId: notif.boardId || null, // 백엔드에서 boardId 추가됨
              scheduleId: scheduleId, // 백엔드에서 scheduleId 추가됨
              roomId: notif.roomId || null, // 백엔드에서 roomId 추가됨 (채팅 알림용)
            };
          })
          .filter(notif => notif.notificationId) // notificationId가 있는 것만 필터링
          .sort((a, b) => {
            const dateA = a.sentAt ? new Date(a.sentAt).getTime() : 0;
            const dateB = b.sentAt ? new Date(b.sentAt).getTime() : 0;
            return dateB - dateA; // 내림차순 (최신순)
          });
        
        console.log("🔔 [NotificationPopover] 최종 알림 목록:", sortedNotifications);
        console.log("🔔 [NotificationPopover] 최종 알림 개수:", sortedNotifications.length);
        
        setUnreadList(sortedNotifications);
        // 알림 개수 변경 콜백 호출 (Topbar의 badge 업데이트용)
        if (onNotificationCountChange) {
          onNotificationCountChange(sortedNotifications.length);
        }
      } else {
        console.warn("🔔 [NotificationPopover] 알림이 없거나 배열이 아님:", allNotifications);
        setUnreadList([]);
        // 알림 개수 변경 콜백 호출
        if (onNotificationCountChange) {
          onNotificationCountChange(0);
        }
      }
    } catch (err) {
      console.error("🔔 [NotificationPopover] 알림 조회 실패:", err);
      console.error("🔔 [NotificationPopover] 에러 상세:", err.response?.data || err.message);
      setUnreadList([]);
      // 알림 개수 변경 콜백 호출
      if (onNotificationCountChange) {
        onNotificationCountChange(0);
      }
    } finally {
      setLoadingNotifications(false);
    }
  }, [onNotificationCountChange]);

  // 모든 알림 읽음 처리 핸들러
  const handleMarkAllAsRead = async () => {
    try {
      // Optimistic Update: 즉시 목록에서 모든 알림 제거
      setUnreadList([]);
      // 알림 개수 변경 콜백 호출
      if (onNotificationCountChange) {
        onNotificationCountChange(0);
      }
      
      // "모두 읽음" 처리 시간 기록
      const currentTimestamp = Date.now();
      setMarkAllAsReadTimestamp(currentTimestamp);
      
      // 모든 알림 읽음 처리 API 호출
      const response = await markAllNotificationsAsRead();
      console.log("[NotificationPopover] 모든 알림 읽음 처리 완료:", response);
      
      // 성공 메시지 표시 (선택 사항)
      if (response?.data?.data) {
        console.log(`[NotificationPopover] ${response.data.data}개의 알림을 읽음 처리했습니다.`);
      }
      
      // 목록을 다시 로드하지 않음 (이미 읽음 처리되었으므로)
      // 사용자가 팝오버를 다시 열면 그때 새로 로드됨
    } catch (err) {
      console.error("[NotificationPopover] 모든 알림 읽음 처리 실패:", err);
      // 실패 시 타임스탬프 초기화 및 목록 다시 로드
      setMarkAllAsReadTimestamp(null);
      await loadNotifications();
    }
  };

  useEffect(() => {
    if (open) {
      // "모두 읽음" 처리 후 1초 이내에는 목록을 다시 로드하지 않음
      // (이미 읽음 처리되었으므로 서버에서 빈 배열이 반환됨)
      if (markAllAsReadTimestamp && (Date.now() - markAllAsReadTimestamp) < 1000) {
        console.log("[NotificationPopover] '모두 읽음' 처리 직후이므로 목록을 다시 로드하지 않습니다.");
        return;
      }
      loadNotifications();
    }
  }, [open, loadNotifications, markAllAsReadTimestamp]);
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      PaperProps={{
        sx: {
          borderRadius: 3,
          width: 360,
          maxHeight: 500,
          boxShadow: 4,
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
          }}
        >
          <Typography variant="h6" fontWeight={600}>
            알림
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {unreadList.length > 0 && (
              <Typography
                variant="caption"
                color="primary"
                sx={{
                  cursor: "pointer",
                  "&:hover": { textDecoration: "underline" },
                }}
                onClick={handleMarkAllAsRead}
              >
                모두 읽음
              </Typography>
            )}
            <IconButton size="small" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
        <Tabs
          value={tab}
          onChange={(e, v) => { setTab(v); if (v === "all") loadAllPage(0); }}
          variant="fullWidth"
          sx={{ minHeight: 36, mb: 1, "& .MuiTab-root": { minHeight: 36, py: 0.5 } }}
        >
          <Tab value="unread" label={`안 읽은 알림${unreadList.length > 0 ? ` (${unreadList.length})` : ""}`} />
          <Tab value="all" label="전체 알림" />
        </Tabs>
        <Divider sx={{ mb: 2 }} />
        {tab === "all" ? (
          <AllNotificationList
            list={allList}
            loading={loadingAll}
            last={allLast}
            onMore={() => loadAllPage(allPage + 1)}
            onClick={handleNotificationClick}
            formatNotificationTime={formatNotificationTime}
            getNotificationTypeColor={getNotificationTypeColor}
          />
        ) : loadingNotifications ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: "center", py: 2 }}
          >
            불러오는 중...
          </Typography>
        ) : unreadList.length > 0 ? (
          <List dense sx={{ maxHeight: 400, overflowY: "auto" }}>
            {unreadList.map((notif) => (
              <ListItem
                key={notif.notificationId}
                sx={{
                  px: 1.5,
                  py: 1,
                  borderRadius: 1,
                  mb: 0.5,
                  cursor: "pointer",
                  "&:hover": { bgcolor: "action.hover" },
                  overflow: "hidden",
                }}
                onClick={() => handleNotificationClick(notif)}
              >
                <Box sx={{ width: "100%", minWidth: 0, overflow: "hidden" }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 0.5,
                    }}
                  >
                    <Chip
                      label={getNotificationTypeLabel(notif.notificationType)}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: "0.7rem",
                        ...getNotificationTypeColor(notif.notificationType),
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {notif.sentAt ? formatNotificationTime(notif.sentAt) : ""}
                    </Typography>
                  </Box>
                  {notif.senderName && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ 
                        display: "block", 
                        mb: 0.5,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "100%"
                      }}
                    >
                      {notif.senderName}
                    </Typography>
                  )}
                  <Typography 
                    variant="body2"
                    sx={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "100%",
                      wordBreak: "break-word"
                    }}
                  >
                    {notif.message || ""}
                  </Typography>
                </Box>
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: "center", py: 3 }}
          >
            알림이 없습니다.
          </Typography>
        )}
      </Box>
    </Popover>
  );
}

/** "전체 알림" 탭: 읽은 알림은 흐리게 + "읽음" 표시, 20개씩 더 보기 */
function AllNotificationList({ list, loading, last, onMore, onClick, formatNotificationTime, getNotificationTypeColor }) {
  if (!loading && list.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 3 }}>
        알림이 없습니다.
      </Typography>
    );
  }
  return (
    <List dense sx={{ maxHeight: 400, overflowY: "auto" }}>
      {list.map((notif) => (
        <ListItem
          key={notif.notificationId}
          sx={{
            px: 1.5, py: 1, borderRadius: 1, mb: 0.5, cursor: "pointer",
            opacity: notif.readYn ? 0.55 : 1,
            "&:hover": { bgcolor: "action.hover" }, overflow: "hidden",
          }}
          onClick={() => onClick(notif)}
        >
          <Box sx={{ width: "100%", minWidth: 0, overflow: "hidden" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
              <Box sx={{ display: "flex", gap: 0.5 }}>
                <Chip
                  label={getNotificationTypeLabel(notif.notificationType)}
                  size="small"
                  sx={{ height: 20, fontSize: "0.7rem", ...getNotificationTypeColor(notif.notificationType) }}
                />
                {notif.readYn && <Chip label="읽음" size="small" variant="outlined" sx={{ height: 20, fontSize: "0.7rem" }} />}
              </Box>
              <Typography variant="caption" color="text.secondary">
                {notif.sentAt ? formatNotificationTime(notif.sentAt) : ""}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
              {notif.message || ""}
            </Typography>
          </Box>
        </ListItem>
      ))}
      {loading && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", py: 1 }}>
          불러오는 중...
        </Typography>
      )}
      {!loading && !last && (
        <Box sx={{ textAlign: "center", py: 1 }}>
          <Button size="small" onClick={onMore}>더 보기</Button>
        </Box>
      )}
    </List>
  );
}
