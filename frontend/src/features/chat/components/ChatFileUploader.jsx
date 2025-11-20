import React, { useState, useRef } from "react";
import {
  Box,
  Button,
  IconButton,
  Typography,
  Paper,
  Grid,
  Alert,
} from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloseIcon from "@mui/icons-material/Close";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

/**
 * ChatFileUploader Component
 * 
 * Multi-file image upload component with preview and total size validation
 * - Supports multiple image selection
 * - Shows image previews with object URLs
 * - Allows removing individual files before upload
 * - Enforces 50MB total size limit client-side
 * - Calls onUpload callback with FormData on successful upload
 */
function ChatFileUploader({ onUpload, disabled = false }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB in bytes

  // Calculate total size of selected files
  const calculateTotalSize = (files) => {
    return files.reduce((total, file) => total + file.size, 0);
  };

  // Format bytes to human-readable string
  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setError("");

    // Validate file types (images only)
    const invalidFiles = files.filter(
      (file) => !file.type.startsWith("image/")
    );
    if (invalidFiles.length > 0) {
      setError("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    // Validate total size
    const newFiles = [...selectedFiles, ...files];
    const totalSize = calculateTotalSize(newFiles);
    if (totalSize > MAX_TOTAL_SIZE) {
      setError(
        `총 파일 크기가 50MB를 초과합니다. 현재: ${formatBytes(totalSize)}`
      );
      return;
    }

    // Create preview URLs
    const newPreviews = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
    }));

    setSelectedFiles(newFiles);
    setPreviews([...previews, ...newPreviews]);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Remove a file from selection
  const handleRemoveFile = (index) => {
    // Revoke object URL to prevent memory leak
    URL.revokeObjectURL(previews[index].url);

    const newPreviews = previews.filter((_, i) => i !== index);
    const newFiles = selectedFiles.filter((_, i) => i !== index);

    setPreviews(newPreviews);
    setSelectedFiles(newFiles);
    setError("");
  };

  // Handle upload
  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError("업로드할 파일을 선택해주세요.");
      return;
    }

    // Create FormData
    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append("files", file);
    });

    try {
      // Call parent's upload handler
      await onUpload(formData);

      // Clean up on success
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
      setPreviews([]);
      setSelectedFiles([]);
      setError("");
    } catch (err) {
      setError(err.message || "업로드 중 오류가 발생했습니다.");
    }
  };

  // Cancel and clear all
  const handleCancel = () => {
    previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    setPreviews([]);
    setSelectedFiles([]);
    setError("");
  };

  // Clean up on unmount
  React.useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, []);

  const totalSize = calculateTotalSize(selectedFiles);
  const hasFiles = selectedFiles.length > 0;

  return (
    <Box sx={{ width: "100%", p: 2 }}>
      {/* File Selection Button */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileSelect}
          disabled={disabled}
        />
        <Button
          variant="outlined"
          startIcon={<AttachFileIcon />}
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
        >
          이미지 선택
        </Button>
        {hasFiles && (
          <Typography variant="body2" color="text.secondary">
            {selectedFiles.length}개 파일, 총 {formatBytes(totalSize)} / 50MB
          </Typography>
        )}
      </Box>

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Preview Grid */}
      {hasFiles && (
        <Box>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {previews.map((preview, index) => (
              <Grid item xs={6} sm={4} md={3} key={index}>
                <Paper
                  elevation={2}
                  sx={{
                    position: "relative",
                    paddingTop: "100%",
                    overflow: "hidden",
                    borderRadius: 1,
                  }}
                >
                  <Box
                    component="img"
                    src={preview.url}
                    alt={preview.name}
                    sx={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveFile(index)}
                    sx={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      bgcolor: "rgba(0, 0, 0, 0.6)",
                      color: "white",
                      "&:hover": {
                        bgcolor: "rgba(0, 0, 0, 0.8)",
                      },
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                  <Box
                    sx={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      bgcolor: "rgba(0, 0, 0, 0.6)",
                      color: "white",
                      p: 0.5,
                    }}
                  >
                    <Typography variant="caption" noWrap>
                      {preview.name}
                    </Typography>
                    <Typography variant="caption" display="block">
                      {formatBytes(preview.size)}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>

          {/* Action Buttons */}
          <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
            <Button variant="outlined" onClick={handleCancel}>
              취소
            </Button>
            <Button
              variant="contained"
              color="success"
              startIcon={<CloudUploadIcon />}
              onClick={handleUpload}
              disabled={disabled || !hasFiles}
            >
              업로드 ({selectedFiles.length}개)
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default ChatFileUploader;
