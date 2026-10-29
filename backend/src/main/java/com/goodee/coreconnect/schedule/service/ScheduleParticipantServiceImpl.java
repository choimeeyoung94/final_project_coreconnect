package com.goodee.coreconnect.schedule.service;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.goodee.coreconnect.schedule.dto.request.RequestScheduleParticipantDTO;
import com.goodee.coreconnect.schedule.dto.response.ResponseScheduleParticipantDTO;
import com.goodee.coreconnect.schedule.entity.Schedule;
import com.goodee.coreconnect.schedule.entity.ScheduleParticipant;
import com.goodee.coreconnect.schedule.enums.ScheduleVisibility;
import com.goodee.coreconnect.schedule.repository.ScheduleParticipantRepository;
import com.goodee.coreconnect.schedule.repository.ScheduleRepository;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class ScheduleParticipantServiceImpl implements ScheduleParticipantService {

  private final ScheduleParticipantRepository participantRepository;
  private final ScheduleRepository scheduleRepository;
  private final UserRepository userRepository;

  /** 참여자 추가 */
  @Override
  public ResponseScheduleParticipantDTO addParticipant(RequestScheduleParticipantDTO dto, String email) {

    // 요청자 (로그인 유저)
    User requester = userRepository.findByEmail(email)
        .orElseThrow(() -> new IllegalArgumentException("요청자(로그인 유저)를 찾을 수 없습니다."));
  
    // 실제 추가할 유저 (DTO의 userId)
    User targetUser = userRepository.findById(dto.getUserId())
        .orElseThrow(() -> new IllegalArgumentException("추가할 유저를 찾을 수 없습니다."));
  
    // 일정 조회
    Schedule schedule = scheduleRepository.findById(dto.getScheduleId())
        .orElseThrow(() -> new IllegalArgumentException("일정을 찾을 수 없습니다."));
  
    // (선택사항) 권한 검사: 요청자가 일정의 OWNER인지 확인
    // boolean isOwner = participantRepository.existsByScheduleAndUserAndRole(schedule, requester, ScheduleRole.OWNER);
    // if (!isOwner) throw new SecurityException("다른 참여자를 추가할 권한이 없습니다.");
  
    // 중복 체크
    boolean alreadyExists = participantRepository.findByScheduleAndDeletedYnFalse(schedule)
        .stream()
        .anyMatch(p -> p.getUser().equals(targetUser));
    if (alreadyExists) {
      throw new IllegalStateException("이미 해당 일정에 등록된 사용자입니다.");
    }
  
    ScheduleParticipant participant = dto.toEntity(schedule, targetUser);
  
    ScheduleParticipant saved = participantRepository.save(participant);
  
    return ResponseScheduleParticipantDTO.toDTO(saved);
  }

  /** 일정별 참여자 목록 (삭제 제외) */
  @Override
  @Transactional(readOnly = true)
  public List<ResponseScheduleParticipantDTO> getParticipantsBySchedule(Integer scheduleId, String viewerEmail) {
    Schedule schedule = scheduleRepository.findById(scheduleId)
            .orElseThrow(() -> new IllegalArgumentException("일정을 찾을 수 없습니다."));

    List<ScheduleParticipant> participants = participantRepository.findByScheduleAndDeletedYnFalse(schedule);
    if (!canView(schedule, participants, viewerEmail)) {
      throw new SecurityException("비공개 일정의 참여자는 작성자와 참여자만 볼 수 있습니다.");
    }
    return participants
                                 .stream()
                                 .map(ResponseScheduleParticipantDTO::toDTO)
                                 .collect(Collectors.toList());
  }

  /** 유저별 참여 일정 목록 (삭제 제외) */
  @Override
  @Transactional(readOnly = true)
  public List<ResponseScheduleParticipantDTO> getSchedulesByUser(Integer userId, String viewerEmail) {
    User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("유저를 찾을 수 없습니다."));
    boolean self = user.getEmail().equals(viewerEmail);

    return participantRepository.findByUserAndDeletedYnFalse(user)
                                 .stream()
                                 .filter(p -> self || canView(p.getSchedule(),
                                     participantRepository.findByScheduleAndDeletedYnFalse(p.getSchedule()), viewerEmail))
                                 .map(ResponseScheduleParticipantDTO::toDTO)
                                 .collect(Collectors.toList());
  }

  /** PUBLIC이거나, 보는 사람이 작성자·참여자인 일정인지 (ScheduleServiceImpl.canView와 같은 규칙) */
  private boolean canView(Schedule schedule, List<ScheduleParticipant> participants, String viewerEmail) {
    return schedule.getVisibility() == ScheduleVisibility.PUBLIC
        || schedule.getUser().getEmail().equals(viewerEmail)
        || participants.stream().anyMatch(p -> p.getUser().getEmail().equals(viewerEmail));
  }

  /** Soft Delete 적용 */
  @Override
  public void deleteParticipant(Integer id, String email) {
    ScheduleParticipant participant = participantRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("참여자를 찾을 수 없습니다."));

    boolean isScheduleOwner = participant.getSchedule().getUser().getEmail().equals(email);
    boolean isSelf = participant.getUser().getEmail().equals(email);
    if (!isScheduleOwner && !isSelf) {
      throw new SecurityException("일정 작성자 또는 참여자 본인만 삭제할 수 있습니다.");
    }

    participant.delete(); 
  }
}