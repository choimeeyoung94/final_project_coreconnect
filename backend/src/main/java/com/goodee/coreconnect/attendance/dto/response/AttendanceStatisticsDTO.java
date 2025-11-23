package com.goodee.coreconnect.attendance.dto.response;

/** 주간/월간 통계용 DTO */
public record AttendanceStatisticsDTO(
    int totalWorkDays,   // 총 근무일수 (주말만 제외, 평일 전체)
    int workDays,        // 근무일수
    int lateDays,        // 지각일수
    int absentDays,      // 결근일수
    int leaveDays,       // 휴가일수
    int totalWorkMinutes // 총 근무시간(분)
) {}


