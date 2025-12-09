import React from "react";
import { Box, IconButton, Badge } from "@mui/material";
import { NavLink } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import SortIcon from "@mui/icons-material/Sort";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";

// 좌측 퀵 액션 사이드바
function ChatSidebar({ unreadRoomCount, onCreateRoom }) {
  return (
    <Box component="aside" className="chat-sidebar" sx={{
      width: 62, background: "#f7f8fa", display: "flex",
      flexDirection: "column", alignItems: "center", pt: 1.5, gap: 1.5,
      borderRight: "1px solid #f0f1f4"
    }}>
      {/* + 버튼: 직접 콜백으로 방 생성 다이얼로그 열기 */}
      <IconButton
        color="primary"
        sx={{
          width: 42, height: 42, borderRadius: "50%", mb: 0.5,
          bgcolor: "primary.main", color: "#fff", fontSize: 22
        }}
        onClick={onCreateRoom}
      >
        <AddIcon />
      </IconButton>
      <IconButton component={NavLink} to="/chat/sort" sx={{
        width: 42, height: 42, borderRadius: "50%",
        bgcolor: "#fff", color: "primary.main", fontSize: 20
      }}>
        <SortIcon />
      </IconButton>
      <IconButton component={NavLink} to="/chat/notice" sx={{
        width: 42, height: 42, borderRadius: "50%", bgcolor: "#fff", color: "#2db8ff",
        fontSize: 20, position: "relative"
      }}>
        <NotificationsNoneIcon />
        {unreadRoomCount > 0 && (
          <Badge badgeContent={unreadRoomCount} color="error" sx={{
            position: "absolute", top: 0, right: 0, fontSize: 13
          }} />
        )}
      </IconButton>
    </Box>
  );
}
export default ChatSidebar;