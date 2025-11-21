import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  IconButton,
  Typography,
  Card,
  CardMedia,
  CardActions,
} from '@mui/material';
import {
  AttachFile as AttachFileIcon,
  Close as CloseIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';

/**
 * ChatFileUploader Component
 * - 다중 이미지 파일 선택 지원
 * - 이미지 미리보기 (ObjectURL)
 * - 개별 이미지 취소 기능
 * - 클라이언트 측 50MB 총 크기 제한
 */
const ChatFileUploader = ({ onUpload, maxTotalSize = 50 * 1024 * 1024 }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // 허용된 이미지 타입
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];

  // 파일 선택 핸들러
  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    
    if (files.length === 0) return;

    // 이미지 타입 검증
    const invalidFiles = files.filter(file => !ALLOWED_TYPES.includes(file.type));
    if (invalidFiles.length > 0) {
      setError('이미지 파일만 업로드할 수 있습니다. (JPEG, PNG, GIF, WEBP, BMP)');
      return;
    }

    // 기존 파일과 합쳐서 총 크기 체크
    const currentSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    const newSize = files.reduce((sum, file) => sum + file.size, 0);
    const totalSize = currentSize + newSize;

    if (totalSize > maxTotalSize) {
      const maxMB = maxTotalSize / (1024 * 1024);
      setError(`총 파일 크기는 ${maxMB}MB를 초과할 수 없습니다.`);
      return;
    }

    // 파일 추가
    setSelectedFiles(prev => [...prev, ...files]);

    // 미리보기 생성
    const newPreviews = files.map(file => ({
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
    }));
    setPreviews(prev => [...prev, ...newPreviews]);
    setError('');

    // input 초기화
    event.target.value = '';
  };

  // 개별 파일 제거
  const handleRemoveFile = (index) => {
    // ObjectURL 메모리 해제
    URL.revokeObjectURL(previews[index].url);

    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
    setError('');
  };

  // 전체 파일 제거
  const handleClearAll = () => {
    previews.forEach(preview => URL.revokeObjectURL(preview.url));
    setSelectedFiles([]);
    setPreviews([]);
    setError('');
  };

  // 업로드 핸들러
  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError('업로드할 파일을 선택해주세요.');
      return;
    }

    try {
      await onUpload(selectedFiles);
      handleClearAll();
    } catch (err) {
      setError(err.message || '업로드 중 오류가 발생했습니다.');
    }
  };

  // 파일 크기 포맷팅
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  // 총 크기 계산
  const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
  const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
  const maxSizeMB = (maxTotalSize / (1024 * 1024)).toFixed(0);

  return (
    <Box sx={{ width: '100%', p: 2 }}>
      {/* 파일 선택 버튼 */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<AttachFileIcon />}
          onClick={() => fileInputRef.current?.click()}
          sx={{ flex: 1 }}
        >
          이미지 선택
        </Button>
        {selectedFiles.length > 0 && (
          <>
            <Button
              variant="contained"
              startIcon={<CloudUploadIcon />}
              onClick={handleUpload}
              color="primary"
            >
              업로드 ({selectedFiles.length})
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              onClick={handleClearAll}
            >
              전체 취소
            </Button>
          </>
        )}
      </Box>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* 에러 메시지 */}
      {error && (
        <Typography color="error" variant="body2" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {/* 총 크기 표시 */}
      {selectedFiles.length > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          총 크기: {totalSizeMB} MB / {maxSizeMB} MB
        </Typography>
      )}

      {/* 이미지 미리보기 그리드 */}
      {previews.length > 0 && (
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 2,
          maxHeight: '300px',
          overflowY: 'auto',
        }}>
          {previews.map((preview, index) => (
            <Card key={index} sx={{ position: 'relative' }}>
              <CardMedia
                component="img"
                height="120"
                image={preview.url}
                alt={preview.name}
                sx={{ objectFit: 'cover' }}
              />
              <CardActions sx={{ 
                position: 'absolute', 
                top: 0, 
                right: 0,
                p: 0.5,
              }}>
                <IconButton
                  size="small"
                  onClick={() => handleRemoveFile(index)}
                  sx={{
                    bgcolor: 'rgba(0, 0, 0, 0.6)',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'rgba(0, 0, 0, 0.8)',
                    },
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </CardActions>
              <Box sx={{ p: 0.5, bgcolor: 'rgba(0, 0, 0, 0.05)' }}>
                <Typography variant="caption" noWrap>
                  {preview.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {formatFileSize(preview.size)}
                </Typography>
              </Box>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default ChatFileUploader;
