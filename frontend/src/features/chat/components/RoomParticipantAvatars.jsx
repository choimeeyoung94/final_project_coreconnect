import React from 'react';
import { Box, Avatar, AvatarGroup, Tooltip, Typography } from '@mui/material';

/**
 * RoomParticipantAvatars Component
 * - 채팅방 참여자의 아바타를 최대 4개까지 표시
 * - 나머지는 +N으로 표시
 * - 클릭 시 참여자 목록 다이얼로그 열기
 */
const RoomParticipantAvatars = ({ participants = [], onClick, maxDisplay = 4 }) => {
  if (!participants || participants.length === 0) {
    return null;
  }

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        cursor: 'pointer',
        '&:hover': {
          opacity: 0.8,
        },
      }}
    >
      <AvatarGroup
        max={maxDisplay}
        sx={{
          '& .MuiAvatar-root': {
            width: 32,
            height: 32,
            fontSize: '0.875rem',
            border: '2px solid #fff',
          },
        }}
      >
        {participants.map((participant, index) => (
          <Tooltip
            key={participant.id || index}
            title={participant.name || participant.email || '참여자'}
            arrow
          >
            <Avatar
              src={participant.profileImageUrl || ''}
              alt={participant.name || participant.email}
              sx={{
                bgcolor: participant.profileImageUrl ? 'transparent' : '#10c16d',
              }}
            >
              {!participant.profileImageUrl && (participant.name?.[0] || participant.email?.[0] || '?').toUpperCase()}
            </Avatar>
          </Tooltip>
        ))}
      </AvatarGroup>
      {participants.length > maxDisplay && (
        <Typography
          variant="caption"
          sx={{
            ml: 1,
            color: 'text.secondary',
          }}
        >
          외 {participants.length - maxDisplay}명
        </Typography>
      )}
    </Box>
  );
};

export default RoomParticipantAvatars;
