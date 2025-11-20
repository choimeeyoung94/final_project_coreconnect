import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  IconButton,
  Box,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import DownloadIcon from '@mui/icons-material/Download';

/**
 * ImageCarouselDialog Component
 * 
 * 전체 화면 이미지 캐러셀 뷰어
 * 이미지 목록을 슬라이드로 표시하고 이전/다음 네비게이션 제공
 * 
 * @param {boolean} open - 다이얼로그 열림 상태
 * @param {function} onClose - 다이얼로그 닫기 콜백
 * @param {Array} images - 이미지 객체 배열 [{url, title, fileId}, ...]
 * @param {number} initialIndex - 초기 표시 인덱스 (기본값: 0)
 * @param {function} onDownload - 다운로드 버튼 클릭 시 호출 (fileId를 인자로 받음)
 */
function ImageCarouselDialog({ 
  open, 
  onClose, 
  images = [], 
  initialIndex = 0,
  onDownload 
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // 다이얼로그가 열릴 때 초기 인덱스 설정
  React.useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
    }
  }, [open, initialIndex]);

  // 이미지가 없으면 렌더링하지 않음
  if (!images || images.length === 0) {
    return null;
  }

  const currentImage = images[currentIndex];

  // 이전 이미지로 이동
  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  // 다음 이미지로 이동
  const handleNext = () => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  // 키보드 네비게이션
  const handleKeyDown = (event) => {
    if (event.key === 'ArrowLeft') {
      handlePrevious();
    } else if (event.key === 'ArrowRight') {
      handleNext();
    } else if (event.key === 'Escape') {
      onClose();
    }
  };

  // 다운로드 핸들러
  const handleDownload = () => {
    if (onDownload && currentImage.fileId) {
      onDownload(currentImage.fileId);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullScreen
      onKeyDown={handleKeyDown}
      PaperProps={{
        sx: {
          bgcolor: 'rgba(0, 0, 0, 0.95)',
          margin: 0
        }
      }}
    >
      <DialogContent sx={{ 
        p: 0, 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* 닫기 버튼 */}
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            color: 'white',
            zIndex: 1300,
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            '&:hover': {
              bgcolor: 'rgba(0, 0, 0, 0.7)'
            }
          }}
        >
          <CloseIcon />
        </IconButton>

        {/* 다운로드 버튼 */}
        {onDownload && currentImage.fileId && (
          <IconButton
            onClick={handleDownload}
            sx={{
              position: 'absolute',
              top: 16,
              right: 72,
              color: 'white',
              zIndex: 1300,
              bgcolor: 'rgba(0, 0, 0, 0.5)',
              '&:hover': {
                bgcolor: 'rgba(0, 0, 0, 0.7)'
              }
            }}
          >
            <DownloadIcon />
          </IconButton>
        )}

        {/* 이미지 정보 */}
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            color: 'white',
            zIndex: 1300,
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            p: 1,
            borderRadius: 1
          }}
        >
          <Typography variant="body2">
            {currentIndex + 1} / {images.length}
          </Typography>
          {currentImage.title && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
              {currentImage.title}
            </Typography>
          )}
        </Box>

        {/* 이전 버튼 */}
        {images.length > 1 && (
          <IconButton
            onClick={handlePrevious}
            sx={{
              position: 'absolute',
              left: isMobile ? 8 : 32,
              color: 'white',
              zIndex: 1300,
              bgcolor: 'rgba(0, 0, 0, 0.5)',
              '&:hover': {
                bgcolor: 'rgba(0, 0, 0, 0.7)'
              }
            }}
          >
            <ArrowBackIosNewIcon />
          </IconButton>
        )}

        {/* 다음 버튼 */}
        {images.length > 1 && (
          <IconButton
            onClick={handleNext}
            sx={{
              position: 'absolute',
              right: isMobile ? 8 : 32,
              color: 'white',
              zIndex: 1300,
              bgcolor: 'rgba(0, 0, 0, 0.5)',
              '&:hover': {
                bgcolor: 'rgba(0, 0, 0, 0.7)'
              }
            }}
          >
            <ArrowForwardIosIcon />
          </IconButton>
        )}

        {/* 이미지 표시 */}
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            p: 2
          }}
        >
          <img
            src={currentImage.url}
            alt={currentImage.title || `Image ${currentIndex + 1}`}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              userSelect: 'none'
            }}
            draggable={false}
          />
        </Box>

        {/* 이미지 썸네일 (하단) */}
        {images.length > 1 && !isMobile && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 1,
              bgcolor: 'rgba(0, 0, 0, 0.5)',
              p: 1,
              borderRadius: 1,
              maxWidth: '90%',
              overflowX: 'auto'
            }}
          >
            {images.map((img, index) => (
              <Box
                key={index}
                onClick={() => setCurrentIndex(index)}
                sx={{
                  width: 60,
                  height: 60,
                  cursor: 'pointer',
                  border: index === currentIndex ? '2px solid white' : '2px solid transparent',
                  borderRadius: 1,
                  overflow: 'hidden',
                  flexShrink: 0,
                  opacity: index === currentIndex ? 1 : 0.6,
                  transition: 'all 0.2s',
                  '&:hover': {
                    opacity: 1
                  }
                }}
              >
                <img
                  src={img.url}
                  alt={`Thumbnail ${index + 1}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ImageCarouselDialog;
