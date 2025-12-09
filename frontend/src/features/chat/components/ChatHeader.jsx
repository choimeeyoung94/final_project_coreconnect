import React from "react";
import { Box, Typography, IconButton, Tooltip } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import AddIcon from "@mui/icons-material/Add";
import SortIcon from "@mui/icons-material/Sort";
import { useNavigate } from "react-router-dom";

// 채팅 헤더(상단바)
function ChatHeader({ onCreateRoom }) {
  const navigate = useNavigate();

  return (
    <Box className="chat-header" sx={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      height: "56px", background: "#fff", borderBottom: "1px solid #f0f1f4",
      px: 3, gap: 2
    }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <PersonIcon sx={{ fontSize: 26, color: "primary.main" }} />
        <Typography sx={{ fontSize: 20, fontWeight: 600, color: "#222" }}>
          채팅
        </Typography>
      </Box>
      <Box sx={{
        display: "flex", alignItems: "center", gap: 1.5,
        fontSize: 22, color: "#bbb"
      }}>
        {/* 채팅방 생성 버튼 (녹색 원 + 빨간 +) */}
        <Tooltip title="채팅방 생성" arrow>
          <IconButton
            onClick={() => {
              if (onCreateRoom) {
                onCreateRoom();
              } else {
                navigate("/chat", { state: { openCreateDialog: true } });
              }
            }}
            sx={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              bgcolor: "primary.main",
              color: "#fff",
              fontSize: 20,
              "&:hover": {
                bgcolor: "primary.dark",
              },
            }}
          >
            <AddIcon />
          </IconButton>
        </Tooltip>

        {/* 채팅방 목록/정렬 버튼 (흰색 원 + 녹색 선) */}
        <Tooltip title="채팅방 목록" arrow>
          <IconButton
            onClick={() => navigate("/chat")}
            sx={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              bgcolor: "#fff",
              color: "primary.main",
              fontSize: 20,
              border: "1px solid #e0e0e0",
              "&:hover": {
                bgcolor: "#f5f5f5",
              },
            }}
          >
            <SortIcon />
          </IconButton>
        </Tooltip>

      </Box>
    </Box>
  );
}
export default ChatHeader;