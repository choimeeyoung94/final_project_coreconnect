import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  ToggleButton, 
  ToggleButtonGroup, 
  Chip, 
  Container,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from "@mui/material";
import { useState, useEffect } from "react";
import { formatHM, formatTime, formatKoreanDate } from "../../../utils/TimeUtils";
import { getAttendanceStatistics, getWeeklyAttendanceDetail, getMonthlyAttendanceDetail } from "../api/attendanceAPI";
import { getAttendanceStatusLabel } from "../../../utils/labelUtils";
import http from "../../../api/http";
import WeeklyProgressBar from "./WeeklyProgressBar";

function MyAttendanceStatus() {
  const [period, setPeriod] = useState("weekly"); // "weekly" or "monthly"
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [stats, setStats] = useState({
    totalWorkDays: 0,  // 총 근무일수
    workDays: 0,
    lateDays: 0,
    absentDays: 0,
    leaveDays: 0,  // 휴가일수
    totalWorkMinutes: 0,
  });
  const [dailyAttendances, setDailyAttendances] = useState([]);
  
  // 주간 누적 근무시간 관련 state
  const [weeklyMinutes, setWeeklyMinutes] = useState(0);
  const [loadingWeekly, setLoadingWeekly] = useState(true);
  const [weeklyError, setWeeklyError] = useState("");

  useEffect(() => {
    loadStatistics();
    if (period === "weekly") {
      loadWeeklyDetail();
      loadWeeklyMinutes();
    } else {
      loadMonthlyDetail();
    }
  }, [period]);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      try {
        const data = await getAttendanceStatistics(period, today);
        setStats(data);
      } catch (err) {
        // API가 아직 구현되지 않은 경우 임시 데이터 사용
        console.warn("통계 API 호출 실패, 임시 데이터 사용:", err);
        setStats({
          totalWorkDays: period === "weekly" ? 5 : 22,
          workDays: period === "weekly" ? 3 : 15,
          lateDays: period === "weekly" ? 1 : 2,
          absentDays: period === "weekly" ? 1 : 3,
          leaveDays: period === "weekly" ? 0 : 2,
          totalWorkMinutes: period === "weekly" ? 24 * 60 : 120 * 60,
        });
      }
    } catch (err) {
      console.error("통계 조회 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadWeeklyDetail = async () => {
    try {
      setLoadingDetail(true);
      const today = new Date().toISOString().slice(0, 10);
      try {
        const data = await getWeeklyAttendanceDetail(today);
        setDailyAttendances(data.dailyAttendances || []);
      } catch (err) {
        console.warn("주간 상세 API 호출 실패:", err);
        setDailyAttendances([]);
      }
    } catch (err) {
      console.error("주간 상세 조회 실패:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const loadMonthlyDetail = async () => {
    try {
      setLoadingDetail(true);
      const today = new Date().toISOString().slice(0, 10);
      try {
        const data = await getMonthlyAttendanceDetail(today);
        setDailyAttendances(data.dailyAttendances || []);
      } catch (err) {
        console.warn("월간 상세 API 호출 실패:", err);
        setDailyAttendances([]);
      }
    } catch (err) {
      console.error("월간 상세 조회 실패:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const loadWeeklyMinutes = async () => {
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
  };

  const handlePeriodChange = (event, newPeriod) => {
    if (newPeriod !== null) {
      setPeriod(newPeriod);
    }
  };

  const getStatusInfo = (status) => {
    const label = getAttendanceStatusLabel(status);
    switch (status) {
      case "PRESENT":
        return { label, color: "success" };
      case "LATE":
        return { label, color: "warning" };
      case "COMPLETED":
        return { label: "퇴근", color: "info" };
      case "ABSENT":
      default:
        return { label, color: "default" };
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* 헤더 */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
        <Typography variant="h6">
          내 근태현황
        </Typography>
        <ToggleButtonGroup
          value={period}
          exclusive
          onChange={handlePeriodChange}
          size="small"
        >
          <ToggleButton value="weekly">주간</ToggleButton>
          <ToggleButton value="monthly">월간</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* 통계 요약 */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h8" sx={{ mb: 2 }}>
          {period === "weekly" ? "주간" : "월간"} 통계
        </Typography>
        {loading ? (
          <Typography variant="body2" color="text.secondary">
            불러오는 중...
          </Typography>
        ) : (
          <Box>
            <Box sx={{ mb: 3 }}>
              <Typography variant="body1" sx={{ mb: 2 }}>
                총 <Box component="span" sx={{ fontWeight: 700, color: "primary.main" }}>{stats.totalWorkDays}근무일</Box> 중
              </Typography>
              <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    근무
                  </Typography>
                  <Typography variant="h6">
                    {stats.workDays}일
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    지각
                  </Typography>
                  <Typography variant="h6">
                    {stats.lateDays}일
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    결근
                  </Typography>
                  <Typography variant="h6">
                    {stats.absentDays}일
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    휴가
                  </Typography>
                  <Typography variant="h6">
                    {stats.leaveDays}일
                  </Typography>
                </Box>
                <Box sx={{ ml: "auto" }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    총 근무시간
                  </Typography>
                  <Typography variant="h6">
                    {formatHM(stats.totalWorkMinutes)}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        )}
      </Paper>

      {/* 주간 누적 진행도 바 (주간 모드일 때만 표시) */}
      {period === "weekly" && (
        <Paper sx={{ p: 3, mb: 4 }}>
          <WeeklyProgressBar 
            weeklyMinutes={weeklyMinutes}
            loadingWeekly={loadingWeekly}
            weeklyError={weeklyError}
          />
        </Paper>
      )}

      {/* 상세 정보 */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {period === "weekly" ? "주간" : "월간"} 근태 상세
        </Typography>
        {loadingDetail ? (
          <Typography variant="body2" color="text.secondary">
            불러오는 중...
          </Typography>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>날짜</TableCell>
                  <TableCell>요일</TableCell>
                  <TableCell>출근 시간</TableCell>
                  <TableCell>퇴근 시간</TableCell>
                  <TableCell>상태</TableCell>
                  <TableCell align="right">근무 시간</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dailyAttendances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary">
                        데이터가 없습니다.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  dailyAttendances.map((daily, index) => {
                    const statusInfo = getStatusInfo(daily.status);
                    const isWeekend = daily.dayOfWeek === "토" || daily.dayOfWeek === "일";
                    const isLeave = daily.isLeave || false;
                    
                    return (
                      <TableRow 
                        key={index}
                        sx={{
                          bgcolor: (isWeekend || isLeave) ? "action.hover" : "inherit",
                          "&:hover": { bgcolor: "action.selected" }
                        }}
                      >
                        <TableCell>
                          {new Date(daily.date).toLocaleDateString("ko-KR", {
                            month: "2-digit",
                            day: "2-digit"
                          })}
                        </TableCell>
                        <TableCell>
                          <Typography 
                            variant="body2" 
                            color={isWeekend ? "text.secondary" : "text.primary"}
                          >
                            {daily.dayOfWeek}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {isLeave ? "-" : (daily.checkIn ? formatTime(daily.checkIn) : "-")}
                        </TableCell>
                        <TableCell>
                          {isLeave ? "-" : (daily.checkOut ? formatTime(daily.checkOut) : "-")}
                        </TableCell>
                        <TableCell>
                          {isWeekend ? (
                            <Typography variant="body2" color="text.secondary">
                              -
                            </Typography>
                          ) : isLeave ? (
                            <Chip
                              label="휴가"
                              color="info"
                              size="small"
                              variant="outlined"
                            />
                          ) : (
                            <Chip
                              label={statusInfo.label}
                              color={statusInfo.color}
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {isLeave ? "-" : (daily.workMinutes > 0 ? formatHM(daily.workMinutes) : "-")}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Container>
  );
}

export default MyAttendanceStatus;

