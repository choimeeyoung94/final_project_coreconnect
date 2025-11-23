import { Box, LinearProgress, Typography } from "@mui/material";
import { formatHM } from "../../../utils/TimeUtils";

const TARGET_WEEKLY_MINUTES = 40 * 60; 
const MAX_WEEKLY_MINUTES = 52 * 60;

function WeeklyProgressBar({ weeklyMinutes, loadingWeekly, weeklyError }) {
  return (
    <Box>
      {loadingWeekly ? (
        <Typography variant="body2" color="text.secondary">
          주간 누적 근무시간을 불러오는 중...
        </Typography>
      ) : weeklyError ? (
        <Typography variant="body2" color="error">
          {weeklyError}
        </Typography>
      ) : (
        <>
          {/* 상단 "주간누적 44h 31m" 부분 */}
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            주간누적{" "}
            <Box
              component="span"
              sx={{ color: "success.main", fontWeight: 700 }}
            >
              {formatHM(weeklyMinutes)}
            </Box>
          </Typography>

          {/* 40h까지 남은 시간 안내 문구 */}
          {weeklyMinutes < TARGET_WEEKLY_MINUTES ? (
            <Typography variant="caption" color="text.secondary">
              이번주{" "}
              {formatHM(TARGET_WEEKLY_MINUTES - weeklyMinutes)} 더 필요해요.
            </Typography>
          ) : (
            <Typography variant="caption" color="success.main">
              이번주 기준 근무시간(40h)을 채웠어요!
            </Typography>
          )}

          {/* 진행 바 + 0h / 40h / 52h */}
          <Box sx={{ mt: 1.5, position: "relative" }}>
            <LinearProgress
              variant="determinate"
              value={Math.min(
                (weeklyMinutes / MAX_WEEKLY_MINUTES) * 100,
                100
              )}
              sx={{ height: 8, borderRadius: 999 }}
            />

            {/* 이모지 */}
            <Box
              sx={{
                position: "absolute",
                right: -10,
                top: -18,
                fontSize: 28,
              }}
            >
              🐰
            </Box>

            <Box sx={{ position: "relative", mt: 1, mb: 5 }}>
              {/* 눈금 라벨들 */}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ position: "absolute", left: 0 }}
              >
                0h
              </Typography>

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  position: "absolute",
                  left: `${(40 / 52) * 100}%`, // 40h가 전체의 77% 지점에 오도록
                  transform: "translateX(-50%)",
                }}
              >
                40h
              </Typography>

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ position: "absolute", right: 0 }}
              >
                52h
              </Typography>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}

export default WeeklyProgressBar;

