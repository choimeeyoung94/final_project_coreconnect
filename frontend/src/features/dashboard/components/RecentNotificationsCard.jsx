import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../../components/ui/Card";
import { 
  List, 
  ListItem, 
  ListItemText, 
  Typography, 
  Box, 
  Chip,
  Button
} from "@mui/material";
import { getNotificationPage } from "../../notification/api/notificationAPI";
import { formatTime, formatKoreanDate } from "../../../utils/TimeUtils";
import { getNotificationTypeLabel } from "../../../utils/labelUtils";

export default function RecentNotificationsCard() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      // 안 읽은 알림 최근 5개만 서버에서 받음 (예전: 전체 이력을 받아 앞 5개만 씀, 읽은 것도 섞임)
      const page = await getNotificationPage("unread", 0, 5);
      setNotifications(page.content || []);
    } catch (err) {
      console.error("알림 조회 실패:", err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const formatNotificationTime = (sentAt) => {
    if (!sentAt) return "";
    const date = new Date(sentAt);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "방금 전";
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return formatKoreanDate(date);
  };

  return (
    <Card title="최근 알림">
      {loading ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 2 }}>
          불러오는 중...
        </Typography>
      ) : notifications.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 2 }}>
          알림이 없습니다.
        </Typography>
      ) : (
        <>
          <List dense sx={{ pl: 1 }}>
            {notifications.map((notif) => (
              <ListItem 
                key={notif.notificationId} 
                sx={{ 
                  px: 0, 
                  py: 1,
                  flexDirection: "column",
                  alignItems: "flex-start",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  "&:last-child": { borderBottom: "none" }
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", mb: 0.5 }}>
                  <Chip 
                    label={getNotificationTypeLabel(notif.notificationType)} 
                    size="small" 
                    variant="outlined"
                    sx={{ height: 20, fontSize: "0.7rem" }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {formatNotificationTime(notif.sentAt)}
                  </Typography>
                </Box>
                <ListItemText
                  primary={notif.message || ""}
                  primaryTypographyProps={{ 
                    variant: "body2",
                    sx: { wordBreak: "break-word" }
                  }}
                />
              </ListItem>
            ))}
          </List>
        </>
      )}
    </Card>
  );
}

