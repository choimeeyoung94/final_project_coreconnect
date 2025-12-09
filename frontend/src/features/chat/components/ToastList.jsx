import React, { useState, useEffect } from "react";
import { Slide, Paper, Box, Typography, Badge } from "@mui/material";

const TOAST_OFFSET_TOP = 32; // 첫 알림 위쪽 여백
const TOAST_HEIGHT = 120;    // 한 알림 높이 + 간격(더 넉넉히!)

function TransitionLeft(props) {
  return <Slide {...props} direction="left" />;
}

const ToastList = ({ rooms, formatTime }) => {
  const [openToasts, setOpenToasts] = useState([]);
  useEffect(() => {
    setOpenToasts(
      rooms
        .filter(room => room.unreadCount > 0)
        .map(room => ({ roomId: room.roomId, open: true }))
    );
  }, [rooms]);
  useEffect(() => {
    if (openToasts.length > 0) {
      const timers = openToasts.map(toast =>
        setTimeout(() => {
          setOpenToasts(prev =>
            prev.map(t =>
              t.roomId === toast.roomId ? { ...t, open: false } : t
            )
          );
        }, 10000)
      );
      return () => timers.forEach(timerId => clearTimeout(timerId));
    }
  }, [openToasts]);
  // 내림차순 정렬(최근이 아래)
  const roomsSorted = [...rooms].sort(
    (a, b) => new Date(a.lastUnreadMessageTime) - new Date(b.lastUnreadMessageTime)
  );

  return (
    <Box sx={{
      position: "fixed",
      top: TOAST_OFFSET_TOP,
      right: 28,
      zIndex: 1400,
      width: 420,
      pointerEvents: "none",
    }}>
      {roomsSorted.filter(room => room.unreadCount > 0).map((room, idx) => {
        const toastOpen = openToasts.find(t => t.roomId === room.roomId)?.open ?? false;
        if (!toastOpen) return null;
        return (
          <Box
            key={room.roomId}
            sx={{
              position: "absolute",
              right: 0,
              width: "100%",
              top: `${idx * TOAST_HEIGHT}px`, // ✔️ 충분히 크게!
              pointerEvents: "all",
              zIndex: 1400 + idx
            }}
          >
            <Paper
              elevation={8}
              sx={{
                background: "#3b475a",
                color: "#fff",
                minWidth: 280,
                maxWidth: 420,
                px: 2,
                py: 2,
                borderRadius: 2,
                mb: 3, // ✔️ 추가적으로 mb를 더 크게!
                boxShadow: 8
              }}
            >
              <Box sx={{
                fontWeight: 700, fontSize: 15, mb: 0.7,
                display: "flex", alignItems: "center", gap: 1
              }}>
                <Badge
                  badgeContent={room.unreadCount}
                  color="error"
                  sx={{
                    mr: 1,
                    "& .MuiBadge-badge": {
                      background: "#f6c745",
                      color: "#222",
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: "14px"
                    }
                  }}
                />
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "primary.main" }}>
                  {room.lastUnreadMessageContent}
                </Typography>
              </Box>
              <Box sx={{
                fontSize: 13, display: "flex", gap: 1.3,
                alignItems: "center", mb: 0.6
              }}>
                <Typography variant="body2">{room.lastUnreadMessageSenderName}</Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  {formatTime ? formatTime(room.lastUnreadMessageTime) : ""}
                </Typography>
              </Box>
              <Box sx={{ fontSize: 12, color: "#abd0ff", opacity: 0.83 }}>
                [{room.roomName}]
              </Box>
            </Paper>
          </Box>
        );
      })}
    </Box>
  );
};

export default ToastList;