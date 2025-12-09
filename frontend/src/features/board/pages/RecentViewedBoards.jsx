import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRecentViewedBoards } from "../api/boardAPI";
import { Box, Typography, Paper, List, ListItemButton, ListItemText, Divider } from "@mui/material";
import { useSnackbarContext } from "../../../components/utils/SnackbarContext";


const RecentViewedBoards = () => {
  const [boards, setBoards] = useState([]); // 최근 본 게시글 목록을 저장할 상태 변수
  const navigate = useNavigate(); // 특정 게시글 상세 페이지로 이동하기 위한 훅
  const { showSnack } = useSnackbarContext(); // 에러 발생 시 사용자 알림

  // 컴포넌트가 처음 렌더링될 때 실행
  useEffect(() => {
    // 비동기 즉시실행 함수(async IIFE): 최근 게시글 목록을 서버에서 가져옴
    (async () => {
      try {
        const res = await getRecentViewedBoards(); // 최근 본 게시글 API 호출
        setBoards(res.data.data || []); // 응답 데이터가 존재하면 boards 상태에 저장, 없으면 빈 배열
      } catch (err) {
        showSnack("최근 본 게시글을 불러오는 중 오류가 발생했습니다.", "error"); // 사용자 알림
      }
    })();
  }, []); // 의존성 배열이 비어있으므로 최초 1회만 실행됨 (마운트 시점)

  const formatDate = (dateStr) => {
    if (!dateStr) return "";

    try {
      let d;
      const dateString = String(dateStr);
      
      // ISO 8601 형식인 경우 (서버에서 "2025-11-25T00:42:00" 형식으로 보냄)
      if (dateString.includes('T')) {
        // 타임존 정보가 없으면 한국 시간(UTC+9)으로 간주하여 파싱
        if (!dateString.includes('Z') && !dateString.includes('+') && !dateString.match(/-\d{2}:\d{2}$/)) {
          // "2025-11-25T00:42:00" 형식을 한국 시간으로 파싱
          const [datePart, timePart] = dateString.split('T');
          const [year, month, day] = datePart.split('-');
          const [timeOnly] = (timePart || '').split('.');
          const [hour, minute, second = '00'] = (timeOnly || '').split(':');
          
          // UTC로 Date 객체 생성 후 한국 시간(UTC+9)으로 변환
          d = new Date(Date.UTC(
            parseInt(year, 10),
            parseInt(month, 10) - 1,
            parseInt(day, 10),
            parseInt(hour, 10),
            parseInt(minute, 10),
            parseInt(second, 10)
          ));
          // 한국 시간은 UTC+9이므로 9시간을 빼서 UTC로 변환
          d = new Date(d.getTime() - (9 * 60 * 60 * 1000));
        } else {
          d = new Date(dateString);
        }
      } else {
        d = new Date(dateStr);
      }
      
      // 한국 시간으로 변환하여 포맷팅
      const koreaTimeStr = d.toLocaleString('en-US', { timeZone: 'Asia/Seoul' });
      const koreaTime = new Date(koreaTimeStr);

      const mm = String(koreaTime.getMonth() + 1).padStart(2, "0");
      const dd = String(koreaTime.getDate()).padStart(2, "0");
      const hh = String(koreaTime.getHours()).padStart(2, "0");
      const mi = String(koreaTime.getMinutes()).padStart(2, "0");

      return `${mm}-${dd} ${hh}:${mi}`;
    } catch (error) {
      console.error('[RecentViewedBoards] formatDate 에러:', error, dateStr);
      return "";
    }
  };

  // 화면 렌더링
  return (
    <Box sx={{ width: "100%", mt: 4, textAlign: "center" }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        🔍 최근 본 게시글
      </Typography>

      {boards.length === 0 ? (
        <Typography color="text.secondary">최근 본 게시글이 없습니다.</Typography>
      ) : (
        <Paper
          variant="outlined"
          sx={{
            width: "85%",
            mx: "auto",
            borderRadius: 3,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <List>
            {boards.map((b, idx) => (
              <React.Fragment key={b.id}>

                <ListItemButton
                  onClick={() => navigate(`/board/detail/${b.id}`, { state: { fromAllBoard: location.pathname === "/board" } })}
                  sx={{
                    py: 0.1,
                    borderRadius: 2,
                    transition: "0.15s",
                    "&:hover": {
                      bgcolor: "#f2f8ff",
                      transform: "translateX(4px)"
                    }
                  }}
                >

                  <span
                    style={{
                      fontSize: "18px",
                      marginRight: "14px",
                      opacity: 0.9,
                    }}
                  >
                    {b.pinned || b.noticeYn ? "📢" : "📄"}
                  </span>

                  <ListItemText
                    primary={b.title}
                    primaryTypographyProps={{
                      sx: {
                        fontWeight: 600,
                        lineHeight: 1.2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        mb: 0
                      },
                    }}
                    secondary={`${formatDate(
                      b.createdAt
                    )}`}
                    secondaryTypographyProps={{
                      sx: {
                        color: "text.secondary",
                        fontSize: "0.75rem",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        mt: 0
                      },
                    }}
                  />
                </ListItemButton>

                {idx < boards.length - 1 && (
                  <Divider sx={{ my: 1 }} />
                )}

              </React.Fragment>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
};

export default RecentViewedBoards;
