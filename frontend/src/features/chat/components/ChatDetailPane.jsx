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
import ImageCarouselDialog from "./ImageCarouselDialog";
import RoomParticipantAvatars from "./RoomParticipantAvatars";

// 오른쪽 채팅방 상세패널(상단 Room, 메시지, 입력창)
function ChatDetailPane({
  selectedRoom, messages,
  unreadCount, firstUnreadIdx, formatTime, // eslint-disable-line no-unused-vars
  inputRef, onSend, onFileUpload, socketConnected,
  onScrollTop, isLoadingMore, hasMoreAbove,
  onMultiFileUpload, // 새로운 prop: 다중 파일 업로드 핸들러
  roomParticipants // 새로운 prop: 채팅방 참여자 목록 (optional)
}) {
  const messagesEndRef = useRef(null);
  const [participantsDialogOpen, setParticipantsDialogOpen] = useState(false);
  const [showFileUploader, setShowFileUploader] = useState(false);
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [carouselImages, setCarouselImages] = useState([]);
  const [carouselInitialIndex, setCarouselInitialIndex] = useState(0);

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({behavior: "smooth"});
  }, [messages]);

  // 다중 파일 업로드 핸들러
  const handleMultiFileUpload = async (formData) => {
    if (!onMultiFileUpload) {
      console.warn("onMultiFileUpload handler not provided");
      return;
    }
    
    try {
      await onMultiFileUpload(formData);
      setShowFileUploader(false);
    } catch (error) {
      console.error("Multi-file upload failed:", error);
      alert("파일 업로드에 실패했습니다: " + error.message);
    }
  };

  // 이미지 캐러셀 열기
  const handleOpenImageCarousel = (imageUrl, allImages = [], initialIndex = 0) => {
    setCarouselImages(allImages);
    setCarouselInitialIndex(initialIndex);
    setCarouselOpen(true);
  };

  // 파일 다운로드 핸들러
  const handleDownloadFile = async (fileId) => {
    const token = localStorage.getItem("accessToken");
    try {
      const response = await fetch(`/api/v1/chat/files/${fileId}/download`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error("파일 다운로드 실패");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-file-${fileId}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
      alert("파일 다운로드에 실패했습니다.");
    }
  };

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
        
        {/* 참여자 아바타 (선택사항) */}
        {roomParticipants && roomParticipants.length > 0 && (
          <Box sx={{ ml: 2 }}>
            <RoomParticipantAvatars
              participants={roomParticipants}
              onClick={() => setParticipantsDialogOpen(true)}
              max={4}
            />
          </Box>
        )}
        
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
        onImageClick={handleOpenImageCarousel} // 이미지 클릭 핸들러 전달 (선택사항)
      />
      <div ref={messagesEndRef} />
      
      {/* 다중 파일 업로더 (조건부 표시) */}
      {showFileUploader && onMultiFileUpload && (
        <ChatFileUploader
          onUpload={handleMultiFileUpload}
          onCancel={() => setShowFileUploader(false)}
        />
      )}
      
      <ChatMessageInputBox
        inputRef={inputRef}
        onSend={onSend}
        onFileUpload={onFileUpload}
        socketConnected={socketConnected}
        onToggleFileUploader={() => setShowFileUploader(!showFileUploader)} // 파일 업로더 토글 (선택사항)
        showMultiFileButton={!!onMultiFileUpload} // 다중 파일 버튼 표시 여부
      />
      
      {/* 채팅방 참여자 목록 다이얼로그 */}
      <ChatRoomParticipantsDialog
        open={participantsDialogOpen}
        onClose={() => setParticipantsDialogOpen(false)}
        roomId={selectedRoom?.roomId || selectedRoom?.id}
      />
      
      {/* 이미지 캐러셀 다이얼로그 */}
      <ImageCarouselDialog
        open={carouselOpen}
        onClose={() => setCarouselOpen(false)}
        images={carouselImages}
        initialIndex={carouselInitialIndex}
        onDownload={handleDownloadFile}
      />
    </Box>
  );
}
export default ChatDetailPane;