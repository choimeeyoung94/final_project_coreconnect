import React from 'react';
import { Box, Avatar, AvatarGroup, Typography, Tooltip } from '@mui/material';

/**
 * RoomParticipantAvatars Component
 * 
 * 채팅방 참여자들의 아바타를 표시 (최대 4개 + "+N" 표시)
 * 클릭 시 참여자 목록 다이얼로그 열기
 * 
 * @param {Array} participants - 참여자 객체 배열 [{id, name, profileImageUrl, email}, ...]
 * @param {function} onClick - 클릭 시 호출되는 콜백
 * @param {number} max - 표시할 최대 아바타 수 (기본값: 4)
 */
function RoomParticipantAvatars({ participants = [], onClick, max = 4 }) {
  // 참여자가 없으면 렌더링하지 않음
  if (!participants || participants.length === 0) {
    return null;
  }

  // 이름의 첫 글자를 가져오는 함수
  const getInitial = (name) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  // 색상을 생성하는 함수 (이름 기반)
  const getAvatarColor = (name) => {
    if (!name) return '#9e9e9e';
    
    const colors = [
      '#f44336', '#e91e63', '#9c27b0', '#673ab7',
      '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
      '#009688', '#4caf50', '#8bc34a', '#cddc39',
      '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const displayCount = Math.min(participants.length, max);
  const extraCount = participants.length > max ? participants.length - max : 0;

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        '&:hover': {
          opacity: 0.8
        }
      }}
    >
      <AvatarGroup 
        max={max + 1}
        sx={{
          '& .MuiAvatar-root': {
            width: 32,
            height: 32,
            fontSize: '0.875rem',
            border: '2px solid white'
          }
        }}
      >
        {participants.slice(0, max).map((participant, index) => (
          <Tooltip 
            key={participant.id || index} 
            title={participant.name || participant.email || 'Unknown'}
            arrow
          >
            <Avatar
              alt={participant.name}
              src={participant.profileImageUrl}
              sx={{
                bgcolor: !participant.profileImageUrl 
                  ? getAvatarColor(participant.name) 
                  : undefined
              }}
            >
              {!participant.profileImageUrl && getInitial(participant.name)}
            </Avatar>
          </Tooltip>
        ))}
      </AvatarGroup>
      
      {extraCount > 0 && (
        <Typography
          variant="caption"
          sx={{
            ml: 1,
            color: '#666',
            fontWeight: 500
          }}
        >
          +{extraCount}
        </Typography>
      )}
    </Box>
  );
}

export default RoomParticipantAvatars;
