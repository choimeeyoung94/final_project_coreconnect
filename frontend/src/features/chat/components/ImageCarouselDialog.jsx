import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  IconButton,
  Box,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

/**
 * ImageCarouselDialog - 이미지 캐러셀 뷰어 다이얼로그
 * @param {boolean} open - 다이얼로그 열림 상태
 * @param {Function} onClose - 다이얼로그 닫기 콜백
 * @param {Array} images - 이미지 URL 배열
 * @param {number} initialIndex - 초기 이미지 인덱스
 */
function ImageCarouselDialog({ open, onClose, images = [], initialIndex = 0 }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // 다이얼로그가 열릴 때 초기 인덱스로 설정
  React.useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
    }
  }, [open, initialIndex]);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowLeft") {
      handlePrevious();
    } else if (event.key === "ArrowRight") {
      handleNext();
    } else if (event.key === "Escape") {
      onClose();
    }
  };

  if (!images || images.length === 0) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      onKeyDown={handleKeyDown}
      PaperProps={{
        sx: {
          bgcolor: "rgba(0, 0, 0, 0.95)",
          boxShadow: "none",
          minHeight: "80vh",
        },
      }}
    >
      {/* 닫기 버튼 */}
      <IconButton
        onClick={onClose}
        sx={{
          position: "absolute",
          top: 16,
          right: 16,
          color: "white",
          bgcolor: "rgba(255, 255, 255, 0.1)",
          "&:hover": {
            bgcolor: "rgba(255, 255, 255, 0.2)",
          },
          zIndex: 1,
        }}
      >
        <CloseIcon />
      </IconButton>

      <DialogContent
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          p: 4,
          position: "relative",
        }}
      >
        {/* 이미지 카운터 */}
        <Typography
          variant="body2"
          sx={{
            position: "absolute",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            color: "white",
            bgcolor: "rgba(0, 0, 0, 0.5)",
            px: 2,
            py: 0.5,
            borderRadius: 2,
          }}
        >
          {currentIndex + 1} / {images.length}
        </Typography>

        {/* 이미지 표시 영역 */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            position: "relative",
          }}
        >
          {/* 이전 버튼 */}
          {images.length > 1 && (
            <IconButton
              onClick={handlePrevious}
              sx={{
                position: "absolute",
                left: 16,
                color: "white",
                bgcolor: "rgba(255, 255, 255, 0.1)",
                "&:hover": {
                  bgcolor: "rgba(255, 255, 255, 0.2)",
                },
              }}
            >
              <ArrowBackIosNewIcon />
            </IconButton>
          )}

          {/* 이미지 */}
          <Box
            component="img"
            src={images[currentIndex]}
            alt={`Image ${currentIndex + 1}`}
            sx={{
              maxWidth: "100%",
              maxHeight: "70vh",
              objectFit: "contain",
              userSelect: "none",
            }}
          />

          {/* 다음 버튼 */}
          {images.length > 1 && (
            <IconButton
              onClick={handleNext}
              sx={{
                position: "absolute",
                right: 16,
                color: "white",
                bgcolor: "rgba(255, 255, 255, 0.1)",
                "&:hover": {
                  bgcolor: "rgba(255, 255, 255, 0.2)",
                },
              }}
            >
              <ArrowForwardIosIcon />
            </IconButton>
          )}
        </Box>

        {/* 썸네일 (선택사항) */}
        {images.length > 1 && (
          <Box
            sx={{
              display: "flex",
              gap: 1,
              mt: 2,
              overflowX: "auto",
              maxWidth: "100%",
              pb: 1,
            }}
          >
            {images.map((img, index) => (
              <Box
                key={index}
                component="img"
                src={img}
                alt={`Thumbnail ${index + 1}`}
                onClick={() => setCurrentIndex(index)}
                sx={{
                  width: 60,
                  height: 60,
                  objectFit: "cover",
                  cursor: "pointer",
                  border:
                    index === currentIndex
                      ? "2px solid white"
                      : "2px solid transparent",
                  borderRadius: 1,
                  opacity: index === currentIndex ? 1 : 0.6,
                  transition: "all 0.2s",
                  "&:hover": {
                    opacity: 1,
                  },
                }}
              />
            ))}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ImageCarouselDialog;
