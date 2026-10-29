package com.goodee.coreconnect.schedule.controller;

import java.util.List;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.goodee.coreconnect.schedule.dto.request.RequestScheduleParticipantDTO;
import com.goodee.coreconnect.schedule.dto.response.ResponseScheduleParticipantDTO;
import com.goodee.coreconnect.schedule.service.ScheduleParticipantService;
import com.goodee.coreconnect.security.userdetails.CustomUserDetails;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@Tag(name = "ScheduleParticpant API", description = "일정참여자 관리 API")
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/scheduleParticipants")
@SecurityRequirement(name = "bearerAuth")
public class ScheduleParticipantController {

  private final ScheduleParticipantService participantService;

  /** 참여자 추가 */
  @Operation(summary = "참여자 추가", description = "참여자를 추가합니다.")
  @PostMapping
  public ResponseScheduleParticipantDTO add(@Valid @RequestBody RequestScheduleParticipantDTO dto, @AuthenticationPrincipal CustomUserDetails user) {
    String email = user.getEmail();
    return participantService.addParticipant(dto, email);
  }

  /** 일정별 참여자 목록 조회 */
  @Operation(summary = "참여자 목록 조회", description = "참여자 목록을 조회합니다.")
  @GetMapping(params = "scheduleId")
  public List<ResponseScheduleParticipantDTO> getBySchedule(@RequestParam("scheduleId") Integer scheduleId,
      @AuthenticationPrincipal CustomUserDetails user) {
    return participantService.getParticipantsBySchedule(scheduleId, user.getEmail());
  }

  /** 유저별 참여 일정 목록 조회 */
  @Operation(summary = "참여자 일정 조회", description = "참여자의 일정을 조회합니다.")
  @GetMapping(params = "userId")
  public List<ResponseScheduleParticipantDTO> getByUser(@RequestParam("userId") Integer userId,
      @AuthenticationPrincipal CustomUserDetails user) {
    return participantService.getSchedulesByUser(userId, user.getEmail());
  }

  /** 참여자 삭제 (Soft Delete) */
  @Operation(summary = "참여자", description = "일정에서 참여자를 삭제합니다.")
  @DeleteMapping("/{id}")
  public void delete(@PathVariable("id") Integer id, @AuthenticationPrincipal CustomUserDetails user) {
    participantService.deleteParticipant(id, user.getEmail());
  }
}

