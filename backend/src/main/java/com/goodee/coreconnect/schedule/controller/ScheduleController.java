package com.goodee.coreconnect.schedule.controller;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.goodee.coreconnect.schedule.dto.request.RequestScheduleDTO;
import com.goodee.coreconnect.schedule.dto.response.ResponseScheduleDTO;
import com.goodee.coreconnect.schedule.dto.response.ScheduleMonthlySummaryDTO;
import com.goodee.coreconnect.schedule.service.ScheduleService;
import com.goodee.coreconnect.security.userdetails.CustomUserDetails;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@Tag(name = "Schedule API", description = "일정 관리 API")
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/schedules")
@SecurityRequirement(name = "bearerAuth")
public class ScheduleController {

  private final ScheduleService scheduleService;

  /** 일정 생성 */
  @Operation(summary = "일정 등록", description = "새로운 일정을 등록합니다. (OWNER 및 MEMBER 중복 일정 자동 검사)")
  @PostMapping
  public ResponseEntity<ResponseScheduleDTO> create(
      @Valid @RequestBody RequestScheduleDTO dto,
      @AuthenticationPrincipal CustomUserDetails user
  ) {
    String email = user.getEmail();
    ResponseScheduleDTO response = scheduleService.createSchedule(dto, email);
    return ResponseEntity.status(HttpStatus.CREATED).body(response);
  }

  /** 일정 수정 */
  @Operation(summary = "일정 수정", description = "기존 일정을 수정합니다. (중복 일정 자동 검사)")
  @PutMapping("/{id}")
  public ResponseEntity<ResponseScheduleDTO> update(
      @PathVariable("id") Integer id,
      @Valid @RequestBody RequestScheduleDTO dto,
      @AuthenticationPrincipal CustomUserDetails user
  ) {
    String email = user.getEmail();
    ResponseScheduleDTO response = scheduleService.updateSchedule(id, dto, email);
    return ResponseEntity.ok(response);
  }

  /** 일정 삭제 (Soft Delete) */
  @Operation(summary = "일정 삭제", description = "기존의 일정을 삭제합니다.")
  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable("id") Integer id, @AuthenticationPrincipal CustomUserDetails user) {
    scheduleService.deleteSchedule(id, user.getEmail());
    return ResponseEntity.noContent().build();
  }
  
  /** 일정 단일 조회 */
  @Operation(summary = "일정 단일 조회", description = "일정 하나를 조회합니다.")
  @GetMapping(params = "id")
  public ResponseEntity<ResponseScheduleDTO> getById(@RequestParam("id") Integer id, @AuthenticationPrincipal CustomUserDetails user) {
    return ResponseEntity.ok(scheduleService.getScheduleById(id, user.getEmail()));
  }
  
  /**
   * 로그인한 사용자의 일정 조회 (내 일정 보기)
   * 프론트에서 userId를 보내지 않아도 JWT 토큰의 이메일을 통해 조회 가능
   */
  @Operation(summary = "내 일정 조회", description = "현재 로그인한 사용자의 일정을 조회합니다. (OWNER + MEMBER 포함)")
  @GetMapping("/me")
  @SecurityRequirement(name = "bearerAuth")
  public ResponseEntity<List<ResponseScheduleDTO>> getMySchedules(@AuthenticationPrincipal CustomUserDetails user) {
    String email = user.getEmail();
    return ResponseEntity.ok(scheduleService.getSchedulesByEmail(email));
  }

  /** 특정 유저의 일정 목록 조회 */
  @Operation(summary = "유저의 일정 조회", description = "특정 유저의 일정을 조회합니다. (OWNER + MEMBER 포함)")
  @GetMapping(params = "userId")
  public ResponseEntity<List<ResponseScheduleDTO>> getUserSchedules(@RequestParam("userId") Integer userId,
      @AuthenticationPrincipal CustomUserDetails user) {
    return ResponseEntity.ok(scheduleService.getUserSchedules(userId, user.getEmail()));
  }
  
  /** 로그인한 사용자의 '오늘 일정'만 조회 */
  @Operation(summary = "오늘 일정 조회", description = "로그인한 사용자의 오늘 일정을 조회합니다.")
  @GetMapping("/me/today")
  public List<ResponseScheduleDTO> getMyTodaySchedules(@AuthenticationPrincipal CustomUserDetails user) {
      String email = user.getEmail();
      return scheduleService.getTodaySchedulesByEmail(email);
  }

  
  /** 여러 유저의 일정 현황 조회 (하루 단위) */
  @Operation(summary = "참석자 일정 현황 조회", description = "선택된 참석자들의 하루 일정 목록을 조회합니다.")
  @GetMapping("/availability")
  public ResponseEntity<Map<Integer, List<ResponseScheduleDTO>>> getUsersAvailability(
      @RequestParam("userIds") List<Integer> userIds,
      @RequestParam(value = "date", required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate date,
      @RequestParam(value = "start", required = false) @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime start,
      @RequestParam(value = "end", required = false) @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime end,
      @RequestParam(value = "scheduleId", required = false) Integer scheduleId,
      @AuthenticationPrincipal CustomUserDetails user
  ) {
      // start/end가 없으면 하루 단위 기본 조회
      LocalDate baseDate = (date != null) ? date : LocalDate.now();
      Map<Integer, List<ResponseScheduleDTO>> result =
          scheduleService.getUsersAvailability(userIds, baseDate, start, end, scheduleId, user.getEmail());
      return ResponseEntity.ok(result);
  }

  /** 특정 회의실의 일정 목록 조회 */
  @Operation(summary = "회의실 일정 조회", description = "특정 회의실의 일정을 조회합니다.")
  @GetMapping(params = "meetingRoomId")
  public ResponseEntity<List<ResponseScheduleDTO>> getSchedulesByMeetingRoom(
      @RequestParam("meetingRoomId") Integer meetingRoomId,
      @AuthenticationPrincipal CustomUserDetails user
  ) {
    return ResponseEntity.ok(scheduleService.getSchedulesByMeetingRoom(meetingRoomId, user.getEmail()));
  }
  
  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<String> handleIllegalArgument(IllegalArgumentException ex) {
    return ResponseEntity.badRequest().body(ex.getMessage());
  }
  
  /** 대시보드용 - 월간 일정 요약 조회 */
  @Operation(summary = "월간 일정 요약", description = "월간 캘린더에 필요한 일정 개수 및 요약 정보를 제공합니다.")
  @GetMapping("/summary")
  public ResponseEntity<ScheduleMonthlySummaryDTO> getMonthlySummary(
      @AuthenticationPrincipal CustomUserDetails user,
      @RequestParam(name = "year", required = false) Integer year,
      @RequestParam(name = "month", required = false) Integer month
      ) {
    LocalDate today = LocalDate.now();
    int targetYear = (year != null) ? year : today.getYear();
    int targetMonth = (month != null) ? month : today.getMonthValue();
    
    ScheduleMonthlySummaryDTO summary = scheduleService.getMonthlySummary(user.getEmail(), targetYear, targetMonth);
    return ResponseEntity.ok(summary);
  }
}
