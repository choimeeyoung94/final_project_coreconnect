import React, { useState, useRef } from "react";
import {
  Box,
  Button,
  IconButton,
  Typography,
  Grid,
  Card,
  CardMedia,
  CardActions,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";

const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * ChatFileUploader - 다중 이미지 선택 및 미리보기 컴포넌트
 * @param {Function} onUpload - 업로드 콜백 함수 (FormData를 인자로 받음)
 */
function ChatFileUploader({ onUpload }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    
    // 이미지 파일만 필터링
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    
    if (imageFiles.length === 0) {
      alert("이미지 파일만 업로드 가능합니다.");
      return;
    }

    // 기존 파일과 합쳐서 총 크기 체크
    const newTotalSize = [...selectedFiles, ...imageFiles].reduce(
      (sum, file) => sum + file.size,
      0
    );

    if (newTotalSize > MAX_TOTAL_SIZE) {
      alert("총 파일 크기가 50MB를 초과할 수 없습니다.");
      return;
    }

    // 미리보기 URL 생성
    const newPreviews = imageFiles.map((file) => URL.createObjectURL(file));

    setSelectedFiles([...selectedFiles, ...imageFiles]);
    setPreviewUrls([...previewUrls, ...newPreviews]);

    // input 초기화
    event.target.value = "";
  };

  const handleRemoveFile = (index) => {
    // 미리보기 URL 해제
    URL.revokeObjectURL(previewUrls[index]);

    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const newPreviews = previewUrls.filter((_, i) => i !== index);

    setSelectedFiles(newFiles);
    setPreviewUrls(newPreviews);
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0) {
      alert("업로드할 파일을 선택해주세요.");
      return;
    }

    // FormData 생성
    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append("files", file);
    });

    // 업로드 콜백 호출
    onUpload(formData);

    // 업로드 후 초기화
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setSelectedFiles([]);
    setPreviewUrls([]);
  };

  const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
  const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

  return (
    <Box sx={{ p: 2 }}>
      {/* 파일 선택 버튼 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={handleFileSelect}
      />
      
      <Button
        variant="outlined"
        startIcon={<AddPhotoAlternateIcon />}
        onClick={() => fileInputRef.current.click()}
        fullWidth
        sx={{ mb: 2 }}
      >
        이미지 선택
      </Button>

      {/* 미리보기 그리드 */}
      {selectedFiles.length > 0 && (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            선택된 파일: {selectedFiles.length}개 (총 {totalSizeMB}MB / 50MB)
          </Typography>
          
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {previewUrls.map((url, index) => (
              <Grid item xs={6} sm={4} md={3} key={index}>
                <Card sx={{ position: "relative" }}>
                  <CardMedia
                    component="img"
                    height="140"
                    image={url}
                    alt={selectedFiles[index].name}
                    sx={{ objectFit: "cover" }}
                  />
                  <CardActions sx={{ justifyContent: "space-between", p: 1 }}>
                    <Typography
                      variant="caption"
                      noWrap
                      sx={{ flex: 1, mr: 1 }}
                    >
                      {selectedFiles[index].name}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveFile(index)}
                      sx={{
                        bgcolor: "rgba(0,0,0,0.5)",
                        color: "white",
                        "&:hover": { bgcolor: "rgba(0,0,0,0.7)" },
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* 업로드 버튼 */}
          <Button
            variant="contained"
            color="primary"
            onClick={handleUpload}
            fullWidth
            disabled={totalSize > MAX_TOTAL_SIZE}
          >
            {totalSize > MAX_TOTAL_SIZE
              ? "파일 크기가 너무 큽니다"
              : `${selectedFiles.length}개 파일 업로드`}
          </Button>
        </>
      )}
    </Box>
  );
}

export default ChatFileUploader;
