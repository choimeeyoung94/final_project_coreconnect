import React, { useState, useEffect } from "react";
import {
  Box,
  IconButton,
  Popover,
  Typography,
  Divider,
  List,
  ListItem,
  Chip,
  Button,
  Badge,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { formatTime } from "../../../utils/TimeUtils";
import { useNavigate } from "react-router-dom";
import { markRoomMessagesAsRead } from "../api/ChatRoomApi";
import { getAllUnreadNotifications } from "../../notification/api/notificationAPI";

export default function ChatPopover({
  anchorEl,
  open,
  onClose,
  roomList = [],
  onRefreshRoomList, // 채팅방 목록 새로고침 함수
  onRefreshNotificationSummary, // 알림 개수 새로고침 함수
}) {
  const navigate = useNavigate();
  const [unreadRooms, setUnreadRooms] = useState([]);
  const [inviteNotifications, setInviteNotifications] = useState([]);

  // 읽지 않은 채팅방 필터링 및 정렬
  useEffect(() => {
    if (open && roomList) {
      const filtered = roomList
        .filter((room) => room && room.unreadCount > 0)
        .map((room) => ({
          roomId: room.roomId,
          roomName: room.roomName || "채팅방",
          unreadCount: room.unreadCount || 0,
          lastMessageContent: room.lastMessageContent || "",
          lastMessageTime: room.lasMessageTime || room.sendAt || null,
          lastSenderName: room.lastSenderName || "",
          lastMessageFileYn: room.lastMessageFileYn || false,
        }))
        .sort((a, b) => {
          // 최신 메시지 시간 기준 내림차순 정렬
          const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
          const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
          return timeB - timeA;
        });
      setUnreadRooms(filtered);
    }
  }, [open, roomList]);

  // 초대 알림 조회
  useEffect(() => {
    if (open) {
      const loadInviteNotifications = async () => {
        try {
          const allNotifications = await getAllUnreadNotifications();
          // CHAT 타입이고 "초대되었습니다" 메시지를 포함하는 알림 필터링
          const invites = allNotifications
            .filter((notif) => {
              const type = notif.notificationType?.toUpperCase();
              const message = notif.message || "";
              return type === "CHAT" && message.includes("초대되었습니다");
            })
            .map((notif) => ({
              notificationId: notif.notificationId,
              message: notif.message || "",
              roomId: notif.roomId || null,
              sentAt: notif.sentAt || null,
              senderName: notif.senderName || "",
            }))
            .sort((a, b) => {
              const timeA = a.sentAt ? new Date(a.sentAt).getTime() : 0;
              const timeB = b.sentAt ? new Date(b.sentAt).getTime() : 0;
              return timeB - timeA; // 최신순
            });
          setInviteNotifications(invites);
        } catch (error) {
          console.error("초대 알림 조회 실패:", error);
          setInviteNotifications([]);
        }
      };
      loadInviteNotifications();
    }
  }, [open]);

  const handleGoToRoom = async (roomId) => {
    // 선택하려는 채팅방 정보 확인
    const selectedRoom = roomList.find((room) => room && room.roomId === roomId);
    
    // 안읽은 메시지가 있는 채팅방을 선택한 경우 읽음 처리
    if (selectedRoom && selectedRoom.unreadCount > 0) {
      try {
        await markRoomMessagesAsRead(roomId);
        // 약간의 지연을 두어 DB 반영 시간 확보
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // 채팅방 목록 새로고침 (알림 팝업의 unreadRooms도 자동 업데이트됨)
        if (onRefreshRoomList) {
          await onRefreshRoomList();
        }
        
        // 알림 개수 새로고침 (종모양 아이콘의 숫자 업데이트)
        if (onRefreshNotificationSummary) {
          await onRefreshNotificationSummary();
        }
        
        // 팝업 내부의 unreadRooms 상태도 업데이트 (즉시 UI 반영)
        setUnreadRooms((prev) => prev.filter((room) => room.roomId !== roomId));
      } catch (error) {
        console.error("채팅방 읽음 처리 실패:", error);
      }
    }
    
    onClose();
    // 채팅 페이지로 이동하고 해당 채팅방 선택
    navigate("/chat", { state: { selectedRoomId: roomId } });
  };

  const handleGoToChatList = () => {
    onClose();
    // 채팅 페이지로 이동 (특정 채팅방 선택 없이)
    navigate("/chat");
  };

  // 모두 읽음 처리
  const handleMarkAllAsRead = async () => {
    if (unreadRooms.length === 0) return;

    try {
      // 모든 안읽은 채팅방의 메시지를 읽음 처리
      const promises = unreadRooms.map((room) => 
        markRoomMessagesAsRead(room.roomId).catch((error) => {
          console.error(`채팅방 ${room.roomId} 읽음 처리 실패:`, error);
          // 개별 실패해도 계속 진행
        })
      );

      // 모든 채팅방 읽음 처리 완료 대기
      await Promise.all(promises);

      // 약간의 지연을 두어 DB 반영 시간 확보
      await new Promise(resolve => setTimeout(resolve, 500));

      // 채팅방 목록 새로고침 (뱃지 업데이트)
      if (onRefreshRoomList) {
        await onRefreshRoomList();
      }

      // 알림 개수 새로고침 (종모양 아이콘의 숫자 업데이트)
      if (onRefreshNotificationSummary) {
        await onRefreshNotificationSummary();
      }

      // 팝업 내부의 unreadRooms 상태도 업데이트 (즉시 UI 반영)
      setUnreadRooms([]);

      console.log("모든 채팅방 메시지 읽음 처리 완료 - 채팅방 목록 및 알림 개수 업데이트 완료");
    } catch (error) {
      console.error("모두 읽음 처리 중 오류:", error);
    }
  };

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
            채팅
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Divider sx={{ mb: 2 }} />
        {(unreadRooms.length > 0 || inviteNotifications.length > 0) ? (
          <>
            <List dense sx={{ maxHeight: 400, overflowY: "auto", mb: 2 }}>
              {/* 초대 알림 표시 */}
              {inviteNotifications.map((invite) => (
                <ListItem
                  key={`invite-${invite.notificationId}`}
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderRadius: 1,
                    mb: 0.5,
                    cursor: "pointer",
                    bgcolor: "#e3f2fd",
                    "&:hover": { bgcolor: "#bbdefb" },
                  }}
                  onClick={() => {
                    if (invite.roomId) {
                      handleGoToRoom(invite.roomId);
                    }
                  }}
                >
                  <Box sx={{ width: "100%", display: "flex", alignItems: "center", gap: 1 }}>
                    <PersonAddIcon sx={{ fontSize: 18, color: "#1976d2" }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, color: "#1976d2" }}>
                        {invite.message}
                      </Typography>
                      {invite.sentAt && (
                        <Typography variant="caption" color="text.secondary">
                          {formatTime(invite.sentAt)}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </ListItem>
              ))}
              {/* 초대 알림과 안읽은 메시지 구분선 */}
              {inviteNotifications.length > 0 && unreadRooms.length > 0 && (
                <Divider sx={{ my: 1 }} />
              )}
              {/* 안읽은 메시지가 있는 채팅방 표시 */}
              {unreadRooms.map((room) => (
                <ListItem
                  key={room.roomId}
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderRadius: 1,
                    mb: 0.5,
                    cursor: "pointer",
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                  onClick={() => handleGoToRoom(room.roomId)}
                >
                  <Box sx={{ width: "100%" }}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 0.5,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Chip
                          label={room.roomName}
                          size="small"
                          variant="outlined"
                          sx={{ height: 20, fontSize: "0.7rem" }}
                        />
                        {/* 안읽은 메시지 수 표시 (빨간색 배지) */}
                        {room.unreadCount > 0 && (
                          <Badge
                            badgeContent={room.unreadCount}
                            sx={{
                              "& .MuiBadge-badge": {
                                backgroundColor: "#d32f2f",
                                color: "#fff",
                                fontSize: "0.7rem",
                                fontWeight: 600,
                                minWidth: "18px",
                                height: "18px",
                                padding: "0 4px",
                              },
                            }}
                          >
                            <Box sx={{ width: 0, height: 0 }} />
                          </Badge>
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {room.lastMessageTime ? formatTime(room.lastMessageTime) : ""}
                      </Typography>
                    </Box>
                    {room.lastSenderName && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mb: 0.5 }}
                      >
                        {room.lastSenderName}
                      </Typography>
                    )}
                    <Typography variant="body2">
                      {room.lastMessageFileYn ? "이미지 업로드" : (room.lastMessageContent || "메시지가 없습니다.")}
                    </Typography>
                  </Box>
                </ListItem>
              ))}
            </List>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, alignItems: "center" }}>
              {/* 모두 읽음 버튼 (안읽은 메시지만) */}
              {unreadRooms.length > 0 && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<DoneAllIcon fontSize="small" />}
                  onClick={handleMarkAllAsRead}
                  sx={{
                    textTransform: "none",
                    fontSize: "0.875rem",
                    bgcolor: "#d32f2f",
                    "&:hover": {
                      bgcolor: "#b71c1c",
                    },
                    width: "100%",
                  }}
                >
                  모두 읽음 ({unreadRooms.reduce((sum, room) => sum + (room.unreadCount || 0), 0)})
                </Button>
              )}
              <Button
                variant="outlined"
                size="small"
                endIcon={<ArrowForwardIcon fontSize="small" />}
                onClick={handleGoToChatList}
                sx={{
                  textTransform: "none",
                  fontSize: "0.875rem",
                  width: "100%",
                }}
              >
                채팅 목록으로 가기
              </Button>
            </Box>
          </>
        ) : (
          <>
            {inviteNotifications.length > 0 ? (
              <>
                <List dense sx={{ maxHeight: 400, overflowY: "auto", mb: 2 }}>
                  {inviteNotifications.map((invite) => (
                    <ListItem
                      key={`invite-${invite.notificationId}`}
                      sx={{
                        px: 1.5,
                        py: 1,
                        borderRadius: 1,
                        mb: 0.5,
                        cursor: "pointer",
                        bgcolor: "#e3f2fd",
                        "&:hover": { bgcolor: "#bbdefb" },
                      }}
                      onClick={() => {
                        if (invite.roomId) {
                          handleGoToRoom(invite.roomId);
                        }
                      }}
                    >
                      <Box sx={{ width: "100%", display: "flex", alignItems: "center", gap: 1 }}>
                        <PersonAddIcon sx={{ fontSize: 18, color: "#1976d2" }} />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500, color: "#1976d2" }}>
                            {invite.message}
                          </Typography>
                          {invite.sentAt && (
                            <Typography variant="caption" color="text.secondary">
                              {formatTime(invite.sentAt)}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </ListItem>
                  ))}
                </List>
                <Divider sx={{ mb: 2 }} />
              </>
            ) : (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: "center", py: 3 }}
              >
                읽지 않은 메시지가 없습니다.
              </Typography>
            )}
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: "flex", justifyContent: "center" }}>
              <Button
                variant="outlined"
                size="small"
                endIcon={<ArrowForwardIcon fontSize="small" />}
                onClick={handleGoToChatList}
                sx={{
                  textTransform: "none",
                  fontSize: "0.875rem",
                }}
              >
                채팅 목록으로 이동
              </Button>
            </Box>
          </>
        )}
      </Box>
    </Popover>
  );
}

