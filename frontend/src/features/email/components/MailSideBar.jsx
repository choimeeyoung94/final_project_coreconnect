import React, { useState, useContext, useEffect } from "react";
import {
  Box, Button, List, ListItem, ListItemButton, ListItemText, Typography,
  IconButton, Chip, Badge
} from "@mui/material";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { useNavigate } from "react-router-dom";
import { MailCountContext } from "../../../App";
import { emptyTrash } from "../api/emailApi";
import MailWriteButton from "./ui/MailWriteButton";
import { useSnackbarContext } from "../../../components/utils/SnackbarContext";
import ConfirmDialog from "../../../components/utils/ConfirmDialog";

const MailSideBar = () => {
  const { showSnack } = useSnackbarContext();
  const navigate = useNavigate();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  // context 값 받아오기: draftCount, unreadCount, …, refreshDraftCount 등
  const mailCountContext = useContext(MailCountContext);
  const {
    draftCount = 0,
    unreadCount = 0,
    refreshDraftCount = () => {},
    refreshUnreadCount = () => {},
  } = mailCountContext || {};
  
  // 디버깅: context 값 확인
  useEffect(() => {
    console.log("[MailSideBar] MailCountContext 값:", {
      mailCountContext,
      unreadCount,
      draftCount,
      hasContext: !!mailCountContext
    });
  }, [mailCountContext, unreadCount, draftCount]);

  // ★ 이 부분에서 임시보관함 카운트를 동기화(앱 마운트/리프레시 시)
  useEffect(() => {
    // userEmail 정보를 각 필수 위치에서 받아와야 함 (혹은 fetchDraftCount를 직접 호출)
    // 보통 이 컨텍스트는 App에서 최신화해주므로, 여기선 effect 확인만 추가
  }, []);

  // 라우트 변경 함수
  const goTodayMailTab = () => navigate("/email?tab=today");
  const goUnreadMailTab = () => navigate("/email?tab=unread");
  const goAllMailTab = () => navigate("/email?tab=all");

  // 휴지통 비우기 핸들러
  const handleEmptyTrash = (e) => {
    e.stopPropagation();
    setConfirmDialogOpen(true);
  };

  const handleConfirmEmptyTrash = async () => {
    setConfirmDialogOpen(false);
    try {
      await emptyTrash();
      refreshDraftCount();
      refreshUnreadCount();
      showSnack("휴지통이 비워졌습니다.", 'success');
    } catch (err) {
      showSnack("휴지통 비우기 중 오류가 발생했습니다.", 'error');
      console.error(err);
    }
  };

  return (
    <Box
      sx={{
        width: 260, px: 2, py: 1, bgcolor: "#fff", height: "100vh",
        borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column", gap: 1
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
        <Typography 
          variant="h6" 
          fontWeight={700} 
          sx={{ 
            flex: 1, 
            fontSize: "1rem",
            cursor: "pointer",
            "&:hover": {
              color: "primary.main"
            }
          }}
          onClick={goAllMailTab}
        >
          메일
        </Typography>
      </Box>
      <Box sx={{ mb: 1 }}>
        <MailWriteButton />
      </Box>
      <Box sx={{ flex: 1, overflowY: "auto" }}>
        {/* 즐겨찾기 */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: 13, color: "#999", flex: 1 }}>
              즐겨찾기
            </Typography>
          </Box>
          <List dense sx={{ p: 0 }}>
            <ListItem disableGutters sx={{ py: 0.5, px: 0 }}>
              <ListItemButton sx={{ borderRadius: 1, px: 1.3, py: 0.5 }} onClick={() => navigate("/email/favorite")}>
                <Box sx={{ display: "inline-block", pr: 0.7 }}>
                  <StarBorderIcon fontSize="small" />
                </Box>
                <ListItemText primary={<Typography variant="body2">중요 메일</Typography>} />
              </ListItemButton>
            </ListItem>
            <ListItem disableGutters sx={{ py: 0.5, px: 0 }}>
              <ListItemButton 
                sx={{ 
                  borderRadius: 1, 
                  px: 1.3, 
                  py: 0.5
                }} 
                onClick={goUnreadMailTab}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Typography variant="body2" sx={{ lineHeight: 1.5 }}>안읽은 메일</Typography>
                      {unreadCount != null && unreadCount > 0 && (
                        <Badge
                          badgeContent={unreadCount}
                          anchorOrigin={{
                            vertical: 'top',
                            horizontal: 'right',
                          }}
                          sx={{ 
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            "& .MuiBadge-badge": { 
                              fontSize: 12, 
                              height: 18, 
                              minWidth: 20, 
                              borderRadius: 9,
                              position: "relative",
                              top: 0,
                              right: 0,
                              transform: "none",
                              bgcolor: "#d32f2f",
                              color: "#fff",
                              fontWeight: 600,
                            } 
                          }}
                        >
                          <Box sx={{ width: 0, height: 0 }} />
                        </Badge>
                      )}
                    </Box>
                  }
                />
              </ListItemButton>
            </ListItem>
            <ListItem disableGutters sx={{ py: 0.5, px: 0 }}>
              <ListItemButton sx={{ borderRadius: 1, px: 1.3, py: 0.5 }} onClick={goTodayMailTab}>
                <ListItemText
                  primary={
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <Typography variant="body2">오늘의 메일</Typography>
                    </Box>
                  }
                />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>

        {/* 메일함 */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: 13, color: "#999", flex: 1 }}>
              메일함
            </Typography>
          </Box>
          <List dense sx={{ p: 0 }}>
            <ListItem disableGutters sx={{ py: 0.5, px: 0 }}>
              <ListItemButton
                sx={{ 
                  borderRadius: 1, 
                  px: 1.3, 
                  py: 0.5
                }}
                onClick={goAllMailTab}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography variant="body2" sx={{ lineHeight: 1.5 }}>받은메일함</Typography>
                      {unreadCount != null && unreadCount > 0 && (
                        <Badge
                          badgeContent={unreadCount}
                          anchorOrigin={{
                            vertical: 'top',
                            horizontal: 'right',
                          }}
                          sx={{ 
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            "& .MuiBadge-badge": { 
                              fontSize: 12, 
                              height: 18, 
                              minWidth: 20, 
                              borderRadius: 9,
                              position: "relative",
                              top: 0,
                              right: 0,
                              transform: "none",
                              bgcolor: "#d32f2f",
                              color: "#fff",
                              fontWeight: 600,
                            } 
                          }}
                        >
                          <Box sx={{ width: 0, height: 0 }} />
                        </Badge>
                      )}
                    </Box>
                  }
                />
              </ListItemButton>
            </ListItem>
            <ListItem disableGutters sx={{ py: 0.5, px: 0 }}>
              <ListItemButton
                sx={{ borderRadius: 1, px: 1.3, py: 0.5 }}
                onClick={() => navigate("/email/sent")}
              >
                <ListItemText primary={<Typography variant="body2">보낸메일함</Typography>} />
              </ListItemButton>
            </ListItem>
            {/* 임시보관함 */}
            <ListItem disableGutters sx={{ py: 0.5, px: 0 }}>
              <ListItemButton
                sx={{ 
                  borderRadius: 1, 
                  px: 1.3, 
                  py: 0.5
                }}
                onClick={() => navigate("/email/draftbox")}
              >
                <ListItemText primary={
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <Typography variant="body2">임시보관함</Typography>
                    {/* ★ draftCount 실시간 노출! (0이면 뱃지 숨김) */}
                    {draftCount != null && draftCount > 0 && (
                      <Chip
                        size="small"
                        label={draftCount}
                        sx={{
                          ml: 1,
                          bgcolor: "#d32f2f",
                          fontSize: 12,
                          color: "#fff",
                          height: 18,
                          fontWeight: 600,
                          "& .MuiChip-label": { px: 0.8, py: 0.1 },
                        }}
                      />
                    )}
                  </Box>
                } />
              </ListItemButton>
            </ListItem>
            <ListItem disableGutters sx={{ py: 0.5, px: 0 }}>
              <ListItemButton
                sx={{ borderRadius: 1, px: 1.3, py: 0.5 }}
                onClick={() => navigate("/email/reserved")}
              >
                <ListItemText primary={<Typography variant="body2">예약전송함</Typography>} />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
        {/* 지운편지함(휴지통) */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: 13, color: "#999", flex: 1 }}>
              지운편지함
            </Typography>
          </Box>
          <List dense sx={{ p: 0 }}>
            <ListItem disableGutters sx={{ py: 0.5, px: 0 }}>
              <ListItemButton
                sx={{ borderRadius: 1, px: 1.3, py: 0.5 }}
                onClick={() => navigate("/email/trash")}
              >
                <ListItemText primary={<Typography variant="body2">휴지통</Typography>} />
                <Button variant="text" size="small" sx={{ fontSize: 12, px: 0.5 }} onClick={handleEmptyTrash}>
                  비우기
                </Button>
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Box>
      
      <ConfirmDialog
        open={confirmDialogOpen}
        title="휴지통 비우기"
        message="정말 휴지통을 비우시겠습니까? (되돌릴 수 없습니다)"
        onConfirm={handleConfirmEmptyTrash}
        onCancel={() => setConfirmDialogOpen(false)}
      />
    </Box>
  );
};

export default MailSideBar;