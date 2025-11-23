package com.goodee.coreconnect.attendance.dto.response;

import java.time.LocalDate;
import java.time.LocalDateTime;

import com.goodee.coreconnect.attendance.enums.AttendanceStatus;

/** 일별 근태 상세 정보 DTO */
public record DailyAttendanceDTO(
    LocalDate date,              
    String dayOfWeek,           
    LocalDateTime checkIn,       
    LocalDateTime checkOut,      
    AttendanceStatus status,     
    int workMinutes,             
    boolean isLeave              // 휴가 여부
) {}

