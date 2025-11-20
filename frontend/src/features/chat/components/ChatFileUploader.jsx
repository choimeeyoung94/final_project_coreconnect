import React, { useState, useRef } from "react";
import { Box, IconButton, Button, Typography, Chip } from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloseIcon from "@mui/icons-material/Close";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

/**
 * ChatFileUploader Component
 * 
 * Multi-file image uploader with preview and size validation
 * - Accepts multiple image files
 * - Shows preview thumbnails
 * - Allows removing individual files before upload
 * - Validates total size <= 50MB client-side
 * - Calls onUpload prop with FormData when user clicks upload
 */
function ChatFileUploader({ onUpload, onCancel }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [totalSize, setTotalSize] = useState(0);
  const fileInputRef = useRef(null);

  const MAX_SIZE = 50 * 1024 * 1024; // 50MB in bytes

  // Handle file selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    
    // Filter for image files only
    const imageFiles = files.filter(file => file.type.startsWith("image/"));
    
    if (imageFiles.length !== files.length) {
      alert("이미지 파일만 업로드할 수 있습니다.");
    }
    
    if (imageFiles.length === 0) return;

    // Calculate new total size
    const newTotalSize = totalSize + imageFiles.reduce((sum, file) => sum + file.size, 0);
    
    if (newTotalSize > MAX_SIZE) {
      alert(`총 파일 크기가 50MB를 초과할 수 없습니다. (현재: ${(newTotalSize / 1024 / 1024).toFixed(2)}MB)`);
      return;
    }

    // Create preview URLs for new files
    const newPreviewUrls = imageFiles.map(file => URL.createObjectURL(file));
    
    // Update state
    setSelectedFiles(prev => [...prev, ...imageFiles]);
    setPreviewUrls(prev => [...prev, ...newPreviewUrls]);
    setTotalSize(newTotalSize);
    
    // Reset file input
    e.target.value = "";
  };

  // Remove a file from selection
  const handleRemoveFile = (index) => {
    // Revoke object URL to prevent memory leak
    URL.revokeObjectURL(previewUrls[index]);
    
    // Calculate new total size
    const removedFileSize = selectedFiles[index].size;
    
    // Remove file and preview
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
    setTotalSize(prev => prev - removedFileSize);
  };

  // Upload files
  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      alert("업로드할 파일을 선택해주세요.");
      return;
    }

    // Create FormData
    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append("files", file);
    });

    try {
      // Call onUpload prop with FormData
      await onUpload(formData);
      
      // Clean up: revoke all object URLs
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      
      // Reset state
      setSelectedFiles([]);
      setPreviewUrls([]);
      setTotalSize(0);
    } catch (error) {
      console.error("파일 업로드 실패:", error);
      alert("파일 업로드에 실패했습니다: " + (error.message || "알 수 없는 오류"));
    }
  };

  // Cancel and clean up
  const handleCancel = () => {
    // Revoke all object URLs
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    
    // Reset state
    setSelectedFiles([]);
    setPreviewUrls([]);
    setTotalSize(0);
    
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <Box sx={{
      p: 2,
      border: "1px solid #e3e8ef",
      borderRadius: 2,
      backgroundColor: "#fff",
      mb: 1
    }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          이미지 업로드
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {(totalSize / 1024 / 1024).toFixed(2)}MB / 50MB
        </Typography>
      </Box>

      {/* File input button */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelect}
      />
      
      <Button
        variant="outlined"
        startIcon={<AttachFileIcon />}
        onClick={() => fileInputRef.current?.click()}
        fullWidth
        sx={{ mb: 2 }}
      >
        이미지 선택
      </Button>

      {/* Preview grid */}
      {selectedFiles.length > 0 && (
        <Box sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
          gap: 1,
          mb: 2,
          maxHeight: 300,
          overflowY: "auto"
        }}>
          {previewUrls.map((url, index) => (
            <Box
              key={index}
              sx={{
                position: "relative",
                paddingTop: "100%",
                borderRadius: 1,
                overflow: "hidden",
                border: "1px solid #e3e8ef"
              }}
            >
              <img
                src={url}
                alt={`Preview ${index + 1}`}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover"
                }}
              />
              <IconButton
                size="small"
                onClick={() => handleRemoveFile(index)}
                sx={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  backgroundColor: "rgba(0,0,0,0.6)",
                  color: "#fff",
                  "&:hover": {
                    backgroundColor: "rgba(0,0,0,0.8)"
                  }
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
              <Chip
                label={`${(selectedFiles[index].size / 1024).toFixed(0)}KB`}
                size="small"
                sx={{
                  position: "absolute",
                  bottom: 4,
                  left: 4,
                  height: 20,
                  fontSize: "0.7rem",
                  backgroundColor: "rgba(0,0,0,0.6)",
                  color: "#fff"
                }}
              />
            </Box>
          ))}
        </Box>
      )}

      {/* Action buttons */}
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button
          variant="contained"
          color="success"
          startIcon={<CloudUploadIcon />}
          onClick={handleUpload}
          disabled={selectedFiles.length === 0}
          fullWidth
        >
          업로드 ({selectedFiles.length}개)
        </Button>
        <Button
          variant="outlined"
          onClick={handleCancel}
          sx={{ minWidth: 100 }}
        >
          취소
        </Button>
      </Box>
    </Box>
  );
}

export default ChatFileUploader;
