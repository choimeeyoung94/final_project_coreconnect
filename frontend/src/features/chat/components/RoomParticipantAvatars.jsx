import React, { useState, useEffect } from "react";
import {
  AvatarGroup,
  Avatar,
  Box,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import axios from "axios";

/**
 * RoomParticipantAvatars - 채팅방 참여자 아바타 그룹 컴포넌트
 * @param {number} roomId - 채팅방 ID
 * @param {number} maxAvatars - 표시할 최대 아바타 수 (기본값: 4)
 * @param {string} accessToken - 인증 토큰 (선택)
 */
function RoomParticipantAvatars({ roomId, maxAvatars = 4, accessToken }) {
  const [participants, setParticipants] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (roomId) {
      fetchParticipants();
    }
  }, [roomId]);

  const fetchParticipants = async () => {
    try {
      setLoading(true);
      const token = accessToken || localStorage.getItem("token") || localStorage.getItem("accessToken");
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/chat/${roomId}/users`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      if (response.data && response.data.data) {
        setParticipants(response.data.data);
      }
    } catch (error) {
      console.error("[RoomParticipantAvatars] 참여자 조회 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = () => {
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.charAt(0).toUpperCase();
  };

  const visibleParticipants = participants.slice(0, maxAvatars);
  const remainingCount = participants.length - maxAvatars;

  if (loading || participants.length === 0) {
    return null;
  }

  return (
    <>
      {/* 아바타 그룹 */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
        }}
        onClick={handleOpenDialog}
      >
        <AvatarGroup max={maxAvatars} sx={{ cursor: "pointer" }}>
          {visibleParticipants.map((participant) => (
            <Avatar
              key={participant.id}
              alt={participant.name}
              src={participant.profileImageUrl}
              sx={{
                width: 32,
                height: 32,
                fontSize: "0.875rem",
              }}
            >
              {getInitials(participant.name)}
            </Avatar>
          ))}
        </AvatarGroup>
        {remainingCount > 0 && (
          <Chip
            label={`+${remainingCount}`}
            size="small"
            sx={{
              ml: 1,
              height: 24,
              fontSize: "0.75rem",
            }}
          />
        )}
      </Box>

      {/* 참여자 목록 다이얼로그 */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          참여자 ({participants.length}명)
          <IconButton onClick={handleCloseDialog} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <List>
            {participants.map((participant) => (
              <ListItem key={participant.id}>
                <ListItemAvatar>
                  <Avatar
                    alt={participant.name}
                    src={participant.profileImageUrl}
                  >
                    {getInitials(participant.name)}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={participant.name}
                  secondary={
                    <>
                      {participant.jobGrade && (
                        <span>{participant.jobGrade} </span>
                      )}
                      {participant.deptName && (
                        <span>· {participant.deptName}</span>
                      )}
                      {participant.email && (
                        <span style={{ display: "block", fontSize: "0.75rem" }}>
                          {participant.email}
                        </span>
                      )}
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default RoomParticipantAvatars;
