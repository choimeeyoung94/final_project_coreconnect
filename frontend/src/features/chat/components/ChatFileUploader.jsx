import React, { useState, useRef } from 'react';
import { Box, Button, IconButton, Typography, Paper } from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';

const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB in bytes

/**
 * ChatFileUploader Component
 * 
 * 여러 이미지 파일 선택, 미리보기, 개별 취소 및 클라이언트 측 크기 검증 지원
 * 
 * @param {function} onUpload - 업로드 버튼 클릭 시 호출되는 콜백 (FormData를 인자로 받음)
 * @param {function} onCancel - 취소 버튼 클릭 시 호출되는 콜백
 */
function ChatFileUploader({ onUpload, onCancel }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // 파일 선택 핸들러
  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    
    // 이미지 파일만 필터링
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length !== files.length) {
      setError('이미지 파일만 선택할 수 있습니다.');
      return;
    }
    
    // 총 파일 크기 계산
    const currentSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    const newSize = imageFiles.reduce((sum, file) => sum + file.size, 0);
    const totalSize = currentSize + newSize;
    
    if (totalSize > MAX_TOTAL_SIZE) {
      setError(`총 파일 크기가 50MB를 초과합니다. (현재: ${(totalSize / 1024 / 1024).toFixed(2)}MB)`);
      return;
    }
    
    setError('');
    
    // 기존 파일에 새 파일 추가
    const updatedFiles = [...selectedFiles, ...imageFiles];
    setSelectedFiles(updatedFiles);
    
    // 미리보기 URL 생성
    const newPreviewUrls = imageFiles.map(file => URL.createObjectURL(file));
    setPreviewUrls([...previewUrls, ...newPreviewUrls]);
  };

  // 개별 파일 삭제 핸들러
  const handleRemoveFile = (index) => {
    // 미리보기 URL 해제
    URL.revokeObjectURL(previewUrls[index]);
    
    // 파일 및 미리보기 배열에서 제거
    const updatedFiles = selectedFiles.filter((_, i) => i !== index);
    const updatedPreviews = previewUrls.filter((_, i) => i !== index);
    
    setSelectedFiles(updatedFiles);
    setPreviewUrls(updatedPreviews);
    setError('');
  };

  // 업로드 핸들러
  const handleUpload = () => {
    if (selectedFiles.length === 0) {
      setError('업로드할 파일을 선택해주세요.');
      return;
    }
    
    // FormData 생성
    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('files', file);
    });
    
    // 콜백 호출
    onUpload(formData);
    
    // 상태 초기화
    cleanup();
  };

  // 취소 핸들러
  const handleCancel = () => {
    cleanup();
    if (onCancel) {
      onCancel();
    }
  };

  // 정리 함수 (메모리 누수 방지)
  const cleanup = () => {
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setSelectedFiles([]);
    setPreviewUrls([]);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 컴포넌트 언마운트 시 정리
  React.useEffect(() => {
    return () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
  const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);

  return (
    <Box sx={{ p: 2, borderTop: '1px solid #e0e0e0', bgcolor: '#f5f5f5' }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
        이미지 파일 업로드
      </Typography>
      
      {/* 파일 선택 버튼 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        id="chat-file-input"
      />
      <label htmlFor="chat-file-input">
        <Button
          variant="outlined"
          component="span"
          startIcon={<AttachFileIcon />}
          size="small"
          sx={{ mb: 2 }}
        >
          이미지 선택
        </Button>
      </label>
      
      {/* 에러 메시지 */}
      {error && (
        <Typography color="error" variant="caption" sx={{ display: 'block', mb: 1 }}>
          {error}
        </Typography>
      )}
      
      {/* 선택된 파일 수 및 총 크기 */}
      {selectedFiles.length > 0 && (
        <Typography variant="caption" sx={{ display: 'block', mb: 1, color: '#666' }}>
          선택된 파일: {selectedFiles.length}개 (총 {totalSizeMB}MB / 50MB)
        </Typography>
      )}
      
      {/* 미리보기 영역 */}
      {previewUrls.length > 0 && (
        <Box sx={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: 1, 
          mb: 2,
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          {previewUrls.map((url, index) => (
            <Paper
              key={index}
              elevation={2}
              sx={{
                position: 'relative',
                width: 80,
                height: 80,
                overflow: 'hidden',
                borderRadius: 1
              }}
            >
              <img
                src={url}
                alt={`preview-${index}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
              <IconButton
                size="small"
                onClick={() => handleRemoveFile(index)}
                sx={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  bgcolor: 'rgba(0, 0, 0, 0.6)',
                  color: 'white',
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.8)'
                  },
                  width: 20,
                  height: 20
                }}
              >
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
              <Typography
                variant="caption"
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  bgcolor: 'rgba(0, 0, 0, 0.6)',
                  color: 'white',
                  p: 0.5,
                  fontSize: '0.65rem',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {selectedFiles[index]?.name}
              </Typography>
            </Paper>
          ))}
        </Box>
      )}
      
      {/* 액션 버튼 */}
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          size="small"
          onClick={handleCancel}
        >
          취소
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={<SendIcon />}
          onClick={handleUpload}
          disabled={selectedFiles.length === 0}
        >
          업로드 ({selectedFiles.length})
        </Button>
      </Box>
    </Box>
  );
}

export default ChatFileUploader;
