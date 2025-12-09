package com.goodee.coreconnect.attendance.service;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.goodee.coreconnect.attendance.constants.AttendanceConstants;
import com.goodee.coreconnect.attendance.dto.response.AttendanceStatisticsDTO;
import com.goodee.coreconnect.attendance.dto.response.CompanyAttendanceResponseDTO;
import com.goodee.coreconnect.attendance.dto.response.DailyAttendanceDTO;
import com.goodee.coreconnect.attendance.dto.response.MonthlyAttendanceDetailDTO;
import com.goodee.coreconnect.attendance.dto.response.TodayAttendanceResponseDTO;
import com.goodee.coreconnect.attendance.dto.response.WeeklyAttendanceDetailDTO;
import com.goodee.coreconnect.attendance.entity.Attendance;
import com.goodee.coreconnect.attendance.enums.AttendanceStatus;
import com.goodee.coreconnect.attendance.repository.AttendanceRepository;
import com.goodee.coreconnect.leave.entity.LeaveRequest;
import com.goodee.coreconnect.leave.enums.LeaveStatus;
import com.goodee.coreconnect.leave.repository.LeaveRequestRepository;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Status;
import com.goodee.coreconnect.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class AttendanceServiceImpl implements AttendanceService {
  
  private final AttendanceRepository attendanceRepository;
  private final UserRepository userRepository;
  private final LeaveRequestRepository leaveRequestRepository;
  
  /** 출근 처리 */
  public void checkIn(String email) {
    LocalDate today = LocalDate.now();
    LocalDateTime now = LocalDateTime.now();
    LocalTime nowTime = now.toLocalTime();
    
    // 이미 오늘 출근 기록이 있는지 확인
    attendanceRepository.findByUser_EmailAndWorkDate(email, today)
                        .ifPresent(att -> {
                          throw new IllegalStateException("이미 오늘 출근 기록이 있습니다.");
                        });
    
    // 이메일로 유저 찾기
    User user = userRepository.findByEmail(email)
                              .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다: " + email));
    
    // 지각 여부 판별
    AttendanceStatus status;
    if(nowTime.isAfter(AttendanceConstants.STANDARD_START_TIME)) {
      status = AttendanceStatus.LATE; // 기준 시간 이후면 지각처리
    } else {
      status = AttendanceStatus.PRESENT;
    }
    
    Attendance attendance = Attendance.createAttendance(user, status, null, now);
    attendance.setWorkDate(today);
    attendance.setCreatedAt(now);
    attendance.setUpdatedAt(now);
    
    attendanceRepository.save(attendance);
  }
  
  /** 퇴근 처리 */
  public void checkOut(String email) {
    LocalDate today = LocalDate.now();
    
    Attendance attendance = attendanceRepository.findByUser_EmailAndWorkDate(email, today)
                                                .orElseThrow(() -> new IllegalStateException("오늘 출근 기록이 없습니다."));
    if(attendance.getCheckOut() != null) {
      throw new IllegalStateException("이미 퇴근 처리가 완료되었습니다.");
    }
    
    attendance.checkOut(AttendanceConstants.STANDARD_END_TIME);
    attendance.setUpdatedAt(today.atStartOfDay());
  }
  
  /** 오늘 근태 조회 */
  @Transactional(readOnly = true)
  public TodayAttendanceResponseDTO getTodayAttendance(String email) {
    LocalDate today = LocalDate.now();
    
    return attendanceRepository
             .findByUser_EmailAndWorkDate(email, today)
             .map(att -> new TodayAttendanceResponseDTO(
                att.getWorkDate(),
                att.getCheckIn(),
                att.getCheckOut(),
                att.getStatus()
              ))
             .orElseGet(() -> new TodayAttendanceResponseDTO(
                   today,
                   null,
                   null,
                   AttendanceStatus.ABSENT
                 ));
  }

  /** 주간 누적 근무 시간 구하기 */
  @Override
  @Transactional(readOnly = true)
  public int getWeeklyWorkMinutes(String email, LocalDate anyDateInWeek) {
    
    // 이메일로 사용자 조회
    User user = userRepository.findByEmail(email)
                              .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다: " + email));
    
    // 현재 일이 속한 주의 월요일 ~ 일요일 구하기
    LocalDate startOfWeek = anyDateInWeek.with(DayOfWeek.MONDAY);
    LocalDate endOfWeek = startOfWeek.plusDays(6);
    
    // 해당 주의 근태 기록 모두 조회
    List<Attendance> attendanceList = attendanceRepository.findByUser_IdAndWorkDateBetween(user.getId(), startOfWeek, endOfWeek);
    
    // 해당 기간 내 승인된 휴가 조회
    List<LeaveRequest> approvedLeaves = leaveRequestRepository.findByUserAndStatusAndDateRange(
        user, LeaveStatus.APPROVED, startOfWeek, endOfWeek);
    
    // 휴가 날짜 Set 생성 (시작일부터 종료일까지 모든 날짜 포함)
    Set<LocalDate> leaveDates = new HashSet<>();
    for (LeaveRequest leave : approvedLeaves) {
      LocalDate leaveStart = leave.getStartDate();
      LocalDate leaveEnd = leave.getEndDate();
      for (LocalDate date = leaveStart; !date.isAfter(leaveEnd); date = date.plusDays(1)) {
        leaveDates.add(date);
      }
    }
    
    LocalDate today = LocalDate.now();
    int totalMinutes = 0;
    
    // 주의 각 날짜를 순회하며 평일만 계산 (주간 통계와 동일한 로직)
    for (LocalDate date = startOfWeek; !date.isAfter(endOfWeek); date = date.plusDays(1)) {
      // 주말 제외 (토요일, 일요일)
      if (date.getDayOfWeek() == DayOfWeek.SATURDAY || date.getDayOfWeek() == DayOfWeek.SUNDAY) {
        continue;
      }
      
      // 미래 날짜는 제외
      if (date.isAfter(today)) {
        continue;
      }
      
      // 해당 날짜의 근태 기록 찾기
      final LocalDate currentDate = date;
      
      // 휴가인지 확인
      boolean isLeave = leaveDates.contains(currentDate);
      if (isLeave) {
        continue;  // 휴가는 근무 시간에 포함하지 않음
      }
      
      Attendance attendance = attendanceList.stream()
          .filter(att -> att.getWorkDate() != null && att.getWorkDate().equals(currentDate))
          .findFirst()
          .orElse(null);
      
      if (attendance == null || attendance.getCheckIn() == null) {
        // 출근 기록이 없으면 스킵
        continue;
      }
      
      // 근무 시간 계산
      LocalDateTime checkIn = attendance.getCheckIn();
      LocalDateTime checkOut = attendance.getCheckOut();
      
      LocalDateTime endDateTime;
      if (checkOut != null) {
        // 정상적으로 퇴근한 날
        endDateTime = checkOut;
      } else if (currentDate.equals(today)) {
        // 오늘인데 아직 퇴근 안 찍은 경우 -> 지금까지 근무한 시간 포함
        endDateTime = LocalDateTime.now();
      } else {
        // 과거인데 퇴근 시간이 없으면 스킵
        continue;
      }
      
      long minutes = Duration.between(checkIn, endDateTime).toMinutes();
      if (minutes > 0) {
        totalMinutes += (int) minutes;
      }
    }
   
    return totalMinutes;
  }

  /** 주간 근태 통계 조회 */
  @Override
  @Transactional(readOnly = true)
  public AttendanceStatisticsDTO getWeeklyStatistics(String email, LocalDate anyDateInWeek) {
    User user = userRepository.findByEmail(email)
                              .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다: " + email));
    
    // 주의 시작일(월요일)과 종료일(일요일) 구하기
    LocalDate startOfWeek = anyDateInWeek.with(DayOfWeek.MONDAY);
    LocalDate endOfWeek = startOfWeek.plusDays(6);
    
    // 해당 주의 근태 기록 모두 조회
    List<Attendance> attendanceList = attendanceRepository.findByUser_IdAndWorkDateBetween(
        user.getId(), startOfWeek, endOfWeek);
    
    // 해당 기간 내 승인된 휴가 조회
    List<LeaveRequest> approvedLeaves = leaveRequestRepository.findByUserAndStatusAndDateRange(
        user, LeaveStatus.APPROVED, startOfWeek, endOfWeek);
    
    // 휴가 날짜 Set 생성 (시작일부터 종료일까지 모든 날짜 포함)
    Set<LocalDate> leaveDates = new HashSet<>();
    for (LeaveRequest leave : approvedLeaves) {
      LocalDate leaveStart = leave.getStartDate();
      LocalDate leaveEnd = leave.getEndDate();
      for (LocalDate date = leaveStart; !date.isAfter(leaveEnd); date = date.plusDays(1)) {
        leaveDates.add(date);
      }
    }
    
    LocalDate today = LocalDate.now();
    int totalWorkDays = 0;  // 총 근무일수 (주말만 제외, 평일 전체)
    int workDays = 0;
    int lateDays = 0;
    int leaveEarlyDays = 0;  // 조퇴일수
    int absentDays = 0;
    int leaveDays = 0;  // 휴가일수 (평일 중 휴가인 날짜)
    int totalMinutes = 0;
    
    // 주의 각 날짜를 순회하며 통계 계산
    for (LocalDate date = startOfWeek; !date.isAfter(endOfWeek); date = date.plusDays(1)) {
      // 주말 제외 (토요일, 일요일)
      if (date.getDayOfWeek() == DayOfWeek.SATURDAY || date.getDayOfWeek() == DayOfWeek.SUNDAY) {
        continue;
      }
      
      // 미래 날짜는 제외
      if (date.isAfter(today)) {
        continue;
      }
      
      // 총 근무일수 카운트 (평일 전체)
      totalWorkDays++;
      
      // 해당 날짜의 근태 기록 찾기 (effectively final 변수로 복사)
      final LocalDate currentDate = date;
      
      // 휴가인지 확인
      boolean isLeave = leaveDates.contains(currentDate);
      if (isLeave) {
        leaveDays++;
        continue;  // 휴가는 근태 기록 확인하지 않음
      }
      
      Attendance attendance = attendanceList.stream()
          .filter(att -> att.getWorkDate().equals(currentDate))
          .findFirst()
          .orElse(null);
      
      if (attendance == null || attendance.getCheckIn() == null) {
        // 출근 기록이 없으면 결근
        absentDays++;
      } else {
        // 출근 기록이 있으면
        AttendanceStatus status = attendance.getStatus();
        if (status == AttendanceStatus.LATE) {
          lateDays++;
        } else if (status == AttendanceStatus.LEAVE_EARLY) {
          leaveEarlyDays++;
        }
        workDays++;
        
        // 근무 시간 계산
        LocalDateTime checkIn = attendance.getCheckIn();
        LocalDateTime checkOut = attendance.getCheckOut();
        
        LocalDateTime endDateTime;
        if (checkOut != null) {
          endDateTime = checkOut;
        } else if (currentDate.equals(today)) {
          // 오늘인데 아직 퇴근 안 찍은 경우
          endDateTime = LocalDateTime.now();
        } else {
          // 과거인데 퇴근 시간이 없으면 스킵
          continue;
        }
        
        long minutes = Duration.between(checkIn, endDateTime).toMinutes();
        if (minutes > 0) {
          totalMinutes += (int) minutes;
        }
      }
    }
    
    return new AttendanceStatisticsDTO(totalWorkDays, workDays, lateDays, leaveEarlyDays, absentDays, leaveDays, totalMinutes);
  }

  /** 월간 근태 통계 조회 */
  @Override
  @Transactional(readOnly = true)
  public AttendanceStatisticsDTO getMonthlyStatistics(String email, LocalDate anyDateInMonth) {
    User user = userRepository.findByEmail(email)
                              .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다: " + email));
    
    // 월의 시작일과 종료일 구하기
    LocalDate startOfMonth = anyDateInMonth.withDayOfMonth(1);
    LocalDate endOfMonth = anyDateInMonth.withDayOfMonth(anyDateInMonth.lengthOfMonth());
    
    // 해당 월의 근태 기록 모두 조회
    List<Attendance> attendanceList = attendanceRepository.findByUser_IdAndWorkDateBetween(
        user.getId(), startOfMonth, endOfMonth);
    
    // 해당 기간 내 승인된 휴가 조회
    List<LeaveRequest> approvedLeaves = leaveRequestRepository.findByUserAndStatusAndDateRange(
        user, LeaveStatus.APPROVED, startOfMonth, endOfMonth);
    
    // 휴가 날짜 Set 생성 (시작일부터 종료일까지 모든 날짜 포함)
    Set<LocalDate> leaveDates = new HashSet<>();
    for (LeaveRequest leave : approvedLeaves) {
      LocalDate leaveStart = leave.getStartDate();
      LocalDate leaveEnd = leave.getEndDate();
      for (LocalDate date = leaveStart; !date.isAfter(leaveEnd); date = date.plusDays(1)) {
        leaveDates.add(date);
      }
    }
    
    LocalDate today = LocalDate.now();
    int totalWorkDays = 0;  // 총 근무일수 (주말만 제외, 평일 전체)
    int workDays = 0;
    int lateDays = 0;
    int leaveEarlyDays = 0;  // 조퇴일수
    int absentDays = 0;
    int leaveDays = 0;  // 휴가일수 (평일 중 휴가인 날짜)
    int totalMinutes = 0;
    
    // 월의 각 날짜를 순회하며 통계 계산
    for (LocalDate date = startOfMonth; !date.isAfter(endOfMonth); date = date.plusDays(1)) {
      // 주말 제외 (토요일, 일요일)
      if (date.getDayOfWeek() == DayOfWeek.SATURDAY || date.getDayOfWeek() == DayOfWeek.SUNDAY) {
        continue;
      }
      
      // 미래 날짜는 제외
      if (date.isAfter(today)) {
        continue;
      }
      
      // 총 근무일수 카운트 (평일 전체)
      totalWorkDays++;
      
      // 해당 날짜의 근태 기록 찾기 (effectively final 변수로 복사)
      final LocalDate currentDate = date;
      
      // 휴가인지 확인
      boolean isLeave = leaveDates.contains(currentDate);
      if (isLeave) {
        leaveDays++;
        continue;  // 휴가는 근태 기록 확인하지 않음
      }
      
      Attendance attendance = attendanceList.stream()
          .filter(att -> att.getWorkDate().equals(currentDate))
          .findFirst()
          .orElse(null);
      
      if (attendance == null || attendance.getCheckIn() == null) {
        // 출근 기록이 없으면 결근
        absentDays++;
      } else {
        // 출근 기록이 있으면
        AttendanceStatus status = attendance.getStatus();
        if (status == AttendanceStatus.LATE) {
          lateDays++;
        } else if (status == AttendanceStatus.LEAVE_EARLY) {
          leaveEarlyDays++;
        }
        workDays++;
        
        // 근무 시간 계산
        LocalDateTime checkIn = attendance.getCheckIn();
        LocalDateTime checkOut = attendance.getCheckOut();
        
        LocalDateTime endDateTime;
        if (checkOut != null) {
          endDateTime = checkOut;
        } else if (currentDate.equals(today)) {
          // 오늘인데 아직 퇴근 안 찍은 경우
          endDateTime = LocalDateTime.now();
        } else {
          // 과거인데 퇴근 시간이 없으면 스킵
          continue;
        }
        
        long minutes = Duration.between(checkIn, endDateTime).toMinutes();
        if (minutes > 0) {
          totalMinutes += (int) minutes;
        }
      }
    }
    
    return new AttendanceStatisticsDTO(totalWorkDays, workDays, lateDays, leaveEarlyDays, absentDays, leaveDays, totalMinutes);
  }

  /** 전사원 오늘 근태 현황 조회 */
  @Override
  @Transactional(readOnly = true)
  public List<CompanyAttendanceResponseDTO> getCompanyAttendanceToday() {
    LocalDate today = LocalDate.now();
    
    // 오늘 날짜의 모든 근태 기록 조회
    List<Attendance> todayAttendances = attendanceRepository.findByWorkDate(today);
    
    // 활성 사용자 목록 조회
    List<User> activeUsers = userRepository.findAll().stream()
        .filter(user -> user.getStatus() == Status.ACTIVE)
        .toList();
    
    // 사용자별로 근태 정보 매핑
    return activeUsers.stream()
        .map(user -> {
          // 해당 사용자의 오늘 근태 기록 찾기
          Attendance attendance = todayAttendances.stream()
              .filter(att -> att.getUser().getId().equals(user.getId()))
              .findFirst()
              .orElse(null);
          
          if (attendance == null) {
            // 근태 기록이 없으면 미출근으로 처리
            return new CompanyAttendanceResponseDTO(
                user.getId(),
                user.getName(),
                user.getDepartment() != null ? user.getDepartment().getDeptName() : "",
                null,
                null,
                AttendanceStatus.ABSENT
            );
          } else {
            return new CompanyAttendanceResponseDTO(
                user.getId(),
                user.getName(),
                user.getDepartment() != null ? user.getDepartment().getDeptName() : "",
                attendance.getCheckIn(),
                attendance.getCheckOut(),
                attendance.getStatus()
            );
          }
        })
        .toList();
  }

  /** 주간 일별 근태 상세 조회 */
  @Override
  @Transactional(readOnly = true)
  public WeeklyAttendanceDetailDTO getWeeklyAttendanceDetail(String email, LocalDate anyDateInWeek) {
    User user = userRepository.findByEmail(email)
                              .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다: " + email));
    
    LocalDate startOfWeek = anyDateInWeek.with(DayOfWeek.MONDAY);
    LocalDate endOfWeek = startOfWeek.plusDays(6);
    
    List<Attendance> attendanceList = attendanceRepository.findByUser_IdAndWorkDateBetween(
        user.getId(), startOfWeek, endOfWeek);
    
    // 해당 기간 내 승인된 휴가 조회
    List<LeaveRequest> approvedLeaves = leaveRequestRepository.findByUserAndStatusAndDateRange(
        user, LeaveStatus.APPROVED, startOfWeek, endOfWeek);
    
    // 휴가 날짜 Set 생성 (시작일부터 종료일까지 모든 날짜 포함)
    Set<LocalDate> leaveDates = new HashSet<>();
    for (LeaveRequest leave : approvedLeaves) {
      LocalDate leaveStart = leave.getStartDate();
      LocalDate leaveEnd = leave.getEndDate();
      for (LocalDate date = leaveStart; !date.isAfter(leaveEnd); date = date.plusDays(1)) {
        leaveDates.add(date);
      }
    }
    
    LocalDate today = LocalDate.now();
    String[] dayNames = {"월", "화", "수", "목", "금", "토", "일"};
    List<DailyAttendanceDTO> dailyList = new ArrayList<>();
    
    for (LocalDate date = startOfWeek; !date.isAfter(endOfWeek); date = date.plusDays(1)) {
      final LocalDate currentDate = date;
      
      // 휴가 여부 확인
      boolean isLeave = leaveDates.contains(currentDate);
      
      Attendance attendance = attendanceList.stream()
          .filter(att -> att.getWorkDate() != null && att.getWorkDate().equals(currentDate))
          .findFirst()
          .orElse(null);
      
      String dayOfWeek = dayNames[date.getDayOfWeek().getValue() - 1];
      LocalDateTime checkIn = null;
      LocalDateTime checkOut = null;
      AttendanceStatus status = AttendanceStatus.ABSENT;
      int workMinutes = 0;
      
      if (attendance != null && attendance.getCheckIn() != null) {
        checkIn = attendance.getCheckIn();
        checkOut = attendance.getCheckOut();
        status = attendance.getStatus();
        
        if (checkIn != null) {
          LocalDateTime endDateTime;
          if (checkOut != null) {
            endDateTime = checkOut;
          } else if (currentDate.equals(today)) {
            endDateTime = LocalDateTime.now();
          } else {
            endDateTime = checkIn;
          }
          
          long minutes = Duration.between(checkIn, endDateTime).toMinutes();
          if (minutes > 0) {
            workMinutes = (int) minutes;
          }
        }
      }
      
      dailyList.add(new DailyAttendanceDTO(
          currentDate,
          dayOfWeek,
          checkIn,
          checkOut,
          status,
          workMinutes,
          isLeave
      ));
    }
    
    return new WeeklyAttendanceDetailDTO(dailyList);
  }

  /** 월간 일별 근태 상세 조회 */
  @Override
  @Transactional(readOnly = true)
  public MonthlyAttendanceDetailDTO getMonthlyAttendanceDetail(String email, LocalDate anyDateInMonth) {
    User user = userRepository.findByEmail(email)
                              .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다: " + email));
    
    LocalDate startOfMonth = anyDateInMonth.withDayOfMonth(1);
    LocalDate endOfMonth = anyDateInMonth.withDayOfMonth(anyDateInMonth.lengthOfMonth());
    
    List<Attendance> attendanceList = attendanceRepository.findByUser_IdAndWorkDateBetween(
        user.getId(), startOfMonth, endOfMonth);
    
    // 해당 기간 내 승인된 휴가 조회
    List<LeaveRequest> approvedLeaves = leaveRequestRepository.findByUserAndStatusAndDateRange(
        user, LeaveStatus.APPROVED, startOfMonth, endOfMonth);
    
    // 휴가 날짜 Set 생성 (시작일부터 종료일까지 모든 날짜 포함)
    Set<LocalDate> leaveDates = new HashSet<>();
    for (LeaveRequest leave : approvedLeaves) {
      LocalDate leaveStart = leave.getStartDate();
      LocalDate leaveEnd = leave.getEndDate();
      for (LocalDate date = leaveStart; !date.isAfter(leaveEnd); date = date.plusDays(1)) {
        leaveDates.add(date);
      }
    }
    
    LocalDate today = LocalDate.now();
    String[] dayNames = {"월", "화", "수", "목", "금", "토", "일"};
    
    List<DailyAttendanceDTO> dailyList = new ArrayList<>();
    
    for (LocalDate date = startOfMonth; !date.isAfter(endOfMonth); date = date.plusDays(1)) {
      final LocalDate currentDate = date;
      
      if (date.isAfter(today)) {
        continue;
      }
      
      // 휴가 여부 확인
      boolean isLeave = leaveDates.contains(currentDate);
      
      Attendance attendance = attendanceList.stream()
          .filter(att -> att.getWorkDate() != null && att.getWorkDate().equals(currentDate))
          .findFirst()
          .orElse(null);
      
      String dayOfWeek = dayNames[date.getDayOfWeek().getValue() - 1];
      LocalDateTime checkIn = null;
      LocalDateTime checkOut = null;
      AttendanceStatus status = AttendanceStatus.ABSENT;
      int workMinutes = 0;
      
      if (attendance != null && attendance.getCheckIn() != null) {
        checkIn = attendance.getCheckIn();
        checkOut = attendance.getCheckOut();
        status = attendance.getStatus();
        
        if (checkIn != null) {
          LocalDateTime endDateTime;
          if (checkOut != null) {
            endDateTime = checkOut;
          } else if (currentDate.equals(today)) {
            endDateTime = LocalDateTime.now();
          } else {
            endDateTime = checkIn;
          }
          
          long minutes = Duration.between(checkIn, endDateTime).toMinutes();
          if (minutes > 0) {
            workMinutes = (int) minutes;
          }
        }
      }
      
      dailyList.add(new DailyAttendanceDTO(
          currentDate,
          dayOfWeek,
          checkIn,
          checkOut,
          status,
          workMinutes,
          isLeave
      ));
    }
    
    return new MonthlyAttendanceDetailDTO(dailyList);
  }
}
