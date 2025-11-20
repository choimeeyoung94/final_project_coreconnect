import React, { useRef, useEffect, useState } from "react";
import { Box, Avatar, Typography, IconButton } from "@mui/material";
import PhoneIcon from "@mui/icons-material/Phone";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import GroupIcon from "@mui/icons-material/Group";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ChatMessageList from "./ChatMessageList";
import ChatMessageInputBox from "./ChatMessageInputBox";
import ChatRoomParticipantsDialog from "./ChatRoomParticipantsDialog";
import ChatFileUploader from "./ChatFileUploader";

// 오른쪽 채팅방 상세패널(상단 Room, 메시지, 입력창)
function ChatDetailPane({
  selectedRoom, messages,
  unreadCount, firstUnreadIdx, formatTime, // eslint-disable-line no-unused-vars
  inputRef, onSend, onFileUpload, socketConnected,
  onScrollTop, isLoadingMore, hasMoreAbove,
  onMultipleFilesUpload // New prop for handling multiple file uploads
}) {
  const messagesEndRef = useRef(null);
  const [participantsDialogOpen, setParticipantsDialogOpen] = useState(false);
  const [showFileUploader, setShowFileUploader] = useState(false);

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({behavior: "smooth"});
  }, [messages]);

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
        <Avatar sx={{
          bgcolor: "#10c16d",
          mr: 2, width: 33, height: 33, ml: 2
        }}>{selectedRoom.roomName?.[0]?.toUpperCase()}
        </Avatar>
        <Typography sx={{
          fontWeight: 700, fontSize: 18, color: "#1aaf54",
        }}>
          {selectedRoom.roomName}
        </Typography>
        <Box sx={{
          position: "absolute",
          top: 0,
          right: 0,
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 2
        }}>
          <IconButton><PhoneIcon /></IconButton>
          <IconButton><VideoCallIcon /></IconButton>
          <IconButton
            onClick={() => setParticipantsDialogOpen(true)}
            title="참여자 목록"
          >
            <GroupIcon />
          </IconButton>
          <IconButton><MoreVertIcon /></IconButton>
        </Box>
      </Box>
      <ChatMessageList
        messages={messages}
        roomType={selectedRoom.roomType || "group"}
        onLoadMore={onScrollTop}
        hasMoreAbove={hasMoreAbove}
        loadingAbove={isLoadingMore}
      />
      <div ref={messagesEndRef} />
      
      {/* Show file uploader when toggled */}
      {showFileUploader && (
        <ChatFileUploader
          onUpload={onMultipleFilesUpload}
          onCancel={() => setShowFileUploader(false)}
        />
      )}
      
      <ChatMessageInputBox
        inputRef={inputRef}
        onSend={onSend}
        onFileUpload={onFileUpload}
        socketConnected={socketConnected}
        onToggleFileUploader={() => setShowFileUploader(prev => !prev)}
        showFileUploader={showFileUploader}
      />
      
      {/* 채팅방 참여자 목록 다이얼로그 */}
      <ChatRoomParticipantsDialog
        open={participantsDialogOpen}
        onClose={() => setParticipantsDialogOpen(false)}
        roomId={selectedRoom?.roomId || selectedRoom?.id}
      />
    </Box>
  );
}
export default ChatDetailPane;