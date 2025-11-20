import React from "react";
import { Box, TextField, IconButton, Button } from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import SendIcon from "@mui/icons-material/Send";
import ImageIcon from "@mui/icons-material/Image";

// 채팅 입력창 + 파일업로드
function ChatMessageInputBox({ inputRef, onSend, onFileUpload, socketConnected, onToggleFileUploader, showFileUploader }) {
  return (
    <Box sx={{
      width: "100%",
      display: "flex",
      alignItems: "center",
      px: 4, py: 2.1,
      borderTop: "1px solid #e3e8ef",
      gap: 1,
      background: "#f8fbfd"
    }}>
      <TextField
        inputRef={inputRef}
        variant="outlined"
        size="small"
        placeholder="메시지 입력"
        sx={{ flex: 1, background: "#fff", borderRadius: 2 }}
        onKeyDown={e => {
          if (e.key === "Enter") onSend();
        }}
      />
      
      {/* Multi-image upload button */}
      <IconButton 
        color={showFileUploader ? "success" : "default"}
        onClick={onToggleFileUploader}
        sx={{ bgcolor: showFileUploader ? "#e8f5e9" : "#fff" }}
        title="다중 이미지 업로드"
      >
        <ImageIcon />
      </IconButton>
      
      {/* Single file upload button (existing) */}
      <label htmlFor="chat-file-upload">
        <input
          type="file"
          multiple
          style={{ display: "none" }}
          id="chat-file-upload"
          accept="image/*,application/pdf,application/zip,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.txt,.hwp"
          onChange={onFileUpload}
        />
        <IconButton color="primary" component="span" sx={{ bgcolor: "#fff" }}>
          <AttachFileIcon />
        </IconButton>
      </label>
      <Button
        variant="contained"
        color="success"
        onClick={onSend}
        disabled={!socketConnected}
      >
        <SendIcon />
      </Button>
    </Box>
  );
}
export default ChatMessageInputBox;