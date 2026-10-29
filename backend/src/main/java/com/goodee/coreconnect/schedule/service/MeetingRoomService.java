package com.goodee.coreconnect.schedule.service;

import java.time.LocalDateTime;
import java.util.List;

import com.goodee.coreconnect.schedule.dto.MeetingRoomDTO;
import com.goodee.coreconnect.schedule.dto.response.ResponseScheduleDTO;

public interface MeetingRoomService {

  /** 회의실 생성 */
  MeetingRoomDTO createMeetingRoom(MeetingRoomDTO dto);

  /** 회의실 수정 */
  MeetingRoomDTO updateMeetingRoom(Integer id, MeetingRoomDTO dto);

  /** 회의실 삭제 (Soft Delete) */
  void deleteMeetingRoom(Integer id);

  /** 단일 회의실 조회 */
  MeetingRoomDTO getMeetingRoomById(Integer id);
  
  /** 관리자용 조건 기반 회의실 목록 조회 (deletedYn, availableYn 조건 포함) */
  List<MeetingRoomDTO> getFilteredRooms(Boolean deletedYn, Boolean availableYn);

  /** 전체 회의실 목록 조회 (기본값: deletedYn = false) */
  List<MeetingRoomDTO> getAllRooms();
  
  /** 특정 회의실의 예약 일정 조회 */
  List<ResponseScheduleDTO> getSchedulesByMeetingRoom(Integer meetingRoomId, String viewerEmail);
  
  /** 특정 시간대에 단일 회의실 예약 가능 여부 검사 */
  boolean isMeetingRoomAvailable(Integer meetingRoomId, LocalDateTime start, LocalDateTime end, Integer scheduleId);
  
  /** 특정 시간대 예약 가능한 회의실 조회 */
  List<MeetingRoomDTO> getAvailableRooms(LocalDateTime start, LocalDateTime end, Integer scheduleId);
  
}
