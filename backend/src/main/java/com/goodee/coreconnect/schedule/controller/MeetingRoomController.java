package com.goodee.coreconnect.schedule.controller;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.goodee.coreconnect.security.userdetails.CustomUserDetails;
import com.goodee.coreconnect.schedule.dto.MeetingRoomDTO;
import com.goodee.coreconnect.schedule.dto.response.ResponseScheduleDTO;
import com.goodee.coreconnect.schedule.service.MeetingRoomService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@Tag(name = "MeetingRoom API", description = "회의실 관리 API")
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/meetingRooms")
@SecurityRequirement(name = "bearerAuth")
public class MeetingRoomController {

  private final MeetingRoomService meetingRoomService;

  /** 회의실 생성 */
  @Operation(summary = "회의실 생성", description = "새로운 회의실을 생성합니다.")
  @PostMapping
  public MeetingRoomDTO create(@Valid @RequestBody MeetingRoomDTO dto) {
    return meetingRoomService.createMeetingRoom(dto);
  }

  /** 회의실 수정 */
  @Operation(summary = "회의실 수정", description = "기존 회의실을 수정합니다.")
  @PutMapping("/{id}")
  public MeetingRoomDTO update(@PathVariable("id") Integer id,
                               @Valid @RequestBody MeetingRoomDTO dto) {
    return meetingRoomService.updateMeetingRoom(id, dto);
  }

  /** 회의실 삭제 (Soft Delete) */
  @Operation(summary = "회의실 삭제", description = "기존 회의실을 삭제합니다.")
  @DeleteMapping("/{id}")
  public void delete(@PathVariable("id") Integer id) {
    meetingRoomService.deleteMeetingRoom(id);
  }
  
  /** 회의실 단일 조회 (id 파라미터 기반으로 통일) */
  @Operation(summary = "회의실 조회", description = "회의실의 정보를 조회합니다.")
  @GetMapping(params = "id") 
  public MeetingRoomDTO getById(@RequestParam("id") Integer id) { 
    return meetingRoomService.getMeetingRoomById(id);        
  }

  /** 관리자 조건 기반 회의실 목록 조회 */
  @Operation(summary = "회의실 조건 조회 (deletedYn, availableYn)")
  @GetMapping
  public List<MeetingRoomDTO> getRooms(
          @RequestParam(name = "deletedYn",required = false) Boolean deletedYn,
          @RequestParam(name = "availableYn",required = false) Boolean availableYn) {
    return meetingRoomService.getFilteredRooms(deletedYn, availableYn);
  }
  
  /** 특정 회의실의 예약 일정 목록 조회 */
  @Operation(summary = "회의실 예약 일정 조회", description = "특정 회의실에 예약된 일정을 조회합니다.")
  @GetMapping(params = "meetingRoomId")
  public List<ResponseScheduleDTO> getSchedulesByRoom(@RequestParam("meetingRoomId") Integer meetingRoomId,
      @AuthenticationPrincipal CustomUserDetails user) {
    return meetingRoomService.getSchedulesByMeetingRoom(meetingRoomId, user.getEmail());
  }
  
  /** 특정 시간대 해당 회의실 예약 가능 여부 조회  */
  @Operation(summary = "회의실 예약 가능 여부 확인", description = "특정 시간대에 해당 회의실이 예약 가능한지 확인합니다.")
  @GetMapping("/availability")
  public ResponseEntity<?> checkAvailability(
      @RequestParam("id") Integer meetingRoomId,
      @RequestParam("start") @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime start,
      @RequestParam("end") @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime end,
      @RequestParam(value = "scheduleId", required = false) Integer scheduleId) {
    
    boolean available = meetingRoomService.isMeetingRoomAvailable(meetingRoomId, start, end, scheduleId);

    return ResponseEntity.ok(Map.of(
            "meetingRoomId", meetingRoomId,
            "start", start,
            "end", end,
            "available", available
    ));
  }
  
  /** 특정 시간대 예약 가능한 회의실 조회 */
  @Operation(summary = "예약 가능한 회의실 전체 조회", description = "특정 시간대에 예약 가능한 모든 회의실을 조회합니다.")
  @GetMapping("/available")
  public ResponseEntity<?> getAvailableRooms(      
      @RequestParam("start") @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime start,
      @RequestParam("end") @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime end,
      @RequestParam(value = "scheduleId", required = false) Integer scheduleId) {

    List<MeetingRoomDTO> availableRooms = meetingRoomService.getAvailableRooms(start, end, scheduleId);

    return ResponseEntity.ok(Map.of(
            "start", start,
            "end", end,
            "availableRooms", availableRooms
    ));
  }
  
}

