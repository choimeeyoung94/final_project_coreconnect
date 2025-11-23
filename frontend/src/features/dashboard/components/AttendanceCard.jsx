import { Box, Button, Chip, Typography, useTheme } from "@mui/material";
import { checkIn, checkOut, getTodayAttendance } from "../../attendance/api/attendanceAPI";
import { formatKoreanDate, formatKoreanTime, formatTime } from "../../../utils/TimeUtils";
import { useState, useEffect } from "react";
import { Link as RouterLink } from "react-router-dom";
import Card from "../../../components/ui/Card";
import http from "../../../api/http";
import { useSnackbarContext } from "../../../components/utils/SnackbarContext";
import { getAttendanceStatusLabel } from "../../../utils/labelUtils";
import WeeklyProgressBar from "../../attendance/components/WeeklyProgressBar";

function AttendanceCard() {
  const { showSnack } = useSnackbarContext();
  const theme = useTheme();
  const [now, setNow] = useState(new Date());
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(true);

  const [weeklyMinutes, setWeeklyMinutes] = useState(0);
  const [loadingWeekly, setLoadingWeekly] = useState(true);
  const [weeklyError, setWeeklyError] = useState("");
  
  const dateString = formatKoreanDate(now);
  const timeString = formatKoreanTime(now);
  
  const checkInTime = formatTime(attendance?.checkIn) || "-";
  const checkOutTime = formatTime(attendance?.checkOut) || "-";
  const status = attendance?.status || "ABSENT";
  const canCheckIn = status === "ABSENT"; 
  const canCheckOut = status === "PRESENT" || status === "LATE"; 
  
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await getTodayAttendance();
        setAttendance(data);
      } catch (e) {
        console.error("근태 조회 실패:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  
  useEffect(() => {
    loadAttendance();   
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoadingWeekly(true);
        setWeeklyError("");

        const today = new Date().toISOString().slice(0, 10); 
        const res = await http.get("/attendance/me/weekly", {
          params: {date: today},
        });
        
        setWeeklyMinutes(res.data ?? 0);
      } catch (e) {
        console.error(e);
        setWeeklyError("주간 누적 근무시간 불러오기 실패");
      } finally {
        setLoadingWeekly(false);
      }
    })();
  }, []);

  const loadAttendance = async () => {
    try {
      setLoading(true);
      const data = await getTodayAttendance();
      setAttendance(data);
    } catch (err) {
      console.error("근태 조회 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    try {
      await checkIn();
      await loadAttendance();
      showSnack("출근 처리되었습니다.", "success");
    } catch (err) {
      console.error(err);
      showSnack("출근 처리에 실패했습니다.", "error");
    }
  };

  const handleCheckOut = async () => {
    try {
      await checkOut();
      await loadAttendance();
      showSnack("퇴근 처리되었습니다.", "success");
    } catch (err) {
      console.error(err);
      showSnack("퇴근 처리에 실패했습니다.", "error");
    }
  };




  return (
    <Card
      title="근태"
      right={
        <Button component={RouterLink} to="/attendance" size="small" sx={{ textTransform: "none" }}>
          근태현황 바로가기
        </Button>
      }
    >
      {/* 날짜 + 현재 시각 */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="body2" color="text.secondary">
            {dateString} {timeString}
          </Typography>
        </Box>
        <Chip
          label={
            status === "PRESENT" || status === "LATE"
              ? "근무중"
              : status === "LEAVE_EARLY" || status === "COMPLETED"
              ? "퇴근"
              : getAttendanceStatusLabel(status)
          }
          size="small"
          variant="outlined"
          sx={{ fontSize: 12, borderRadius: 999, px: 1 }}
        />
      </Box>

      {/* 출근 / 퇴근 박스 */}
      <Box
        sx={{
          bgcolor: theme.palette.background.secondary,
          borderRadius: 3,
          px: 3,
          py: 2.5,
          mb: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 3,
        }}
      >
        {/* 출근 시간 */}
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            출근 시간
          </Typography>
          <Typography variant="h6" fontWeight={700}>
            { checkInTime }
          </Typography>
        </Box>

        {/* 화살표 */}
        <Box sx={{ fontSize: 24, color: "text.disabled" }}>→</Box>

        {/* 퇴근 시간 */}
        <Box sx={{ textAlign: "right" }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            퇴근 시간
          </Typography>
          <Typography variant="h6" fontWeight={700}>
            { checkOutTime }
          </Typography>
        </Box>
      </Box>

      {/* 주간 누적 영역 */}
      <Box sx={{ mb: 3 }}>
        <WeeklyProgressBar 
          weeklyMinutes={weeklyMinutes}
          loadingWeekly={loadingWeekly}
          weeklyError={weeklyError}
        />
      </Box>


      {/* 출근 / 퇴근 버튼 */}
      <Box sx={{ display: "flex", gap: 1, mb: 1.5 }}>
        <Button fullWidth 
                variant="outlined" 
                onClick={handleCheckIn} 
                disabled={!canCheckIn}>
          출근하기
        </Button>
        <Button fullWidth
                variant="outlined" 
                onClick={handleCheckOut} 
                disabled={!canCheckOut}>
          퇴근하기
        </Button>
      </Box>
    </Card>
  );
}
export default AttendanceCard;
