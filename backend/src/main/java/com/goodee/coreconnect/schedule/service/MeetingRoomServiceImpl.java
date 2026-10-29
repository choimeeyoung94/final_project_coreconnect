package com.goodee.coreconnect.schedule.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.goodee.coreconnect.schedule.dto.MeetingRoomDTO;
import com.goodee.coreconnect.schedule.dto.response.ResponseScheduleDTO;
import com.goodee.coreconnect.schedule.entity.MeetingRoom;
import com.goodee.coreconnect.schedule.entity.Schedule;
import com.goodee.coreconnect.schedule.repository.MeetingRoomRepository;
import com.goodee.coreconnect.schedule.repository.ScheduleRepository;

import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class MeetingRoomServiceImpl implements MeetingRoomService {

  private final MeetingRoomRepository meetingRoomRepository;
  private final ScheduleRepository scheduleRepository;
  private final UserRepository userRepository;

  /** 회의실 생성 */
  @Override
  public MeetingRoomDTO createMeetingRoom(MeetingRoomDTO dto) {
    MeetingRoom room = dto.toEntity();
    MeetingRoom saved = meetingRoomRepository.save(room);
    return MeetingRoomDTO.toDTO(saved);
  }

  /** 회의실 수정 (엔티티의 update() 메서드 사용) */
  @Override
  public MeetingRoomDTO updateMeetingRoom(Integer id, MeetingRoomDTO dto) {
    MeetingRoom room = meetingRoomRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("해당 회의실이 존재하지 않습니다."));

    room.update(dto.getName(),
                dto.getLocation(),
                dto.getCapacity(),
                dto.getAvailableYn());
    return MeetingRoomDTO.toDTO(room);
  }

  /** 회의실 삭제 (Soft Delete) */
  @Override
  public void deleteMeetingRoom(Integer id) {
    MeetingRoom room = meetingRoomRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("해당 회의실이 존재하지 않습니다."));

    room.delete(); // deletedYn = true, availableYn = false
  }
  
  /** 단일 회의실 조회 */
  @Override
  @Transactional(readOnly = true)
  public MeetingRoomDTO getMeetingRoomById(Integer id) {
    MeetingRoom room = meetingRoomRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("회의실을 찾을 수 없습니다."));
    return MeetingRoomDTO.toDTO(room);
  }

  /** 관리자용 조건 기반 조회 추가 */
  @Override
  @Transactional(readOnly = true)
  public List<MeetingRoomDTO> getFilteredRooms(Boolean deletedYn, Boolean availableYn) {
    List<MeetingRoom> rooms;

    if (deletedYn != null && availableYn != null) {
      rooms = meetingRoomRepository.findByDeletedYnAndAvailableYn(deletedYn, availableYn);
    } else if (deletedYn != null) {
      rooms = meetingRoomRepository.findByDeletedYn(deletedYn);
    } else if (availableYn != null) {
      rooms = meetingRoomRepository.findByAvailableYn(availableYn);
    } else {
      rooms = meetingRoomRepository.findAll();
    }

    return rooms.stream().map(MeetingRoomDTO::toDTO).collect(Collectors.toList());
  }

  /** 기본 전체 목록 조회 (삭제 제외) */
  @Override
  @Transactional(readOnly = true)
  public List<MeetingRoomDTO> getAllRooms() {
    return meetingRoomRepository.findByDeletedYn(false)
            .stream()
            .map(MeetingRoomDTO::toDTO)
            .collect(Collectors.toList());
  }
  
  /** 특정 회의실의 예약된 일정 조회 */
  @Override
  @Transactional(readOnly = true)
  public List<ResponseScheduleDTO> getSchedulesByMeetingRoom(Integer meetingRoomId, String viewerEmail) {
    MeetingRoom room = meetingRoomRepository.findById(meetingRoomId)
        .orElseThrow(() -> new IllegalArgumentException("회의실을 찾을 수 없습니다."));
    Integer viewerId = userRepository.findByEmail(viewerEmail).map(User::getId).orElse(null);

    List<Schedule> schedules = scheduleRepository.findByMeetingRoomAndDeletedYnFalse(room);

    return schedules.stream()
        .map(s -> ResponseScheduleDTO.toDTOFor(s, viewerId)) // 남의 비공개 일정은 "비공개 약속" + 시간만
        .collect(Collectors.toList());
  }
  
  /** 특정 시간대에 해당 회의실이 예약 가능한지 검사 */
  @Override
  @Transactional(readOnly = true)
  public boolean isMeetingRoomAvailable(Integer meetingRoomId, LocalDateTime start, LocalDateTime end, Integer scheduleId) {
    MeetingRoom meetingRoom = meetingRoomRepository.findById(meetingRoomId)
            .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 회의실입니다."));

    // ScheduleRepository에서 겹치는 일정이 있는지 확인
    boolean overlap = scheduleRepository.existsOverlappingSchedule(meetingRoom, start, end, scheduleId);

    // false → 예약 가능 / true → 예약 불가능
    return !overlap;
  }
  
  @Override
  @Transactional(readOnly = true)
  public List<MeetingRoomDTO> getAvailableRooms(LocalDateTime start, LocalDateTime end, Integer scheduleId) {
    // 전체 회의실 중 deletedYn = false인 것만 조회
    List<MeetingRoom> allRooms = meetingRoomRepository.findByDeletedYn(false);

    // 각 회의실마다 겹치는 일정이 있는지 검사
    return allRooms.stream()
            .filter(room -> {
                boolean overlap = scheduleRepository.existsOverlappingSchedule(room, start, end, scheduleId);
                return !overlap; // 겹침이 없으면 예약 가능
            })
            .map(MeetingRoomDTO::toDTO)
            .toList();
  }
  
  
}
