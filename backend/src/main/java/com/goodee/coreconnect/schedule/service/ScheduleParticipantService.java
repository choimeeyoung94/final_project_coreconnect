package com.goodee.coreconnect.schedule.service;

import java.util.List;

import com.goodee.coreconnect.schedule.dto.request.RequestScheduleParticipantDTO;
import com.goodee.coreconnect.schedule.dto.response.ResponseScheduleParticipantDTO;

public interface ScheduleParticipantService {
  
  ResponseScheduleParticipantDTO addParticipant(RequestScheduleParticipantDTO dto, String email);

  /** 일정 참여자 목록 - 비공개 일정은 작성자·참여자만 (아니면 SecurityException → 403) */
  List<ResponseScheduleParticipantDTO> getParticipantsBySchedule(Integer scheduleId, String viewerEmail);

  /** 유저의 참여 일정 목록 - 본인이 아니면 볼 수 있는 일정(PUBLIC·내가 작성/참여)만 */
  List<ResponseScheduleParticipantDTO> getSchedulesByUser(Integer userId, String viewerEmail);

  /** 일정 작성자 또는 참여자 본인만 삭제 가능 (아니면 SecurityException → 403) */
  void deleteParticipant(Integer id, String email);
  
}
