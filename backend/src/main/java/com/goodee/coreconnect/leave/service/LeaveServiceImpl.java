package com.goodee.coreconnect.leave.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.goodee.coreconnect.approval.entity.Document;
import com.goodee.coreconnect.leave.dto.response.CompanyLeaveDetailDTO;
import com.goodee.coreconnect.leave.dto.response.CompanyLeaveWeeklyDTO;
import com.goodee.coreconnect.leave.dto.response.LeaveRequestResponseDTO;
import com.goodee.coreconnect.leave.dto.response.LeaveSummaryDTO;
import com.goodee.coreconnect.leave.entity.LeaveRequest;
import com.goodee.coreconnect.leave.enums.LeaveStatus;
import com.goodee.coreconnect.leave.enums.LeaveType;
import com.goodee.coreconnect.leave.repository.LeaveRequestRepository;
import com.goodee.coreconnect.schedule.dto.request.RequestScheduleDTO;
import com.goodee.coreconnect.schedule.entity.ScheduleCategory;
import com.goodee.coreconnect.schedule.enums.ScheduleVisibility;
import com.goodee.coreconnect.schedule.repository.ScheduleCategoryRepository;
import com.goodee.coreconnect.schedule.repository.ScheduleRepository;
import com.goodee.coreconnect.schedule.service.ScheduleService;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.JobGrade;
import com.goodee.coreconnect.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class LeaveServiceImpl implements LeaveService {
  
  private final UserRepository userRepository;
  private final LeaveRequestRepository leaveRequestRepository;
  private final ScheduleService scheduleService;
  private final ScheduleCategoryRepository categoryRepository;
  private final ScheduleRepository scheduleRepository;
  
  private static final Integer DEFAULT_ANNUAL_LEAVE_DAYS = 15;

  /** 내 휴가 신청 목록 조회 */
  @Override
  @Transactional(readOnly = true)
  public List<LeaveRequestResponseDTO> getMyLeaveRequests(String email) {
    return leaveRequestRepository.findByUser_EmailOrderByCreatedAtDesc(email)
                                 .stream()
                                 .map(LeaveRequestResponseDTO::toDTO)
                                 .toList();
  }

  /** 전자결재 연동 휴가 생성 */
  @Override
  public void createLeaveFromApproval(Document document, User drafter, LocalDate startDate, LocalDate endDate, String typeLabel, String reason) {
    LeaveType leaveType = LeaveType.valueOf(typeLabel);
    LeaveRequest leave = LeaveRequest.createLeaveRequest(drafter, 
                                                         startDate, 
                                                         endDate, 
                                                         leaveType, 
                                                         reason, 
                                                         document.getId());
    LeaveRequest savedLeave = leaveRequestRepository.save(leave);
    
    // "개인 일정" 카테고리 찾기
    List<ScheduleCategory> categories = categoryRepository.findAvailableCategories(drafter);
    ScheduleCategory personalCategory = categories.stream()
        .filter(c -> "개인 일정".equals(c.getName()) && c.getDefaultYn())
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("'개인 일정' 카테고리를 찾을 수 없습니다."));
    
    // 일정 생성 (신청 시점, leaveRequest 포함)
    createScheduleFromLeave(savedLeave, personalCategory);
  }

  /** 승인된 휴가 처리 */
  @Override
  public void handleApprovedLeave(Document document, String approvalComment) {
    LeaveRequest leave = leaveRequestRepository.findByDocumentId(document.getId())
        .orElseThrow(() -> new IllegalArgumentException("휴가를 찾을 수 없습니다."));
    
    leave.approve(approvalComment);
    
    // 일정은 이미 생성되어 있으므로 그대로 유지
  }

  /** 반려된 휴가 처리 */
  @Override
  public void handleRejectedLeave(Document document, String rejectComment) {
    LeaveRequest leave = leaveRequestRepository.findByDocumentId(document.getId())
        .orElseThrow(() -> new IllegalArgumentException("휴가를 찾을 수 없습니다."));
    
    leave.reject(rejectComment);
    
    // 생성된 일정 삭제
    deleteScheduleFromLeave(leave);
  }

  /** 내 연차정보 요약 */
  @Override
  @Transactional(readOnly = true)
  public LeaveSummaryDTO getMyLeaveSummary(String email) {
    
    User user = userRepository.findByEmail(email)
                              .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
    Integer currentYear = LocalDate.now().getYear();
    
    // 1. 올해 승인된 연차만 조회
    List<LeaveRequest> approvedAnnualLeaves = leaveRequestRepository.findByUserAndStatusAndTypeAndYear(
        user, 
        LeaveStatus.APPROVED, 
        LeaveType.ANNUAL, 
        currentYear);
    // 2. 사용 연차 일수 계산
    Integer usedDays = approvedAnnualLeaves.stream()
                                           .mapToInt(this::calculateLeaveDays)
                                           .sum();
    Integer total = DEFAULT_ANNUAL_LEAVE_DAYS;
    Integer remaing = Math.max(total - usedDays, 0);
    Double usedRate = total == 0 ? 0.0 : (usedDays * 100 / total);
    
    return new LeaveSummaryDTO(total,
                               usedDays,
                               remaing,
                               usedRate);
  }
  
  /** 휴가 일수 계산 */
  private Integer calculateLeaveDays(LeaveRequest leave) {
    long days = ChronoUnit.DAYS.between(leave.getStartDate(), leave.getEndDate()) + 1;
    return (int) days;
  }
  
  /** 주 단위 휴가자 수 조회 */
  @Override
  @Transactional(readOnly = true)
  public List<CompanyLeaveWeeklyDTO> getCompanyLeaveWeekly(LocalDate startDate, LocalDate endDate) {
    List<Object[]> results = leaveRequestRepository.findLeavesByDateRange(startDate, endDate);
    
    // 날짜별 휴가자 수를 계산하기 위한 Map (날짜 -> 사용자 ID Set)
    Map<LocalDate, Set<Integer>> leaveUserMap = new HashMap<>();
    
    // 각 휴가에 대해 기간 내 모든 날짜에 사용자 추가
    for (Object[] row : results) {
      LocalDate leaveStart = (LocalDate) row[0];
      LocalDate leaveEnd = (LocalDate) row[1];
      Integer userId = (Integer) row[2];
      
      // 휴가 기간 내 모든 날짜에 대해 사용자 추가
      LocalDate current = leaveStart.isBefore(startDate) ? startDate : leaveStart;
      LocalDate last = leaveEnd.isAfter(endDate) ? endDate : leaveEnd;
      
      while (!current.isAfter(last)) {
        leaveUserMap.computeIfAbsent(current, k -> new HashSet<>()).add(userId);
        current = current.plusDays(1);
      }
    }
    
    // 주 단위 모든 날짜에 대해 휴가자 수 반환 (없으면 0)
    List<CompanyLeaveWeeklyDTO> weeklyData = new ArrayList<>();
    LocalDate currentDate = startDate;
    while (!currentDate.isAfter(endDate)) {
      int count = leaveUserMap.getOrDefault(currentDate, new HashSet<>()).size();
      weeklyData.add(new CompanyLeaveWeeklyDTO(currentDate, count));
      currentDate = currentDate.plusDays(1);
    }
    
    return weeklyData;
  }
  
  /** 전사 휴가 상세 목록 조회 */
  @Override
  @Transactional(readOnly = true)
  public Page<CompanyLeaveDetailDTO> getCompanyLeaveDetails(
      LocalDate startDate, 
      LocalDate endDate, 
      String leaveType, 
      Pageable pageable
  ) {
    Page<LeaveRequest> leavePage = leaveRequestRepository.findCompanyLeaves(
        startDate, 
        endDate, 
        leaveType, 
        LeaveType.ANNUAL,
        pageable
    );
    
    return leavePage.map(leave -> {
      User user = leave.getUser();
      
      // 휴가 기간 내 모든 날짜 생성
      List<LocalDate> leaveDates = new ArrayList<>();
      LocalDate current = leave.getStartDate();
      while (!current.isAfter(leave.getEndDate())) {
        leaveDates.add(current);
        current = current.plusDays(1);
      }
      
      // 사용 일수 계산
      Integer usedDays = calculateLeaveDays(leave);
      
      return new CompanyLeaveDetailDTO(
          leave.getLeaveReqId(),
          user.getId(),
          null, // TODO: 사번 필드 추가 시 수정
          user.getName(),
          user.getDepartment() != null ? user.getDepartment().getDeptName() : null,
          user.getJobGrade() != null ? user.getJobGrade().name() : null,
          leave.getType(),
          leaveDates,
          usedDays,
          usedDays
      );
    });
  }
  
  /** 휴가로부터 일정 생성 */
  private void createScheduleFromLeave(LeaveRequest leave, ScheduleCategory category) {
    LocalDateTime startDateTime = calculateStartDateTime(leave);
    LocalDateTime endDateTime = calculateEndDateTime(leave);
    
    RequestScheduleDTO dto = RequestScheduleDTO.builder()
        .title(leave.getType().getDescription())
        .content(leave.getReason())
        .categoryId(category.getId())
        .visibility(ScheduleVisibility.PUBLIC)
        .startDateTime(startDateTime)
        .endDateTime(endDateTime)
        .leaveRequestId(leave.getLeaveReqId())
        .build();
    
    scheduleService.createSchedule(dto, leave.getUser().getEmail());
  }
  
  /** 휴가 시작 시간 계산 */
  private LocalDateTime calculateStartDateTime(LeaveRequest leave) {
    if (leave.getType() == LeaveType.HALF_DAY_MORNING) {
        return leave.getStartDate().atTime(9, 0);
    } else if (leave.getType() == LeaveType.HALF_DAY_AFTERNOON) {
        return leave.getStartDate().atTime(13, 0);
    } else {
        return leave.getStartDate().atTime(0, 0);
    }
  }
  
  /** 휴가 종료 시간 계산 */
  private LocalDateTime calculateEndDateTime(LeaveRequest leave) {
    if (leave.getType() == LeaveType.HALF_DAY_MORNING) {
        return leave.getStartDate().atTime(12, 0);
    } else if (leave.getType() == LeaveType.HALF_DAY_AFTERNOON) {
        return leave.getStartDate().atTime(18, 0);
    } else {
        return leave.getEndDate().atTime(23, 59, 59);
    }
  }
  
  /** 휴가로부터 생성된 일정 삭제 */
  private void deleteScheduleFromLeave(LeaveRequest leave) {
    scheduleRepository.findByLeaveRequest(leave)
        .ifPresent(schedule -> {
            scheduleService.deleteSchedule(schedule.getId());
        });
  }
}
