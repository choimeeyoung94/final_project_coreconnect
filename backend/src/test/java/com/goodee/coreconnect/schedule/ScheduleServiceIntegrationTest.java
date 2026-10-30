package com.goodee.coreconnect.schedule;

import com.goodee.coreconnect.support.AbstractIntegrationTest;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import com.goodee.coreconnect.schedule.dto.request.RequestScheduleDTO;
import com.goodee.coreconnect.schedule.dto.response.ResponseScheduleDTO;
import com.goodee.coreconnect.schedule.entity.Schedule;
import com.goodee.coreconnect.schedule.enums.ScheduleVisibility;
import com.goodee.coreconnect.schedule.repository.ScheduleRepository;
import com.goodee.coreconnect.schedule.service.ScheduleService;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.repository.UserRepository;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Transactional
public class ScheduleServiceIntegrationTest extends AbstractIntegrationTest {

  @Autowired
  private ScheduleService scheduleService;

  @Autowired
  private ScheduleRepository scheduleRepository;

  @Autowired
  private UserRepository userRepository;

  private User testUser;

  @BeforeEach
  void setUp() {
    testUser = userRepository.findById(10)
            .orElseThrow(() -> new IllegalStateException("user_id=10 유저가 없습니다."));
  }

  @Test
  @DisplayName("1️⃣일정 생성 테스트 (회의실 없음, 이메일 기반)")
  void testCreateScheduleWithoutMeetingRoom() {
    RequestScheduleDTO dto = RequestScheduleDTO.builder()
            .title("회의실 없이 생성되는 테스트 일정")
            .content("AWS RDS 연결 및 서비스 로직 검증")
            .startDateTime(LocalDateTime.of(2025, 10, 29, 10, 0))
            .endDateTime(LocalDateTime.of(2025, 10, 29, 11, 0))
            .location("개발실")
            .visibility(ScheduleVisibility.PUBLIC)
            .build();

    ResponseScheduleDTO response = scheduleService.createSchedule(dto, testUser.getEmail());

    assertThat(response).isNotNull();
    assertThat(response.getTitle()).isEqualTo("회의실 없이 생성되는 테스트 일정");
    log.info("생성 성공: " + response);
  }

//  @Test
//  @DisplayName("2️⃣일정 단일 조회 테스트")
//  void testGetScheduleById() {
//    Schedule saved = scheduleRepository.save(
//            Schedule.createSchedule(testUser, null, null, null,
//                    "조회 테스트 일정", "내용입니다",
//                    LocalDateTime.now().plusHours(1),
//                    LocalDateTime.now().plusHours(2),
//                    "사무실", ScheduleVisibility.PRIVATE));

//    ResponseScheduleDTO response = scheduleService.getScheduleById(saved.getId());
//    assertThat(response).isNotNull();
//    assertThat(response.getTitle()).isEqualTo("조회 테스트 일정");
//    log.info("조회 성공: " + response);
//  }

//  @Test
//  @DisplayName("3️⃣일정 수정 테스트")
//  void testUpdateSchedule() {
//    Schedule saved = scheduleRepository.save(
//            Schedule.createSchedule(testUser, null, null, null,
//                    "수정 전 일정", "수정 전 내용",
//                    LocalDateTime.now().plusDays(1),
//                    LocalDateTime.now().plusDays(1).plusHours(1),
//                    "회의실1", ScheduleVisibility.PRIVATE));
//
//    RequestScheduleDTO updateDto = RequestScheduleDTO.builder()
//            .title("수정된 일정 제목")
//            .content("내용이 변경되었습니다.")
//            .location("사무실")
//            .startDateTime(LocalDateTime.now().plusDays(1).plusHours(2))
//            .endDateTime(LocalDateTime.now().plusDays(1).plusHours(3))
//            .visibility(ScheduleVisibility.PUBLIC)
//            .build();
//
//    ResponseScheduleDTO updated = scheduleService.updateSchedule(saved.getId(), updateDto);
//    assertThat(updated.getTitle()).isEqualTo("수정된 일정 제목");
//    log.info("수정 성공: " + updated);
//  }

//  @Test
//  @DisplayName("4️⃣일정 삭제 테스트 (Soft Delete)")
//  void testDeleteSchedule() {
//    Schedule saved = scheduleRepository.save(
//            Schedule.createSchedule(testUser, null, null, null,
//                    "삭제 테스트", "삭제 테스트 내용",
//                    LocalDateTime.now().plusHours(3),
//                    LocalDateTime.now().plusHours(4),
//                    "회의실2", ScheduleVisibility.PRIVATE));
//
//    scheduleService.deleteSchedule(saved.getId());
//    Schedule deleted = scheduleRepository.findById(saved.getId()).orElseThrow();
//    assertThat(deleted.getDeletedYn()).isTrue();
//    log.info("삭제 성공 (Soft Delete): ID=" + deleted.getId());
//  }

//  @Test
//  @DisplayName("5️⃣특정 유저의 일정 목록 조회 (이메일 기반)")
//  void testGetUserSchedules() {
//    scheduleRepository.save(Schedule.createSchedule(testUser, null, null, null,
//                    "유저 일정1", "내용1",
//                    LocalDateTime.now().plusDays(2),
//                    LocalDateTime.now().plusDays(2).plusHours(1),
//                    "사무실", ScheduleVisibility.PUBLIC));
//
//    List<ResponseScheduleDTO> list = scheduleService.getUserSchedules(testUser.getId());
//    assertThat(list).isNotEmpty();
//    log.info("유저 일정 조회 성공 (총 " + list.size() + "건)");
//  }

  @Test
  @DisplayName("6️⃣존재하지 않는 일정 조회 시 예외 발생")
  void testGetSchedule_NotFound() {
    assertThrows(IllegalArgumentException.class, () -> scheduleService.getScheduleById(99999));
    log.info("존재하지 않는 일정 예외 정상 발생");
  }
}
