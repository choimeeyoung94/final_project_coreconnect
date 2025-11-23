import React, { useState, useEffect, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import Card from "../../../components/ui/Card";
import {
  Typography,
  Box,
  Divider,
  Avatar,
  Stack,
  Button,
} from "@mui/material";
import { fetchInbox } from "../../email/api/emailApi";
import { UserProfileContext } from "../../../App";
import AttachFileIcon from "@mui/icons-material/AttachFile";

export default function MailListCard() {
  const navigate = useNavigate();
  const [recentMails, setRecentMails] = useState([]);
  const [mailLoading, setMailLoading] = useState(true);
  const { userProfile } = useContext(UserProfileContext) || {};
  const userEmail = userProfile?.email; 

  // 받은메일함 최근 메일 가져오기
  useEffect(() => {
    if (!userEmail) {
      setMailLoading(false);
      return;
    }
    
    (async () => {
      try {
        const res = await fetchInbox(userEmail, 0, 5, "all"); 
        setRecentMails(res.data.data.content || []);
      } catch (err) {
        console.error("메일 목록 불러오기 실패:", err);
        setRecentMails([]);
      } finally {
        setMailLoading(false);
      }
    })();
  }, [userEmail]);

  const formatMailTime = (sentTime) => {
    if (!sentTime) return "";
    const date = new Date(sentTime);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffMins < 1) return "방금 전";
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    if (diffWeeks < 4) return `${diffWeeks}주 전`;
    if (diffMonths < 12) return `${diffMonths}개월 전`;
    return `${Math.floor(diffDays / 365)}년 전`;
  };

  return (
    <Card
      title="메일 리스트"
      right={
        <Button
          component={Link}
          to="/email/inbox"
          size="small"
          sx={{ textTransform: "none" }}
        >
          전체보기
        </Button>
      }
      sx={{ minWidth: 400 }}
    >
      {mailLoading ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
          로딩 중...
        </Typography>
      ) : recentMails.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
          받은 메일이 없습니다.
        </Typography>
      ) : (
        <Box>
          {recentMails.map((mail, index) => {
            const hasAttachment = mail.files && mail.files.length > 0;
            
            return (
              <Box key={mail.emailId}>
                <Box
                  data-grid-cancel="true"
                  onClick={() => navigate(`/email/${mail.emailId}`)}
                  sx={{
                    px: 2,
                    py: 1.5,
                    cursor: "pointer",
                    transition: "background-color 0.2s",
                    "&:hover": {
                      bgcolor: "action.hover",
                    },
                  }}
                >
                  <Stack spacing={1}>
                    {/* 제목 */}
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          flex: 1,
                          lineHeight: 1.4,
                        }}
                      >
                        {mail.emailTitle || "(제목 없음)"}
                      </Typography>
                      {hasAttachment && (
                        <AttachFileIcon 
                          sx={{ 
                            fontSize: 16, 
                            color: "text.secondary",
                            flexShrink: 0,
                            mt: 0.25
                          }} 
                        />
                      )}
                    </Box>

                    {/* 발신자 정보 */}
                    <Stack 
                      direction="row" 
                      alignItems="center" 
                      spacing={1.5}
                      sx={{ flexWrap: "wrap" }}
                    >
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Avatar
                          src={mail.senderProfileImageUrl || undefined}
                          sx={{ width: 20, height: 20 }}
                        >
                          {(mail.senderName || mail.senderEmail || "?")[0]}
                        </Avatar>
                        <Typography variant="caption" color="text.secondary">
                          {mail.senderName || mail.senderEmail || "알 수 없음"}
                        </Typography>
                      </Stack>
                      
                      <Typography variant="caption" color="text.secondary">
                        {formatMailTime(mail.sentTime)}
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>
                {index < recentMails.length - 1 && <Divider />}
              </Box>
            );
          })}
        </Box>
      )}
    </Card>
  );
}

