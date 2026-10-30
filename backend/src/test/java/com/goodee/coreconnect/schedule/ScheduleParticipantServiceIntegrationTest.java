package com.goodee.coreconnect.schedule;

import com.goodee.coreconnect.support.AbstractIntegrationTest;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import com.goodee.coreconnect.schedule.dto.request.RequestScheduleParticipantDTO;
import com.goodee.coreconnect.schedule.dto.response.ResponseScheduleParticipantDTO;
import com.goodee.coreconnect.schedule.entity.Schedule;
import com.goodee.coreconnect.schedule.enums.ScheduleRole;
import com.goodee.coreconnect.schedule.enums.ScheduleVisibility;
import com.goodee.coreconnect.schedule.repository.ScheduleParticipantRepository;
import com.goodee.coreconnect.schedule.repository.ScheduleRepository;
import com.goodee.coreconnect.schedule.service.ScheduleParticipantService;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Transactional
public class ScheduleParticipantServiceIntegrationTest extends AbstractIntegrationTest {

  @Autowired
  private ScheduleParticipantService participantService;

  @Autowired
  private ScheduleParticipantRepository participantRepository;

  @Autowired
  private ScheduleRepository scheduleRepository;

  @Autowired
  private UserRepository userRepository;

  private User testUser;
  private Schedule testSchedule;

  @BeforeEach
  void setUp() {
    testUser = userRepository.save(User.createUser("pw123", "참여자", Role.USER,
            "participant@test.com", "010-0000-0000", null, null, null));

    testSchedule = scheduleRepository.save(
            Schedule.createSchedule(testUser, null, null,
                    "참여자 테스트 일정", "내용입니다",
                    LocalDateTime.now().plusHours(1),
                    LocalDateTime.now().plusHours(2),
                    "회의실A", ScheduleVisibility.PUBLIC, null));
  }

  @Test
  @DisplayName("1️⃣ 참여자 추가 테스트 (이메일 기반)") 
  void testAddParticipant() {
    
    RequestScheduleParticipantDTO dto = RequestScheduleParticipantDTO.builder()
            .scheduleId(testSchedule.getId())
            .userId(testUser.getId())
            .role(ScheduleRole.MEMBER)
            .build();

    
    ResponseScheduleParticipantDTO response = participantService.addParticipant(dto, testUser.getEmail());

    assertThat(response).isNotNull();
    assertThat(response.getUserName()).isEqualTo(testUser.getName());
    log.info("참여자 추가 성공: " + response);
  }

  @Test
  @DisplayName("2️⃣ 일정별 참여자 목록 조회 테스트")
  void testGetParticipantsBySchedule() {
    participantRepository.save(com.goodee.coreconnect.schedule.entity.ScheduleParticipant.createParticipant(testSchedule, testUser, ScheduleRole.MEMBER));

    List<ResponseScheduleParticipantDTO> list = participantService.getParticipantsBySchedule(testSchedule.getId(), testSchedule.getUser().getEmail());

    assertThat(list).isNotEmpty();
    log.info("참여자 목록 조회 성공 (총 " + list.size() + "명)");
  }

  @Test
  @DisplayName("3️⃣ 유저별 참여 일정 목록 조회 테스트")
  void testGetSchedulesByUser() {
    participantRepository.save(com.goodee.coreconnect.schedule.entity.ScheduleParticipant.createParticipant(testSchedule, testUser, ScheduleRole.MEMBER));

    List<ResponseScheduleParticipantDTO> list = participantService.getSchedulesByUser(testUser.getId(), testUser.getEmail());

    assertThat(list).isNotEmpty();
    log.info("유저별 참여 일정 목록 조회 성공: " + list.size() + "건");
  }

  @Test
  @DisplayName("4️⃣ 참여자 삭제 테스트 (Soft Delete)")
  void testDeleteParticipant() {
    var saved = participantRepository.save(
            com.goodee.coreconnect.schedule.entity.ScheduleParticipant.createParticipant(testSchedule, testUser, ScheduleRole.MEMBER));

    participantService.deleteParticipant(saved.getId(), testUser.getEmail());

    var deleted = participantRepository.findById(saved.getId()).orElseThrow();
    assertThat(deleted.getDeletedYn()).isTrue();
    log.info("참여자 삭제 성공 (Soft Delete): ID=" + deleted.getId());
  }
}
