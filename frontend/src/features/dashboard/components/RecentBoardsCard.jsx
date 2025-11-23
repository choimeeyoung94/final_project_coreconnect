import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Card from "../../../components/ui/Card";
import { 
  Button, 
  Typography, 
  Box, 
  Divider,
  Avatar,
  Stack,
  Chip
} from "@mui/material";
import { getBoardsByLatestOnly } from "../api/dashboardAPI";
import { getJobGradeLabel } from "../../../utils/labelUtils";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CommentIcon from "@mui/icons-material/Comment";

export default function RecentBoardsCard() {
  const navigate = useNavigate();
  const [recentBoards, setRecentBoards] = useState([]);
  const [loading, setLoading] = useState(true);

  // 전체게시판 최근글 5개 가져오기 (공지/상단고정 구분 없이 최신순만)
  useEffect(() => {
    (async () => {
      try {
        const res = await getBoardsByLatestOnly(0, 5);
        setRecentBoards(res.data?.content || []);
      } catch (err) {
        console.error("게시글 목록 불러오기 실패:", err);
        setRecentBoards([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 날짜 포맷 함수 (MM-DD HH:mm 형식)
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes()
    ).padStart(2, "0")}`;
  };

  return (
    <Card
      title="전체게시판 최근글"
      right={
        <Button
          component={Link}
          to="/board"
          size="small"
          sx={{ textTransform: "none" }}
        >
          전체보기
        </Button>
      }
    >
      {loading ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
          로딩 중...
        </Typography>
      ) : recentBoards.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
          게시글이 없습니다.
        </Typography>
      ) : (
        <Box>
          {recentBoards.map((board, index) => (
            <Box key={board.id}>
              <Box
                data-grid-cancel="true"
                onClick={() => navigate(`/board/detail/${board.id}`)}
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
                  {/* 제목과 고정 아이콘 */}
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                    {board.pinned && (
                      <Chip
                        label="고정"
                        size="small"
                        color="warning"
                        sx={{ 
                          height: 20, 
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          flexShrink: 0
                        }}
                      />
                    )}
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
                      {board.title}
                    </Typography>
                  </Box>

                  {/* 카테고리 */}
                  {board.categoryName && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: "primary.main",
                        fontWeight: 500,
                      }}
                    >
                      {board.categoryName}
                    </Typography>
                  )}

                  {/* 작성자, 날짜, 조회수, 댓글수 */}
                  <Stack 
                    direction="row" 
                    alignItems="center" 
                    spacing={1.5}
                    sx={{ flexWrap: "wrap" }}
                  >
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <Avatar
                        src={board.writerProfileImageUrl || undefined}
                        sx={{ width: 20, height: 20 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {board.writerName}
                        {board.writerJobGrade && ` ${getJobGradeLabel(board.writerJobGrade)}`}
                      </Typography>
                    </Stack>
                    
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(board.createdAt)}
                    </Typography>

                    {board.viewCount !== undefined && board.viewCount !== null && (
                      <Stack direction="row" alignItems="center" spacing={0.3}>
                        <VisibilityIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                        <Typography variant="caption" color="text.secondary">
                          {board.viewCount}
                        </Typography>
                      </Stack>
                    )}

                    {board.commentCount !== undefined && board.commentCount > 0 && (
                      <Stack direction="row" alignItems="center" spacing={0.3}>
                        <CommentIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                        <Typography variant="caption" color="text.secondary">
                          {board.commentCount}
                        </Typography>
                      </Stack>
                    )}
                  </Stack>
                </Stack>
              </Box>
              {index < recentBoards.length - 1 && <Divider />}
            </Box>
          ))}
        </Box>
      )}
    </Card>
  );
}

