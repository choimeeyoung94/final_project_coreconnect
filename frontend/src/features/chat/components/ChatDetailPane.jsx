import React, { useRef, useEffect, useState } from "react";
import { Box, Avatar, Typography, IconButton, AvatarGroup, Menu, MenuItem } from "@mui/material";
import GroupIcon from "@mui/icons-material/Group";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import ChatMessageList from "./ChatMessageList";
import ChatMessageInputBox from "./ChatMessageInputBox";
import ChatRoomParticipantsDialog from "./ChatRoomParticipantsDialog";
import ChatRoomInviteDialog from "./ChatRoomInviteDialog";
import { fetchChatRoomUsers, leaveChatRoom } from "../api/ChatRoomApi";

// 오른쪽 채팅방 상세패널(상단 Room, 메시지, 입력창)
function ChatDetailPane({
  selectedRoom, messages,
  unreadCount, firstUnreadIdx, formatTime, // eslint-disable-line no-unused-vars
  inputRef, onSend, onFileUpload, socketConnected,
  onScrollTop, isLoadingMore, hasMoreAbove,
  scrollToUnread = false, onScrollToUnreadComplete,
  onMarkAllAsRead, // 모두 읽음 처리 함수
  onLeaveRoom // 채팅방 나가기 콜백
}) {
  const messagesEndRef = useRef(null);
  const [participantsDialogOpen, setParticipantsDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const menuOpen = Boolean(menuAnchorEl);

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({behavior: "smooth"});
  }, [messages]);

  // 참여자 목록 조회
  useEffect(() => {
    if (selectedRoom?.roomId) {
      fetchChatRoomUsers(selectedRoom.roomId)
        .then((userList) => {
          setParticipants(Array.isArray(userList) ? userList : []);
        })
        .catch((err) => {
          console.error("참여자 목록 조회 실패:", err);
          setParticipants([]);
        });
    }
  }, [selectedRoom?.roomId]);

  if (!selectedRoom) return <Box flex={1} bgcolor="#f8fbfd"></Box>;

  return (
    <Box sx={{
      flex: 1, minWidth: "380px",
      height: "calc(100vh - 56px - 32px)", background: "#f8fbfd",
      display: "flex", flexDirection: "column", borderRadius: 0, boxShadow: "none",
    }}>
      <Box sx={{
        display: "flex", alignItems: "center", pb: 1,
        borderBottom: "1px solid #e3e8ef", background: "#f8fbfd",
        height: 64, position: "relative",
      }}>
        <Typography sx={{
          fontWeight: 700, fontSize: 18, color: "primary.main",
          ml: 2
        }}>
          {selectedRoom.roomName}
        </Typography>
        {/* 참여자 프로필 이미지 표시 (최대 4명) */}
        {participants.length > 0 && (
          <Box sx={{ ml: 2, display: "flex", alignItems: "center" }}>
            <AvatarGroup
              max={4}
              sx={{
                "& .MuiAvatar-root": {
                  width: 28,
                  height: 28,
                  fontSize: 12,
                  border: "2px solid #fff",
                },
              }}
              onClick={() => setParticipantsDialogOpen(true)}
              style={{ cursor: "pointer" }}
            >
              {participants.map((user) => (
                <Avatar
                  key={user.id}
                  src={user.profileImageUrl}
                  sx={{ bgcolor: "primary.main" }}
                >
                  {user.name?.[0]?.toUpperCase() || "?"}
                </Avatar>
              ))}
            </AvatarGroup>
          </Box>
        )}
        <Box sx={{
          position: "absolute",
          top: 0,
          right: 0,
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 1
        }}>
          <IconButton
            onClick={() => setInviteDialogOpen(true)}
            title="참여자 초대"
          >
            <PersonAddIcon />
          </IconButton>
          <IconButton
            onClick={() => setParticipantsDialogOpen(true)}
            title="참여자 목록"
          >
            <GroupIcon />
          </IconButton>
          <IconButton
            onClick={(e) => setMenuAnchorEl(e.currentTarget)}
            title="더보기"
          >
            <MoreVertIcon />
          </IconButton>
          <Menu
            anchorEl={menuAnchorEl}
            open={menuOpen}
            onClose={() => setMenuAnchorEl(null)}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem
              onClick={async () => {
                setMenuAnchorEl(null);
                if (selectedRoom?.roomId && onLeaveRoom) {
                  try {
                    await leaveChatRoom(selectedRoom.roomId);
                    onLeaveRoom(selectedRoom.roomId);
                  } catch (error) {
                    console.error("채팅방 나가기 실패:", error);
                    alert("채팅방 나가기에 실패했습니다: " + (error.response?.data?.message || error.message));
                  }
                }
              }}
              sx={{ color: 'error.main' }}
            >
              <ExitToAppIcon sx={{ mr: 1, fontSize: 20 }} />
              채팅방 나가기
            </MenuItem>
          </Menu>
        </Box>
      </Box>
      <ChatMessageList
        messages={messages}
        roomType={selectedRoom.roomType || "group"}
        onLoadMore={onScrollTop}
        hasMoreAbove={hasMoreAbove}
        loadingAbove={isLoadingMore}
        scrollToUnread={scrollToUnread}
        onScrollToUnreadComplete={onScrollToUnreadComplete}
      />
      <div ref={messagesEndRef} />
      <ChatMessageInputBox
        inputRef={inputRef}
        onSend={onSend}
        onFileUpload={onFileUpload}
        socketConnected={socketConnected}
      />
      
      {/* 채팅방 참여자 목록 다이얼로그 */}
      <ChatRoomParticipantsDialog
        open={participantsDialogOpen}
        onClose={() => setParticipantsDialogOpen(false)}
        roomId={selectedRoom?.roomId || selectedRoom?.id}
      />
      
      {/* 채팅방 참여자 초대 다이얼로그 */}
      <ChatRoomInviteDialog
        open={inviteDialogOpen}
        onClose={() => setInviteDialogOpen(false)}
        roomId={selectedRoom?.roomId || selectedRoom?.id}
        onInviteSuccess={() => {
          // 초대 성공 후 참여자 목록 새로고침
          if (selectedRoom?.roomId) {
            fetchChatRoomUsers(selectedRoom.roomId)
              .then((userList) => {
                setParticipants(Array.isArray(userList) ? userList : []);
              })
              .catch((err) => {
                console.error("참여자 목록 조회 실패:", err);
              });
          }
        }}
      />
    </Box>
  );
}
export default ChatDetailPane;