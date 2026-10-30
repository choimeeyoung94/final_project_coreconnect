package com.goodee.coreconnect.schedule;

import com.goodee.coreconnect.support.AbstractIntegrationTest;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import com.goodee.coreconnect.schedule.dto.MeetingRoomDTO;
import com.goodee.coreconnect.schedule.entity.MeetingRoom;
import com.goodee.coreconnect.schedule.repository.MeetingRoomRepository;
import com.goodee.coreconnect.schedule.service.MeetingRoomService;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Transactional
public class MeetingRoomServiceIntegrationTest extends AbstractIntegrationTest {

  @Autowired
  private MeetingRoomService meetingRoomService;

  @Autowired
  private MeetingRoomRepository meetingRoomRepository;

  @Test
  @DisplayName("1️⃣회의실 생성 테스트")
  void testCreateMeetingRoom() {
    MeetingRoomDTO dto = MeetingRoomDTO.builder()
            .name("회의실 A")
            .location("본관 1층")
            .capacity(8)
            .build();

    MeetingRoomDTO response = meetingRoomService.createMeetingRoom(dto);

    assertThat(response).isNotNull();
    assertThat(response.getName()).isEqualTo("회의실 A");
    log.info("회의실 생성 성공: " + response);
  }

//  @Test
//  @DisplayName("2️⃣회의실 수정 테스트")
//  void testUpdateMeetingRoom() {
//    MeetingRoom room = meetingRoomRepository.save(MeetingRoom.createMeetingRoom("테스트룸", "2층", 5));
//
//    MeetingRoomDTO dto = MeetingRoomDTO.builder()
//            .name("수정된 회의실")
//            .location("3층")
//            .capacity(10)
//            .build();
//
//    MeetingRoomDTO updated = meetingRoomService.updateMeetingRoom(room.getId(), dto);
//
//    assertThat(updated.getName()).isEqualTo("수정된 회의실");
//    assertThat(updated.getCapacity()).isEqualTo(10);
//    log.info("회의실 수정 성공: " + updated);
//  }
//
//  @Test
//  @DisplayName("3️⃣회의실 단일 조회 테스트") 
//  void testGetById() {
//    MeetingRoom saved = meetingRoomRepository.save(MeetingRoom.createMeetingRoom("회의실 B", "신관 2층", 6));
//    MeetingRoomDTO dto = meetingRoomService.getMeetingRoomById(saved.getId()); 
//    assertThat(dto).isNotNull();
//    assertThat(dto.getName()).isEqualTo("회의실 B");
//    log.info("회의실 단일 조회 성공: " + dto);
//  }
//
//  @Test
//  @DisplayName("4️⃣회의실 목록 조회 테스트 (전체)")
//  void testGetAllRooms() {
//    meetingRoomRepository.save(MeetingRoom.createMeetingRoom("룸1", "A동", 5));
//    meetingRoomRepository.save(MeetingRoom.createMeetingRoom("룸2", "B동", 10));
//
//    List<MeetingRoomDTO> list = meetingRoomService.getAllRooms(false);
//
//    assertThat(list).isNotEmpty();
//    log.info("회의실 목록 조회 성공: " + list.size() + "건");
//  }
//
//  @Test
//  @DisplayName("5️⃣사용 가능한 회의실만 조회 테스트") 
//  void testGetAvailableRooms() {
//    MeetingRoom available = meetingRoomRepository.save(MeetingRoom.createMeetingRoom("룸3", "C동", 8));
//    MeetingRoom disabled = meetingRoomRepository.save(MeetingRoom.createMeetingRoom("룸4", "D동", 10));
//    disabled.delete(); // Soft Delete 처리
//
//    List<MeetingRoomDTO> list = meetingRoomService.getAllRooms(true); 
//
//    assertThat(list).allMatch(MeetingRoomDTO::getAvailableYn);
//    log.info("사용 가능한 회의실 조회 성공: " + list.size() + "건");
//  }
//
//  @Test
//  @DisplayName("6️⃣회의실 삭제 테스트 (Soft Delete)")
//  void testDeleteMeetingRoom() {
//    MeetingRoom saved = meetingRoomRepository.save(MeetingRoom.createMeetingRoom("삭제룸", "본관", 4));
//
//    meetingRoomService.deleteMeetingRoom(saved.getId());
//
//    MeetingRoom deleted = meetingRoomRepository.findById(saved.getId()).orElseThrow();
//    assertThat(deleted.getDeletedYn()).isTrue();
//    assertThat(deleted.getAvailableYn()).isFalse();
//    log.info("회의실 삭제 성공 (Soft Delete): ID=" + deleted.getId());
//  }
}
