import React, { useState } from "react";
import { Box, TextField, IconButton, Button } from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import SendIcon from "@mui/icons-material/Send";
import FilePreviewBox from "./FilePreviewBox";

// 채팅 입력창 + 파일업로드
function ChatMessageInputBox({ inputRef, onSend, onFileUpload, socketConnected }) {
  const [selectedFiles, setSelectedFiles] = useState([]);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // 50MB 제한 체크
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    
    if (totalSize > MAX_SIZE) {
      alert(`총 파일 크기가 50MB를 초과합니다. (현재: ${(totalSize / 1024 / 1024).toFixed(2)}MB)`);
      e.target.value = "";
      return;
    }

    // 개별 파일 크기 체크
    const oversizedFiles = files.filter(file => file.size > MAX_SIZE);
    if (oversizedFiles.length > 0) {
      alert(`일부 파일이 50MB를 초과합니다: ${oversizedFiles.map(f => f.name).join(", ")}`);
      e.target.value = "";
      return;
    }

    setSelectedFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      onFileUpload(selectedFiles);
      setSelectedFiles([]);
    }
  };

  return (
    <Box sx={{
      width: "100%",
      display: "flex",
      flexDirection: "column",
      background: "#f8fbfd"
    }}>
      {/* 파일 미리보기 */}
      {selectedFiles.length > 0 && (
        <FilePreviewBox files={selectedFiles} onRemove={handleRemoveFile} />
      )}
      
      {/* 입력 영역 */}
      <Box sx={{
        display: "flex",
        alignItems: "center",
        px: 4, py: 2.1,
        borderTop: "1px solid #e3e8ef",
        gap: 1,
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
        <label htmlFor="chat-file-upload">
          <input
            type="file"
            multiple
            style={{ display: "none" }}
            id="chat-file-upload"
            // accept 속성 제거: 모든 파일 타입 허용 (PDF, 이미지, 문서, 압축파일 등 모든 파일 업로드 가능)
            onChange={handleFileSelect}
          />
          <IconButton color="primary" component="span" sx={{ bgcolor: "#fff" }}>
            <AttachFileIcon />
          </IconButton>
        </label>
        {selectedFiles.length > 0 && (
          <Button
            variant="outlined"
            color="primary"
            size="small"
            onClick={handleUpload}
            disabled={!socketConnected}
          >
            업로드 ({selectedFiles.length})
          </Button>
        )}
        <Button
          variant="contained"
          color="success"
          onClick={onSend}
          disabled={!socketConnected}
        >
          <SendIcon />
        </Button>
      </Box>
    </Box>
  );
}
export default ChatMessageInputBox;