import React, { useState } from 'react';
import {
  Dialog,
  IconButton,
  Box,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import SwipeableViews from 'react-swipeable-views';

/**
 * ImageCarouselDialog Component
 * - 전체 화면 이미지 캐러셀
 * - 스와이프로 이미지 전환
 * - 이전/다음 버튼 지원
 * - 다운로드 기능
 */
const ImageCarouselDialog = ({ 
  open, 
  onClose, 
  images = [], 
  initialIndex = 0,
  onDownload,
}) => {
  const [activeStep, setActiveStep] = useState(initialIndex);

  // 인덱스 변경 핸들러
  const handleStepChange = (step) => {
    setActiveStep(step);
  };

  // 이전 이미지
  const handlePrev = () => {
    setActiveStep((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  // 다음 이미지
  const handleNext = () => {
    setActiveStep((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  // 다운로드 핸들러
  const handleDownload = () => {
    if (onDownload && images[activeStep]) {
      onDownload(images[activeStep]);
    }
  };

  // 키보드 이벤트 핸들러
  const handleKeyDown = (event) => {
    if (event.key === 'ArrowLeft') {
      handlePrev();
    } else if (event.key === 'ArrowRight') {
      handleNext();
    } else if (event.key === 'Escape') {
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
      fullScreen
      sx={{
        '& .MuiDialog-paper': {
          bgcolor: 'rgba(0, 0, 0, 0.95)',
        },
      }}
      onKeyDown={handleKeyDown}
    >
      {/* 헤더: 닫기 버튼 */}
      <Box sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        p: 2,
        zIndex: 1,
      }}>
        <Typography variant="h6" color="white">
          {activeStep + 1} / {images.length}
        </Typography>
        <Box>
          {onDownload && (
            <IconButton
              onClick={handleDownload}
              sx={{ color: 'white', mr: 1 }}
              title="다운로드"
            >
              <DownloadIcon />
            </IconButton>
          )}
          <IconButton
            onClick={onClose}
            sx={{ color: 'white' }}
            title="닫기"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      {/* 이미지 캐러셀 */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        position: 'relative',
      }}>
        {/* 이전 버튼 */}
        {images.length > 1 && (
          <IconButton
            onClick={handlePrev}
            sx={{
              position: 'absolute',
              left: 16,
              color: 'white',
              bgcolor: 'rgba(255, 255, 255, 0.1)',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.2)',
              },
              zIndex: 1,
            }}
          >
            <ChevronLeftIcon fontSize="large" />
          </IconButton>
        )}

        {/* SwipeableViews */}
        <SwipeableViews
          index={activeStep}
          onChangeIndex={handleStepChange}
          enableMouseEvents
          style={{ width: '100%', height: '100%' }}
          containerStyle={{
            height: '100%',
            alignItems: 'center',
          }}
          slideStyle={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {images.map((image, index) => (
            <Box
              key={index}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                p: 4,
              }}
            >
              <img
                src={image.url || image}
                alt={image.name || `Image ${index + 1}`}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
              />
            </Box>
          ))}
        </SwipeableViews>

        {/* 다음 버튼 */}
        {images.length > 1 && (
          <IconButton
            onClick={handleNext}
            sx={{
              position: 'absolute',
              right: 16,
              color: 'white',
              bgcolor: 'rgba(255, 255, 255, 0.1)',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.2)',
              },
              zIndex: 1,
            }}
          >
            <ChevronRightIcon fontSize="large" />
          </IconButton>
        )}
      </Box>

      {/* 이미지 정보 (하단) */}
      {images[activeStep]?.name && (
        <Box sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          p: 2,
          textAlign: 'center',
          bgcolor: 'rgba(0, 0, 0, 0.5)',
        }}>
          <Typography variant="body2" color="white">
            {images[activeStep].name}
          </Typography>
        </Box>
      )}
    </Dialog>
  );
};

export default ImageCarouselDialog;
