package com.goodee.coreconnect.schedule.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import com.goodee.coreconnect.schedule.dto.request.RequestScheduleDTO;
import com.goodee.coreconnect.schedule.dto.response.ResponseScheduleDTO;
import com.goodee.coreconnect.schedule.dto.response.ScheduleMonthlySummaryDTO;

public interface ScheduleService {

  ResponseScheduleDTO createSchedule(RequestScheduleDTO dto, String email);

  ResponseScheduleDTO updateSchedule(Integer id, RequestScheduleDTO dto, String email);

  /** 시스템 내부용 삭제 (예: 휴가 취소 시 연결된 일정 삭제) - 권한 확인 없음 */
  void deleteSchedule(Integer id);

  /** 사용자 요청 삭제 - 작성자 본인 또는 ADMIN만 가능 (아니면 SecurityException → 403) */
  void deleteSchedule(Integer id, String email);

  ResponseScheduleDTO getScheduleById(Integer id);

  /** 사용자 요청 단건 조회 - 작성자·참여자, 또는 PUBLIC 일정만 (아니면 SecurityException → 403) */
  ResponseScheduleDTO getScheduleById(Integer id, String email);

  /** 특정 유저의 일정 목록 - 보는 사람이 본인이 아니면 PUBLIC·내가 작성/참여한 일정만 */
  List<ResponseScheduleDTO> getUserSchedules(Integer userId, String viewerEmail);
  
  /** 대시보드용 - 월간 일정 요약 */
  ScheduleMonthlySummaryDTO getMonthlySummary(String email, int year, int month);
  
  /** 로그인한 사용자의 이메일 기준으로 일정 조회 */
  List<ResponseScheduleDTO> getSchedulesByEmail(String email);
  
  /** 특정 유저의 일정 목록 조회 (삭제되지 않은 일정만 반환) */
  List<ResponseScheduleDTO> getUserSchedules(Integer userId);
  
  /** 로그인한 사용자의 '오늘 일정' 조회 */
  List<ResponseScheduleDTO> getTodaySchedulesByEmail(String email);

  /** 여러 유저의 일정 현황 조회 (하루 단위) */
  Map<Integer, List<ResponseScheduleDTO>> getUsersAvailability(
      List<Integer> userIds,
      LocalDate date,
      LocalDateTime start,
      LocalDateTime end,
      Integer scheduleId,
      String viewerEmail);
  
  /** 특정 회의실의 일정 목록 조회 (삭제되지 않은 일정만 반환) */
  List<ResponseScheduleDTO> getSchedulesByMeetingRoom(Integer meetingRoomId, String viewerEmail);
  
  
}
