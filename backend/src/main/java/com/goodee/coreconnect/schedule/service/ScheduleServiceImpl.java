package com.goodee.coreconnect.schedule.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.goodee.coreconnect.common.notification.enums.NotificationType;
import com.goodee.coreconnect.common.notification.event.NotificationRequestedEvent;
import com.goodee.coreconnect.leave.entity.LeaveRequest;
import com.goodee.coreconnect.leave.repository.LeaveRequestRepository;
import com.goodee.coreconnect.schedule.dto.request.RequestScheduleDTO;
import com.goodee.coreconnect.schedule.dto.response.ResponseScheduleDTO;
import com.goodee.coreconnect.schedule.dto.response.ScheduleDailySummaryDTO;
import com.goodee.coreconnect.schedule.dto.response.ScheduleMonthlySummaryDTO;
import com.goodee.coreconnect.schedule.dto.response.SchedulePreviewSummaryDTO;
import com.goodee.coreconnect.schedule.entity.MeetingRoom;
import com.goodee.coreconnect.schedule.entity.Schedule;
import com.goodee.coreconnect.schedule.entity.ScheduleCategory;
import com.goodee.coreconnect.schedule.entity.ScheduleParticipant;
import com.goodee.coreconnect.schedule.enums.ScheduleRole;
import com.goodee.coreconnect.schedule.enums.ScheduleVisibility;
import com.goodee.coreconnect.schedule.repository.MeetingRoomRepository;
import com.goodee.coreconnect.schedule.repository.ScheduleCategoryRepository;
import com.goodee.coreconnect.schedule.repository.ScheduleParticipantRepository;
import com.goodee.coreconnect.schedule.repository.ScheduleRepository;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class ScheduleServiceImpl implements ScheduleService {

  private final ScheduleRepository scheduleRepository;
  private final UserRepository userRepository;
  private final MeetingRoomRepository meetingRoomRepository;
  private final ScheduleCategoryRepository categoryRepository;
  private final ScheduleParticipantRepository scheduleParticipantRepository;
  private final ApplicationEventPublisher eventPublisher;
  private final LeaveRequestRepository leaveRequestRepository;


  /** 일정 생성 */
  @Override
  public ResponseScheduleDTO createSchedule(RequestScheduleDTO dto, String email) {

    User user = userRepository.findByEmail(email)
        .orElseThrow(() -> new IllegalArgumentException("유저가 존재하지 않습니다."));

    MeetingRoom meetingRoom = (dto.getMeetingRoomId() != null)
        ? meetingRoomRepository.findById(dto.getMeetingRoomId()).orElse(null)
        : null;

    ScheduleCategory category = (dto.getCategoryId() != null)
        ? categoryRepository.findById(dto.getCategoryId()).orElse(null)
        : null;

    // LeaveRequest 조회 (휴가 일정인 경우만)
    LeaveRequest leaveRequest = null;
    if (dto.getLeaveRequestId() != null) {
        leaveRequest = leaveRequestRepository.findById(dto.getLeaveRequestId())
            .orElseThrow(() -> new IllegalArgumentException("휴가를 찾을 수 없습니다."));
    }

    // 회의실 중복 예약 방지 (휴가 일정은 제외)
    if (meetingRoom != null && leaveRequest == null) {
      boolean overlap = scheduleRepository.existsOverlappingSchedule(
              meetingRoom,
              dto.getStartDateTime(),
              dto.getEndDateTime(),
              null
      );

      if (overlap) {
        throw new IllegalArgumentException("해당 시간대에 이미 예약된 회의실입니다.");
      }
      
      // 회의실 예약 시 자동 비활성화 (예약 중 상태)
      meetingRoom.changeAvailability(false);
    }
    
    // OWNER(본인) 일정 겹침 여부 확인 (휴가 일정은 제외)
    if (leaveRequest == null) {
        boolean ownerHasConflict = scheduleRepository.existsUserOverlappingSchedule(
            user, dto.getStartDateTime(), dto.getEndDateTime());

        if (ownerHasConflict) {
          throw new IllegalArgumentException("본인은 해당 시간대에 이미 다른 일정이 있습니다.");
        }
    }
    
    // 시간 검증 
    if (dto.getStartDateTime().isAfter(dto.getEndDateTime()) || 
        dto.getStartDateTime().isEqual(dto.getEndDateTime())) {
        throw new IllegalArgumentException("종료 시간은 시작 시간보다 이후여야 합니다.");
    }

    // 일정 생성
    Schedule schedule = dto.toEntity(user, meetingRoom, category, leaveRequest);
    Schedule savedSchedule = scheduleRepository.save(schedule);
    
    // 일정 생성자(owner) 자동 등록
    ScheduleParticipant owner = ScheduleParticipant.createParticipant(
            savedSchedule,
            user,
            ScheduleRole.OWNER
    );
    scheduleParticipantRepository.save(owner);
    
    // 추가 참여자 목록 : MEMBER 등록 (휴가 일정은 참여자 없음)
    if (dto.getParticipantIds() != null && !dto.getParticipantIds().isEmpty() && leaveRequest == null) {
      for (Integer participantId : dto.getParticipantIds()) {          
        // 본인(OWNER)은 제외
        if (participantId.equals(user.getId())) continue;

        User participantUser = userRepository.findById(participantId)
                .orElseThrow(() -> new IllegalArgumentException("참여자 유저를 찾을 수 없습니다. ID=" + participantId));
        
        // 참여자 일정 중복 체크
        boolean hasConflict = scheduleRepository.existsUserOverlappingSchedule(
            participantUser, dto.getStartDateTime(), dto.getEndDateTime());

        if (hasConflict) {
          throw new IllegalArgumentException(
              "참여자 '" + participantUser.getName() + "'님은 해당 시간에 이미 다른 일정이 있습니다."
          );
        }

        ScheduleParticipant member = ScheduleParticipant.createParticipant(savedSchedule, participantUser, ScheduleRole.MEMBER);
        scheduleParticipantRepository.save(member);
        
        // 알림 발송 (참여자)
        eventPublisher.publishEvent(NotificationRequestedEvent.single(
                participantUser.getId(),
                NotificationType.SCHEDULE,
                "[일정 등록] '" + savedSchedule.getTitle() + "' 일정에 초대되었습니다.",
                null, null,
                user.getId(),
                user.getName(),
                savedSchedule.getId()
        ));
      }
    }
    
    // 본인(OWNER)에게도 알림 (휴가 일정은 제외)
    if (leaveRequest == null) {  
      eventPublisher.publishEvent(NotificationRequestedEvent.single(
              user.getId(),
              NotificationType.SCHEDULE,
              "[일정 등록 완료] '" + savedSchedule.getTitle() + "' 일정이 생성되었습니다.",
              null, null,
              user.getId(),
              user.getName(),
              savedSchedule.getId()
      ));
    }

    return ResponseScheduleDTO.toDTO(savedSchedule);
  }
  
  

  /** 일정 수정 (회의실 상태 자동 갱신 포함) */
  @Override
  public ResponseScheduleDTO updateSchedule(Integer id, RequestScheduleDTO dto, String email) {
    
    User user = userRepository.findByEmail(email)
        .orElseThrow(() -> new IllegalArgumentException("유저가 존재하지 않습니다."));

    Schedule schedule = scheduleRepository.findById(id)
        .orElseThrow(() -> new IllegalArgumentException("해당 일정이 존재하지 않습니다."));

    MeetingRoom newMeetingRoom = (dto.getMeetingRoomId() != null)
        ? meetingRoomRepository.findById(dto.getMeetingRoomId()).orElse(null)
        : null;

    ScheduleCategory category = (dto.getCategoryId() != null)
        ? categoryRepository.findById(dto.getCategoryId()).orElse(null)
        : null;

    // 수정 권한 확인 (OWNER 또는 MEMBER)
    // 작성자(OWNER)이거나 참여자 목록에 있으면 수정 가능
    boolean isScheduleOwner = schedule.getUser().getId().equals(user.getId());
    boolean isParticipant = scheduleParticipantRepository
        .findByScheduleAndDeletedYnFalse(schedule)
        .stream()
        .anyMatch(p -> p.getUser().getId().equals(user.getId()));

    if (!isScheduleOwner && !isParticipant) {
        throw new SecurityException("이 일정의 참여자가 아닙니다. 수정 권한이 없습니다.");
    }
    
    // 시간 검증을 먼저 수행해서 잘못된 요청은 바로 차단 (불필요한 DB 락 방지)
    if (dto.getStartDateTime().isAfter(dto.getEndDateTime()) || 
        dto.getStartDateTime().isEqual(dto.getEndDateTime())) {
        throw new IllegalArgumentException("종료 시간은 시작 시간보다 이후여야 합니다.");
    }
    
    // 기존 회의실 저장 (나중에 상태 변경을 위해)
    MeetingRoom oldMeetingRoom = schedule.getMeetingRoom();

    // 회의실 중복 예약 방지 로직에서 "상태 변경"은 나중에 하고,
    // 여기서는 SELECT를 통한 검증만 수행해서 Deadlock 위험을 줄임
    if (newMeetingRoom != null) {
      
      // 회의실 겹치는 일정이 있는지 확인
      boolean overlap = scheduleRepository.existsOverlappingSchedule(
              newMeetingRoom,
              dto.getStartDateTime(),
              dto.getEndDateTime(),
              schedule.getId()
      );

      if (overlap) {
        throw new IllegalArgumentException("해당 시간대에 이미 예약된 회의실입니다.");
      }
    }

    // 기존 참여자 전부 한 번만 조회해서 재사용 (SELECT 중복 제거)
    List<ScheduleParticipant> existingParticipants =
        scheduleParticipantRepository.findByScheduleAndDeletedYnFalse(schedule);

    // 모든 참여자 일정 중복 검사 (SELECT만 수행, schedule.update 이전에 실행)
    for (ScheduleParticipant p : existingParticipants) {
      User participantUser = p.getUser();

      boolean hasConflict = scheduleRepository.existsUserOverlappingScheduleExceptSelf(
          participantUser, schedule.getId(), dto.getStartDateTime(), dto.getEndDateTime()
      );

      if (hasConflict) {
        throw new IllegalArgumentException(
            "참여자 '" + participantUser.getName() + "'님은 해당 시간에 이미 다른 일정이 있습니다."
        );
      }
    }
    
    // 여기까지는 모두 "검증용 SELECT"만 수행.
    // 이제부터 실제 엔티티 변경(UPDATE/INSERT/DELETE)을 수행해서 Deadlock 가능성을 최소화.

    // 일정 정보 수정
    schedule.update(
        dto.getTitle(),
        dto.getContent(),
        dto.getLocation(),
        dto.getStartDateTime(),
        dto.getEndDateTime(),
        dto.getVisibility(),
        newMeetingRoom,
        category);
    
    // 회의실 사용 가능 상태 갱신 로직 정리
    // - 이전 회의실과 다르면 이전 회의실은 다시 사용 가능(true)
    // - 새로운 회의실이 있고, 이전과 다르면 새 회의실을 사용 불가(false)
    if (oldMeetingRoom != null && !oldMeetingRoom.equals(newMeetingRoom)) {
      oldMeetingRoom.changeAvailability(true);
    }
    if (newMeetingRoom != null && !newMeetingRoom.equals(oldMeetingRoom)) {
      newMeetingRoom.changeAvailability(false);
    }
    
    // 참여자 수정 로직에서 기존 조회 결과 재사용
    if (dto.getParticipantIds() != null && !dto.getParticipantIds().isEmpty()) {
      
      List<Integer> existingIds = existingParticipants.stream()
              .map(p -> p.getUser().getId())
              .toList();

      List<Integer> newIds = dto.getParticipantIds().stream()
              .filter(id2 -> !existingIds.contains(id2))
              .toList();

      // 기존엔 있었는데, 요청엔 없는 사람 → 삭제 처리
      existingParticipants.stream()
              .filter(p -> !dto.getParticipantIds().contains(p.getUser().getId()))
              .forEach(ScheduleParticipant::delete);

      // 새로 추가된 사람들 MEMBER로 등록
      for (Integer newId : newIds) {
        User newUser = userRepository.findById(newId)
                .orElseThrow(() -> new IllegalArgumentException("참여자 유저를 찾을 수 없습니다. ID=" + newId));

        // OWNER는 제외
        boolean isOwner = schedule.getUser().getId().equals(newId);
        if (!isOwner) {
          ScheduleParticipant newMember =
                  ScheduleParticipant.createParticipant(schedule, newUser, ScheduleRole.MEMBER);
          scheduleParticipantRepository.save(newMember);
          
          // 새로 추가된 참여자에게 알림
          eventPublisher.publishEvent(NotificationRequestedEvent.single(
                  newUser.getId(),
                  NotificationType.SCHEDULE,
                  "[일정 수정] '" + schedule.getTitle() + "' 일정에 새로 추가되었습니다.",
                  null, null,
                  schedule.getUser().getId(),
                  schedule.getUser().getName(),
                  schedule.getId()
          ));  
        }
      }
    }
    
    // 모든 참여자에게 수정 알림
    List<ScheduleParticipant> allParticipants = scheduleParticipantRepository.findByScheduleAndDeletedYnFalse(schedule);
    
    for (ScheduleParticipant p : allParticipants) {  
      eventPublisher.publishEvent(NotificationRequestedEvent.single(
              p.getUser().getId(),
              NotificationType.SCHEDULE,
              "[일정 수정] '" + schedule.getTitle() + "' 일정이 변경되었습니다.",
              null, null,
              schedule.getUser().getId(),
              schedule.getUser().getName(),
              schedule.getId()
      ));
    }
        
    return ResponseScheduleDTO.toDTO(schedule);
  }

  
  
  /** 일정 삭제 (Soft Delete + 회의실 해제 포함) */
  @Override
  public void deleteSchedule(Integer id) {

    Schedule schedule = scheduleRepository.findById(id)
        .orElseThrow(() -> new IllegalArgumentException("일정을 찾을 수 없습니다."));

    // 회의실 예약 해제 (삭제 시 다시 예약 가능 상태로 변경)
    if (schedule.getMeetingRoom() != null) {
      schedule.getMeetingRoom().changeAvailability(true);
    }

    // Soft Delete (참여자 포함)
    schedule.deleteWithParticipants();
  }
  
  /** 로그인한 사용자의 이메일 기준으로 자신 일정 조회 */
  @Override
  @Transactional(readOnly = true)
  public List<ResponseScheduleDTO> getSchedulesByEmail(String email) {
    
    User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new IllegalArgumentException("사용자 정보를 찾을 수 없습니다: " + email));

    boolean isAdmin = user.getRole() == Role.ADMIN;

    List<Schedule> schedules;

    if (isAdmin) {
        // 관리자: PUBLIC + PRIVATE 구분 없이 모든 일정 접근 가능
        schedules = scheduleRepository.findByDeletedYnFalse();
    } else {
        // 일반 사용자: 자신이 관련된 일정만
        schedules = scheduleRepository.findAccessibleSchedules(user)
          .stream()
          .filter(s -> {
            // 작성자가 참여자 목록에 포함되어 있는지 확인 (삭제되지 않은 참여자만)
            boolean isOwnerInParticipants = s.getParticipants().stream()
                .anyMatch(p -> p.getUser().getId().equals(s.getUser().getId()) && !p.getDeletedYn());
            
            // 현재 조회하는 사용자가 작성자인 경우:
            // 작성자가 참여자 목록에 없으면 제외 (작성자의 캘린더에서 사라짐)
            // 참석자는 여전히 자신의 캘린더에서 일정을 볼 수 있음
            if (s.getUser().equals(user) && !isOwnerInParticipants) {
                return false;
            }
            
            // PRIVATE → 본인 + 참가자만 (삭제되지 않은 참여자만)
            if (s.getVisibility() == ScheduleVisibility.PRIVATE) {
                return s.getUser().equals(user)
                    || s.getParticipants().stream()
                         .anyMatch(p -> p.getUser().equals(user) && !p.getDeletedYn());
            }

            // PUBLIC → 본인 + 참가자만 (다른 유저의 PUBLIC은 제외, 삭제되지 않은 참여자만)
            if (s.getVisibility() == ScheduleVisibility.PUBLIC) {
                return s.getUser().equals(user)
                    || s.getParticipants().stream()
                         .anyMatch(p -> p.getUser().equals(user) && !p.getDeletedYn());
            }

            return false;
          })
          .toList();
    }

    return schedules.stream()
            .map(ResponseScheduleDTO::toDTO)
            .toList();
   
  }
  
  

  /** 유저별 일정 조회 (readOnly),  */
  @Override
  @Transactional(readOnly = true)
  public List<ResponseScheduleDTO> getUserSchedules(Integer userId) {
    User user = userRepository.findById(userId)
        .orElseThrow(() -> new IllegalArgumentException("유저가 존재하지 않습니다."));
    
    List<Schedule> schedules = scheduleRepository.findAccessibleSchedules(user);

    return schedules.stream()
                     .map(ResponseScheduleDTO::toDTO)
                     .collect(Collectors.toList());
  }
  
  
  
  
  /** 로그인한 사용자의 '오늘 일정' 조회 */
  @Override
  @Transactional(readOnly = true)
  public List<ResponseScheduleDTO> getTodaySchedulesByEmail(String email) {
      // 이메일 기반으로 User 엔티티 조회
      User user = userRepository.findByEmail(email)
              .orElseThrow(() -> new IllegalArgumentException("사용자 정보를 찾을 수 없습니다: " + email));

      // 오늘 날짜의 시작/끝 시각 계산
      LocalDate today = LocalDate.now(); 
      LocalDateTime startOfDay = today.atStartOfDay();       // 00:00:00
      LocalDateTime endOfDay   = today.atTime(23, 59, 59);   // 23:59:59

      // 오늘 일정 조회
      List<Schedule> schedules = scheduleRepository
              .findByUserAndDeletedYnFalseAndStartDateTimeBetween(user, startOfDay, endOfDay);

      // DTO 변환
      return schedules.stream()
              .map(ResponseScheduleDTO::toDTO)
              .toList();
  }
  
  
  /** 여러 유저의 일정 현황 조회 (하루 단위) */
  @Override
  @Transactional(readOnly = true)
  public Map<Integer, List<ResponseScheduleDTO>> getUsersAvailability(
      List<Integer> userIds,
      LocalDate date,
      LocalDateTime start,
      LocalDateTime end,
      Integer scheduleId
  ) {
    LocalDateTime startTime = (start != null) ? start : date.atStartOfDay();
    LocalDateTime endTime = (end != null) ? end : date.atTime(23, 59, 59);

    Map<Integer, List<ResponseScheduleDTO>> result = new HashMap<>();
    for (Integer userId : userIds) {
        List<Schedule> schedules = scheduleRepository.findOverlappingSchedules(userId, startTime, endTime, scheduleId);
        result.put(userId, schedules.stream()
            .map(ResponseScheduleDTO::toDTO)
            .toList());
    }
    return result;
  }

  
  
  

  /** 단일 일정 조회 (readOnly) */
  @Override
  @Transactional(readOnly = true)
  public ResponseScheduleDTO getScheduleById(Integer id) {
    Schedule schedule = scheduleRepository.findById(id)
        .orElseThrow(() -> new IllegalArgumentException("해당 일정이 존재하지 않습니다."));
    return ResponseScheduleDTO.toDTO(schedule);
  }
  

  /** 회의실별 일정 조회 (readOnly) */
  @Override
  @Transactional(readOnly = true)
  public List<ResponseScheduleDTO> getSchedulesByMeetingRoom(Integer meetingRoomId) {
    MeetingRoom meetingRoom = meetingRoomRepository.findById(meetingRoomId)
        .orElseThrow(() -> new IllegalArgumentException("회의실을 찾을 수 없습니다."));

    return scheduleRepository.findByMeetingRoomAndDeletedYnFalse(meetingRoom)
        .stream()
        .map(ResponseScheduleDTO::toDTO)
        .collect(Collectors.toList());
  }

  /** 대시보드용 - 월별 일정 요약 조회 */
  @Override
  @Transactional(readOnly = true)
  public ScheduleMonthlySummaryDTO getMonthlySummary(String email, int year, int month) {
    userRepository.findByEmail(email)
        .orElseThrow(() -> new IllegalArgumentException("사용자 정보를 찾을 수 없습니다: " + email));

    YearMonth yearMonth = YearMonth.of(year, month);
    LocalDateTime rangeStart = yearMonth.atDay(1).atStartOfDay();
    LocalDateTime rangeEnd = yearMonth.plusMonths(1).atDay(1).atStartOfDay();

    List<Schedule> schedules = scheduleRepository.findAccessibleSchedulesInRange(email, rangeStart, rangeEnd);

    Map<LocalDate, List<Schedule>> grouped = schedules.stream()
        .collect(Collectors.groupingBy(schedule -> schedule.getStartDateTime().toLocalDate()));

    List<ScheduleDailySummaryDTO> days = grouped.entrySet().stream()
        .sorted(Map.Entry.comparingByKey())
        .map(entry -> {
          List<SchedulePreviewSummaryDTO> previews = entry.getValue().stream()
              .sorted(Comparator.comparing(Schedule::getStartDateTime))
              .map(schedule -> SchedulePreviewSummaryDTO.builder()
                  .id(schedule.getId())
                  .title(schedule.getTitle())
                  .startDateTime(schedule.getStartDateTime())
                  .endDateTime(schedule.getEndDateTime())
                  .location(schedule.getLocation())
                  .categoryName(schedule.getCategory() != null ? schedule.getCategory().getName() : null)
                  .visibility(schedule.getVisibility() != null ? schedule.getVisibility().name() : null)
                  .build())
              .limit(5)
              .toList();

          return ScheduleDailySummaryDTO.builder()
              .date(entry.getKey())
              .count(entry.getValue().size())
              .items(previews)
              .build();
        })
        .toList();

    return ScheduleMonthlySummaryDTO.builder()
        .year(yearMonth.getYear())
        .month(yearMonth.getMonthValue())
        .totalDays(yearMonth.lengthOfMonth())
        .days(days)
        .build();
  }
}
