import React, { useRef, useEffect, useState } from "react";
import { Box, Avatar, Typography, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import PhoneIcon from "@mui/icons-material/Phone";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import GroupIcon from "@mui/icons-material/Group";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
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
  onMultiFileUpload // 새로운 prop: 다중 파일 업로드 핸들러
}) {
  const messagesEndRef = useRef(null);
  const [participantsDialogOpen, setParticipantsDialogOpen] = useState(false);
  const [fileUploaderOpen, setFileUploaderOpen] = useState(false);
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [carouselImages, setCarouselImages] = useState([]);
  const [carouselInitialIndex, setCarouselInitialIndex] = useState(0);

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({behavior: "smooth"});
  }, [messages]);

  const handleOpenFileUploader = () => {
    setFileUploaderOpen(true);
  };

  const handleCloseFileUploader = () => {
    setFileUploaderOpen(false);
  };

  const handleFileUpload = async (formData) => {
    if (onMultiFileUpload) {
      await onMultiFileUpload(formData);
      handleCloseFileUploader();
    }
  };

  const handleOpenCarousel = (images, initialIndex = 0) => {
    setCarouselImages(images);
    setCarouselInitialIndex(initialIndex);
    setCarouselOpen(true);
  };

  const handleCloseCarousel = () => {
    setCarouselOpen(false);
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
        
        {/* 참여자 아바타 표시 (방 이름 옆) */}
        <Box sx={{ ml: 2 }}>
          <RoomParticipantAvatars 
            roomId={selectedRoom?.roomId || selectedRoom?.id} 
            maxAvatars={3}
          />
        </Box>
        
        <Box sx={{
          position: "absolute",
          top: 0,
          right: 0,
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 2
        }}>
          <IconButton
            onClick={handleOpenFileUploader}
            title="다중 이미지 업로드"
          >
            <AddPhotoAlternateIcon />
          </IconButton>
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
        onImageClick={handleOpenCarousel}
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

      {/* 다중 파일 업로더 다이얼로그 */}
      <Dialog 
        open={fileUploaderOpen} 
        onClose={handleCloseFileUploader}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>이미지 업로드</DialogTitle>
        <DialogContent>
          <ChatFileUploader onUpload={handleFileUpload} />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseFileUploader}>닫기</Button>
        </DialogActions>
      </Dialog>

      {/* 이미지 캐러셀 다이얼로그 */}
      <ImageCarouselDialog
        open={carouselOpen}
        onClose={handleCloseCarousel}
        images={carouselImages}
        initialIndex={carouselInitialIndex}
      />
    </Box>
  );
}
export default ChatDetailPane;