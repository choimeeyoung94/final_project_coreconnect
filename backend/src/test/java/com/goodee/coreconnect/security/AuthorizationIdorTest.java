package com.goodee.coreconnect.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.broker.SimpleBrokerMessageHandler;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.goodee.coreconnect.approval.dto.request.ApprovalLineRequestDTO;
import com.goodee.coreconnect.approval.dto.request.DocumentCreateRequestDTO;
import com.goodee.coreconnect.approval.entity.File;
import com.goodee.coreconnect.approval.entity.Template;
import com.goodee.coreconnect.approval.enums.ApprovalLineType;
import com.goodee.coreconnect.approval.repository.DocumentRepository;
import com.goodee.coreconnect.approval.repository.FileRepository;
import com.goodee.coreconnect.approval.repository.TemplateRepository;
import com.goodee.coreconnect.approval.service.ApprovalService;
import com.goodee.coreconnect.approval.service.FileStorageService;
import com.goodee.coreconnect.chat.controller.ChatMessageController;
import com.goodee.coreconnect.chat.dto.request.SendMessageRequestDTO;
import com.goodee.coreconnect.chat.entity.ChatRoom;
import com.goodee.coreconnect.chat.repository.NotificationRepository;
import com.goodee.coreconnect.chat.service.ChatRoomService;
import com.goodee.coreconnect.common.entity.Notification;
import com.goodee.coreconnect.common.notification.enums.NotificationType;
import com.goodee.coreconnect.email.entity.Email;
import com.goodee.coreconnect.email.entity.EmailFile;
import com.goodee.coreconnect.email.entity.EmailRecipient;
import com.goodee.coreconnect.email.enums.EmailStatusEnum;
import com.goodee.coreconnect.email.repository.EmailFileRepository;
import com.goodee.coreconnect.email.repository.EmailRecipientRepository;
import com.goodee.coreconnect.email.repository.EmailRepository;
import com.goodee.coreconnect.email.service.EmailFileStorageService;
import com.goodee.coreconnect.schedule.dto.request.RequestScheduleDTO;
import com.goodee.coreconnect.schedule.entity.MeetingRoom;
import com.goodee.coreconnect.schedule.entity.ScheduleCategory;
import com.goodee.coreconnect.schedule.repository.MeetingRoomRepository;
import com.goodee.coreconnect.schedule.enums.ScheduleVisibility;
import com.goodee.coreconnect.schedule.repository.ScheduleCategoryRepository;
import com.goodee.coreconnect.schedule.repository.ScheduleParticipantRepository;
import com.goodee.coreconnect.schedule.repository.ScheduleRepository;
import com.goodee.coreconnect.schedule.service.ScheduleService;
import com.goodee.coreconnect.security.jwt.JwtProvider;
import com.goodee.coreconnect.support.AbstractIntegrationTest;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

import jakarta.servlet.http.Cookie;

/**
 * 인가 누락(IDOR) 재현 테스트 - H5~H9
 *
 * 공통 시나리오: 로그인한 직원 A(공격자)가 id나 이메일 값만 바꿔서 직원 B(피해자)의 데이터에 접근한다.
 * - 요청은 MockMvc로 보내고, 실제 로그인과 같은 access_token 쿠키(JwtProvider로 발급)를 붙인다.
 *   그래서 JwtAuthFilter → SecurityContext → 컨트롤러까지 운영과 같은 경로를 탄다.
 * - S3에서 파일을 읽는 부분만 가짜(MockBean)로 바꾼다. 권한 검사와 상관없는 외부 저장소이기 때문.
 * - "막혀야 한다" 테스트는 수정 전 코드에서 실패하는 것이 정상이다(= 구멍이 실제로 있다는 증거).
 * - "본인은 된다" 테스트는 수정 전·후 모두 통과해야 한다(= 고치면서 정상 기능을 깨지 않았다는 증거).
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = "security.mode=secure")
class AuthorizationIdorTest extends AbstractIntegrationTest {

  private static final byte[] FILE_BYTES = "secret-file".getBytes();

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtProvider jwtProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private EmailRepository emailRepository;
  @Autowired private EmailRecipientRepository emailRecipientRepository;
  @Autowired private EmailFileRepository emailFileRepository;
  @Autowired private ApprovalService approvalService;
  @Autowired private TemplateRepository templateRepository;
  @Autowired private DocumentRepository documentRepository;
  @Autowired private FileRepository fileRepository;
  @Autowired private ChatRoomService chatRoomService;
  @Autowired private ChatMessageController chatMessageController;
  @Autowired private ScheduleService scheduleService;
  @Autowired private ScheduleRepository scheduleRepository;
  @Autowired private ScheduleParticipantRepository scheduleParticipantRepository;
  @Autowired private ScheduleCategoryRepository scheduleCategoryRepository;
  @Autowired private NotificationRepository notificationRepository;
  @Autowired private MeetingRoomRepository meetingRoomRepository;
  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private PlatformTransactionManager transactionManager;
  @Autowired @Qualifier("clientInboundChannel") private MessageChannel clientInboundChannel;
  @Autowired private SimpleBrokerMessageHandler simpleBrokerMessageHandler;

  @MockBean private EmailFileStorageService emailFileStorageService;
  @MockBean private FileStorageService fileStorageService;

  // ───────────── H5 메일 ─────────────

  @Nested
  @DisplayName("H5 메일")
  class Mail {

    @Test
    @DisplayName("A가 B의 메일 id로 상세조회하면 403이다")
    void detail_otherUsersMail_forbidden() throws Exception {
      User a = newUser("a");
      User b = newUser("b");
      Email mail = mailTo(b, "B에게 온 급여 안내");

      mockMvc.perform(as(a, get("/api/v1/email/{id}", mail.getEmailId()).param("userEmail", a.getEmail())))
          .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("A가 userEmail을 B로 바꿔 상세조회해도 403이고, B의 메일은 안 읽음 상태로 남는다")
    void detail_spoofedUserEmail_forbiddenAndUnreadKept() throws Exception {
      User a = newUser("a");
      User b = newUser("b");
      Email mail = mailTo(b, "B에게 온 인사 평가");

      mockMvc.perform(as(a, get("/api/v1/email/{id}", mail.getEmailId()).param("userEmail", b.getEmail())))
          .andExpect(status().isForbidden());

      assertThat(readYnOf(mail, b)).as("B의 읽음 여부").isFalse();
    }

    @Test
    @DisplayName("A가 userEmail=B로 받은메일함을 요청해도 B의 메일 제목이 응답에 없다")
    void inbox_spoofedUserEmail_doesNotLeak() throws Exception {
      User a = newUser("a");
      User b = newUser("b");
      String title = "B만 볼 수 있는 제목-" + UUID.randomUUID();
      mailTo(b, title);

      MvcResult result = mockMvc.perform(as(a, get("/api/v1/email/inbox").param("userEmail", b.getEmail())))
          .andReturn();

      assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8)).doesNotContain(title);
    }

    @Test
    @DisplayName("A가 B의 임시저장 메일을 삭제하면 403이고, B의 임시메일은 그대로 DRAFT다")
    void deleteDraft_otherUsersDraft_forbidden() throws Exception {
      User a = newUser("a");
      User b = newUser("b");
      Email draft = draftOf(b);

      mockMvc.perform(as(a, delete("/api/v1/email/draft/delete/{id}", draft.getEmailId())))
          .andExpect(status().isForbidden());

      assertThat(emailRepository.findById(draft.getEmailId()).orElseThrow().getEmailStatus())
          .isEqualTo(EmailStatusEnum.DRAFT);
    }

    @Test
    @DisplayName("[정상] B는 자기 메일을 상세조회할 수 있다")
    void detail_ownMail_ok() throws Exception {
      User b = newUser("b");
      Email mail = mailTo(b, "B 본인 메일");

      mockMvc.perform(as(b, get("/api/v1/email/{id}", mail.getEmailId()).param("userEmail", b.getEmail())))
          .andExpect(status().isOk());
    }

    @Test
    @DisplayName("[정상] B는 받은메일함에서 자기 메일을 본다")
    void inbox_own_ok() throws Exception {
      User b = newUser("b");
      String title = "B 받은메일-" + UUID.randomUUID();
      mailTo(b, title);

      MvcResult result = mockMvc.perform(as(b, get("/api/v1/email/inbox").param("userEmail", b.getEmail())))
          .andExpect(status().isOk())
          .andReturn();

      assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8)).contains(title);
    }
  }

  // ───────────── H6 첨부파일 ─────────────

  @Nested
  @DisplayName("H6 첨부파일")
  class Attachment {

    @Test
    @DisplayName("A가 B의 메일 첨부 fileId로 다운로드하면 403이다")
    void emailAttachment_otherUsers_forbidden() throws Exception {
      User a = newUser("a");
      User b = newUser("b");
      EmailFile file = attachmentOf(mailTo(b, "첨부 있는 메일"));

      mockMvc.perform(as(a, get("/api/v1/email/file/download/{id}", file.getEmailFileId())))
          .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("A가 자기와 상관없는 결재 문서의 첨부 fileId로 다운로드하면 403이다")
    void approvalAttachment_unrelated_forbidden() throws Exception {
      User a = newUser("a");
      User drafter = newUser("drafter");
      User approver = newUser("approver");
      File file = approvalAttachment(drafter, approver);

      mockMvc.perform(as(a, get("/api/v1/approvals/file/download/{id}", file.getId())))
          .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("[정상] 메일 수신자 B는 첨부를 받을 수 있다")
    void emailAttachment_recipient_ok() throws Exception {
      User b = newUser("b");
      EmailFile file = attachmentOf(mailTo(b, "첨부 있는 메일"));

      mockMvc.perform(as(b, get("/api/v1/email/file/download/{id}", file.getEmailFileId())))
          .andExpect(status().isOk());
    }

    @Test
    @DisplayName("[정상] 결재자는 결재 문서 첨부를 받을 수 있다")
    void approvalAttachment_approver_ok() throws Exception {
      User drafter = newUser("drafter");
      User approver = newUser("approver");
      File file = approvalAttachment(drafter, approver);

      mockMvc.perform(as(approver, get("/api/v1/approvals/file/download/{id}", file.getId())))
          .andExpect(status().isOk());
    }
  }

  // ───────────── H7 채팅 REST ─────────────

  @Nested
  @DisplayName("H7 채팅 REST")
  class ChatRest {

    @Test
    @DisplayName("방에 없는 A가 그 방 메시지 목록을 조회하면 403이다")
    void readMessages_nonMember_forbidden() throws Exception {
      User a = newUser("a");
      ChatRoom room = roomOf(newUser("b"), newUser("c"));

      mockMvc.perform(as(a, get("/api/v1/chat/{roomId}/messages", room.getId())))
          .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("방에 없는 A가 그 방 참여자 목록을 조회하면 403이다")
    void readUsers_nonMember_forbidden() throws Exception {
      User a = newUser("a");
      ChatRoom room = roomOf(newUser("b"), newUser("c"));

      mockMvc.perform(as(a, get("/api/v1/chat/{roomId}/users", room.getId())))
          .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("방에 없는 A가 그 방에 메시지를 보내면 403이고, 메시지가 저장되지 않는다")
    void sendMessage_nonMember_forbiddenAndNotSaved() throws Exception {
      User a = newUser("a");
      ChatRoom room = roomOf(newUser("b"), newUser("c"));

      mockMvc.perform(as(a, post("/api/v1/chat/rooms/{roomId}/messages", room.getId())
              .contentType(MediaType.APPLICATION_JSON)
              .content("{\"roomId\":" + room.getId() + ",\"content\":\"끼어들기\"}")))
          .andExpect(status().isForbidden());

      assertThat(countChats(room)).isZero();
    }

    @Test
    @DisplayName("[정상] 방 참여자 B는 메시지 목록을 조회할 수 있다")
    void readMessages_member_ok() throws Exception {
      User b = newUser("b");
      ChatRoom room = roomOf(b, newUser("c"));

      mockMvc.perform(as(b, get("/api/v1/chat/{roomId}/messages", room.getId())))
          .andExpect(status().isOk());
    }
  }

  // ───────────── H9 채팅 실시간(STOMP) ─────────────

  @Nested
  @DisplayName("H9 채팅 STOMP")
  class ChatStomp {

    @Test
    @DisplayName("방에 없는 A의 SUBSCRIBE /topic/chat.room.{id}는 구독으로 등록되지 않는다 (참여자 B는 등록된다)")
    void subscribe_nonMember_notRegistered() throws Exception {
      User a = newUser("a");
      User b = newUser("b");
      ChatRoom room = roomOf(b, newUser("c"));
      String topic = "/topic/chat.room." + room.getId();
      String attackerSession = "ws-a-" + UUID.randomUUID();
      String memberSession = "ws-b-" + UUID.randomUUID();

      // 운영에서 STOMP 프레임이 들어오는 것과 같은 채널로 보냄 (인터셉터 → SimpleBroker 순서)
      sendIgnoringRejection(subscribeFrame(attackerSession, a, topic));
      sendIgnoringRejection(subscribeFrame(memberSession, b, topic));

      // 채널이 비동기라서, 참여자 B 구독이 등록될 때까지 기다린 뒤 A를 확인함
      waitUntil(() -> subscribedSessions(topic).containsKey(memberSession));
      Thread.sleep(200);

      assertThat(subscribedSessions(topic)).as("구독 등록된 세션").doesNotContainKey(attackerSession);
    }

    @Test
    @DisplayName("A가 와일드카드(/topic/chat.room.*)로 구독해 모든 방을 받으려 해도 구독으로 등록되지 않는다")
    void subscribe_wildcard_notRegistered() throws Exception {
      User a = newUser("a");
      User b = newUser("b");
      ChatRoom room = roomOf(b, newUser("c"));
      String topic = "/topic/chat.room." + room.getId();
      String attackerSession = "ws-a-" + UUID.randomUUID();
      String memberSession = "ws-b-" + UUID.randomUUID();

      sendIgnoringRejection(subscribeFrame(attackerSession, a, "/topic/chat.room.*"));
      sendIgnoringRejection(subscribeFrame(memberSession, b, topic));

      waitUntil(() -> subscribedSessions(topic).containsKey(memberSession));
      Thread.sleep(200);

      assertThat(subscribedSessions(topic)).as("이 방 토픽으로 메시지를 받을 세션").doesNotContainKey(attackerSession);
    }

    @Test
    @DisplayName("방에 없는 A가 STOMP로 그 방에 메시지를 보내도 저장되지 않는다")
    void stompSend_nonMember_notSaved() {
      User a = newUser("a");
      ChatRoom room = roomOf(newUser("b"), newUser("c"));

      SendMessageRequestDTO req = new SendMessageRequestDTO();
      req.setRoomId(room.getId());
      req.setContent("끼어들기");
      try {
        chatMessageController.sendMessage(req, wsSession(a));
      } catch (RuntimeException rejected) {
        // 수정 후에는 거부 예외가 날 수 있음. 여기서 확인하는 것은 "저장되지 않았다"
      }

      assertThat(countChats(room)).isZero();
    }
  }

  // ───────────── 알림 (리뷰에서 추가 발견) ─────────────

  @Nested
  @DisplayName("알림 읽음 처리")
  class NotificationRead {

    @Test
    @DisplayName("A가 B의 알림 id로 읽음 처리하면 403이고, B의 알림은 안 읽음으로 남는다 (두 API 모두)")
    void markRead_otherUsersNotification_forbidden() throws Exception {
      User a = newUser("a");
      User b = newUser("b");
      Notification notification = notificationOf(b);

      mockMvc.perform(as(a, put("/api/v1/notification/{id}/read", notification.getId())))
          .andExpect(status().isForbidden());
      mockMvc.perform(as(a, put("/api/v1/chat/notifications/{id}/read", notification.getId())))
          .andExpect(status().isForbidden());

      assertThat(notificationRepository.findById(notification.getId()).orElseThrow().getNotificationReadYn()).isFalse();
    }

    @Test
    @DisplayName("[정상] B는 자기 알림을 읽음 처리할 수 있다")
    void markRead_own_ok() throws Exception {
      User b = newUser("b");
      Notification notification = notificationOf(b);

      mockMvc.perform(as(b, put("/api/v1/chat/notifications/{id}/read", notification.getId())))
          .andExpect(status().isOk());
    }
  }

  // ───────────── H8 일정 ─────────────

  @Nested
  @DisplayName("H8 일정")
  class Schedule {

    @Test
    @DisplayName("A가 B의 일정을 삭제하면 403이고, B의 일정은 삭제되지 않는다")
    void delete_otherUsersSchedule_forbidden() throws Exception {
      User a = newUser("a");
      User b = newUser("b");
      Integer scheduleId = scheduleOf(b);

      mockMvc.perform(as(a, delete("/api/v1/schedules/{id}", scheduleId)))
          .andExpect(status().isForbidden());

      assertThat(scheduleRepository.findById(scheduleId).orElseThrow().getDeletedYn()).isNotEqualTo(Boolean.TRUE);
    }

    @Test
    @DisplayName("A가 B의 비공개 일정을 단건 조회하면 403이다")
    void read_otherUsersPrivateSchedule_forbidden() throws Exception {
      User a = newUser("a");
      User b = newUser("b");
      Integer scheduleId = scheduleOf(b);

      mockMvc.perform(as(a, get("/api/v1/schedules").param("id", String.valueOf(scheduleId))))
          .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("A가 B의 일정 목록(userId=B)을 조회하면 B의 공개 일정만 보이고 비공개 일정은 보이지 않는다")
    void userSchedules_otherUser_onlyPublic() throws Exception {
      User a = newUser("a");
      User b = newUser("b");
      String privateTitle = "B 비공개-" + UUID.randomUUID();
      String publicTitle = "B 공개-" + UUID.randomUUID();
      scheduleOf(b, privateTitle, ScheduleVisibility.PRIVATE, List.of());
      scheduleOf(b, publicTitle, ScheduleVisibility.PUBLIC, List.of());

      String body = mockMvc.perform(as(a, get("/api/v1/schedules").param("userId", String.valueOf(b.getId()))))
          .andExpect(status().isOk())
          .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

      assertThat(body).contains(publicTitle).doesNotContain(privateTitle);
    }

    @Test
    @DisplayName("A가 B 일정의 참여자(C)를 일정에서 빼면 403이고, C는 그대로 참여자다")
    void deleteParticipant_otherUsersSchedule_forbidden() throws Exception {
      User a = newUser("a");
      User b = newUser("b");
      User c = newUser("c");
      Integer scheduleId = scheduleOf(b, "B의 회의", ScheduleVisibility.PRIVATE, List.of(c.getId()));
      Integer participantId = participantIdOf(scheduleId, c);

      mockMvc.perform(as(a, delete("/api/v1/scheduleParticipants/{id}", participantId)))
          .andExpect(status().isForbidden());

      assertThat(participantIdOf(scheduleId, c)).isEqualTo(participantId);
    }

    @Test
    @DisplayName("A가 B의 일정 카테고리 이름을 바꾸면 403이고, 이름은 그대로다")
    void updateCategory_otherUsers_forbidden() throws Exception {
      User a = newUser("a");
      User b = newUser("b");
      ScheduleCategory category = scheduleCategoryRepository.save(ScheduleCategory.createScheduleCategory(b, "B의 카테고리", false));

      mockMvc.perform(as(a, put("/api/v1/scheduleCategories/{id}", category.getId())
              .contentType(MediaType.APPLICATION_JSON)
              .content("{\"name\":\"바꿔치기\",\"defaultYn\":false}")))
          .andExpect(status().isForbidden());

      assertThat(scheduleCategoryRepository.findById(category.getId()).orElseThrow().getName()).isEqualTo("B의 카테고리");
    }

    @Test
    @DisplayName("A가 B의 비공개 일정 참여자 목록을 조회하면 403이다")
    void participants_otherUsersPrivateSchedule_forbidden() throws Exception {
      User a = newUser("a");
      User b = newUser("b");
      Integer scheduleId = scheduleOf(b, "B의 비공개 면담", ScheduleVisibility.PRIVATE, List.of(newUser("c").getId()));

      mockMvc.perform(as(a, get("/api/v1/scheduleParticipants").param("scheduleId", String.valueOf(scheduleId))))
          .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("A가 참석자 일정 현황으로 B의 비공개 일정을 보면 제목은 '비공개 약속', 시간은 그대로, 내용·장소는 비어 있다")
    void availability_otherUsersPrivate_masked() throws Exception {
      User a = newUser("a");
      User b = newUser("b");
      PrivateSchedule s = privateScheduleOf(b, null);

      com.fasterxml.jackson.databind.JsonNode seen = availabilityOf(a, b, s).get(0);

      assertMasked(seen, s);
    }

    @Test
    @DisplayName("관리자가 봐도 B의 비공개 일정은 '비공개 약속'과 시간만 보인다")
    void availability_admin_masked() throws Exception {
      User admin = userRepository.save(User.createUser("pw", "admin", Role.ADMIN, "admin-" + UUID.randomUUID() + "@test.com", null, null, null, null));
      User b = newUser("b");
      PrivateSchedule s = privateScheduleOf(b, null);

      assertMasked(availabilityOf(admin, b, s).get(0), s);
    }

    @Test
    @DisplayName("A가 회의실 일정 목록에서 B의 비공개 일정을 보면 '비공개 약속'과 시간만 보인다")
    void meetingRoomSchedules_otherUsersPrivate_masked() throws Exception {
      User a = newUser("a");
      User b = newUser("b");
      MeetingRoom room = meetingRoomRepository.save(MeetingRoom.createMeetingRoom("회의실-" + UUID.randomUUID(), "3층", 6, true));
      PrivateSchedule s = privateScheduleOf(b, room.getId());

      String body = mockMvc.perform(as(a, get("/api/v1/schedules").param("meetingRoomId", String.valueOf(room.getId()))))
          .andExpect(status().isOk())
          .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

      assertMasked(new com.fasterxml.jackson.databind.ObjectMapper().readTree(body).get(0), s);
    }

    @Test
    @DisplayName("[정상] 참여자 C는 참석자 일정 현황에서 B의 비공개 일정 제목·내용을 그대로 본다")
    void availability_participant_seesAll() throws Exception {
      User b = newUser("b");
      User c = newUser("c");
      PrivateSchedule s = privateScheduleOf(b, null, c);

      com.fasterxml.jackson.databind.JsonNode seen = availabilityOf(c, b, s).get(0);

      assertThat(seen.get("title").asText()).isEqualTo(s.title);
      assertThat(seen.get("content").asText()).isEqualTo(s.content);
    }

    @Test
    @DisplayName("[정상] B는 자기 일정을 조회·삭제할 수 있다")
    void owner_readAndDelete_ok() throws Exception {
      User b = newUser("b");
      Integer scheduleId = scheduleOf(b);

      mockMvc.perform(as(b, get("/api/v1/schedules").param("id", String.valueOf(scheduleId))))
          .andExpect(status().isOk());
      mockMvc.perform(as(b, delete("/api/v1/schedules/{id}", scheduleId)))
          .andExpect(status().isNoContent());
    }
  }

  // ───────────── 준비 도우미 ─────────────

  /** 실제 로그인과 같은 access_token 쿠키를 붙임 → JwtAuthFilter가 SecurityContext에 이 사용자를 넣음 */
  private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
    String token = jwtProvider.createAccess(user.getEmail(), user.getRole(), 30);
    return request.cookie(new Cookie("access_token", token));
  }

  private User newUser(String prefix) {
    String email = prefix + "-" + UUID.randomUUID() + "@test.com";
    return userRepository.save(User.createUser("pw", prefix, Role.USER, email, null, null, null, null));
  }

  /** 제3자(sender)가 B에게 보낸, 발송 완료(SENT) 메일 */
  private Email mailTo(User recipient, String title) {
    User sender = newUser("sender");
    Email mail = emailRepository.save(Email.builder()
        .emailTitle(title)
        .emailContent("본문: " + title)
        .emailStatus(EmailStatusEnum.SENT)
        .senderId(sender.getId())
        .senderEmail(sender.getEmail())
        .emailSentTime(LocalDateTime.now())
        .emailFolder("SENT")
        .build());
    emailRecipientRepository.save(EmailRecipient.builder()
        .emailRecipientType("TO")
        .emailRecipientAddress(recipient.getEmail())
        .userId(recipient.getId())
        .email(mail)
        .build());
    return mail;
  }

  private Email draftOf(User owner) {
    return emailRepository.save(Email.builder()
        .emailTitle("B의 임시메일")
        .emailContent("작성 중")
        .emailStatus(EmailStatusEnum.DRAFT)
        .senderId(owner.getId())
        .senderEmail(owner.getEmail())
        .build());
  }

  private EmailFile attachmentOf(Email mail) {
    given(emailFileStorageService.loadFileAsInputStream(any())).willAnswer(i -> new ByteArrayInputStream(FILE_BYTES));
    return emailFileRepository.save(EmailFile.builder()
        .emailFileName("급여명세서.pdf")
        .emailFileSize((long) FILE_BYTES.length)
        .emailFileS3ObjectKey("email/" + UUID.randomUUID())
        .email(mail)
        .build());
  }

  private File approvalAttachment(User drafter, User approver) {
    given(fileStorageService.loadFileAsInputStream(any())).willAnswer(i -> new ByteArrayInputStream(FILE_BYTES));
    Template template = templateRepository.save(Template.createTemplate("일반", "<p></p>", "GENERAL-" + UUID.randomUUID(), drafter));
    if (template.getId() == 1) { // 1번은 휴가 양식(ApprovalServiceImpl.LEAVE_TEMPLATE_ID)
      template = templateRepository.save(Template.createTemplate("일반", "<p></p>", "GENERAL-" + UUID.randomUUID(), drafter));
    }
    ApprovalLineRequestDTO line = new ApprovalLineRequestDTO();
    line.setUserId(approver.getId());
    line.setType(ApprovalLineType.APPROVE);
    DocumentCreateRequestDTO dto = new DocumentCreateRequestDTO();
    dto.setTemplateId(template.getId());
    dto.setDocumentTitle("계약 검토");
    dto.setDocumentDataJson("{}");
    dto.setApprovalLines(List.of(line));

    Integer documentId = approvalService.createDocument(dto, null, drafter.getEmail());
    // File.createFile이 document.files(지연 로딩 컬렉션)에 추가하므로 트랜잭션 안에서 저장
    return new TransactionTemplate(transactionManager).execute(status -> fileRepository.save(File.createFile(
        documentRepository.findById(documentId).orElseThrow(), "계약서.pdf", "approval/" + UUID.randomUUID(), FILE_BYTES.length)));
  }

  private ChatRoom roomOf(User creator, User other) {
    return chatRoomService.createChatRoom("방", List.of(creator.getId(), other.getId()), creator.getEmail());
  }

  /** 기본 공개 범위가 PRIVATE인 B의 일정 (시간은 다른 테스트와 겹치지 않게 먼 미래) */
  private Integer scheduleOf(User owner) {
    return scheduleOf(owner, "B의 비공개 일정", ScheduleVisibility.PRIVATE, List.of());
  }

  private Integer scheduleOf(User owner, String title, ScheduleVisibility visibility, List<Integer> participantIds) {
    LocalDateTime start = LocalDateTime.of(2099, 1, 1, 10, 0).plusMinutes(Math.abs(UUID.randomUUID().hashCode() % 100000));
    RequestScheduleDTO dto = RequestScheduleDTO.builder()
        .title(title)
        .startDateTime(start)
        .endDateTime(start.plusHours(1))
        .visibility(visibility)
        .participantIds(participantIds)
        .build();
    return scheduleService.createSchedule(dto, owner.getEmail()).getId();
  }

  /** 비공개 일정 하나와, 원래 값(가려졌는지 비교용) */
  private record PrivateSchedule(Integer id, String title, String content, LocalDateTime start, LocalDateTime end) {}

  private PrivateSchedule privateScheduleOf(User owner, Integer meetingRoomId, User... participants) {
    LocalDateTime start = LocalDateTime.of(2099, 3, 1, 9, 0).plusMinutes(Math.abs(UUID.randomUUID().hashCode() % 600));
    String title = "B의 병원 예약-" + UUID.randomUUID();
    String content = "진료 내용 메모";
    RequestScheduleDTO dto = RequestScheduleDTO.builder()
        .title(title)
        .content(content)
        .location("서울 OO병원")
        .startDateTime(start)
        .endDateTime(start.plusHours(1))
        .visibility(ScheduleVisibility.PRIVATE)
        .meetingRoomId(meetingRoomId)
        .participantIds(java.util.Arrays.stream(participants).map(User::getId).toList())
        .build();
    Integer id = scheduleService.createSchedule(dto, owner.getEmail()).getId();
    return new PrivateSchedule(id, title, content, start, start.plusHours(1));
  }

  /** viewer가 GET /schedules/availability?userIds={owner}&date=... 로 본 owner의 일정 목록 (JSON 배열) */
  private com.fasterxml.jackson.databind.JsonNode availabilityOf(User viewer, User owner, PrivateSchedule s) throws Exception {
    String body = mockMvc.perform(as(viewer, get("/api/v1/schedules/availability")
            .param("userIds", String.valueOf(owner.getId()))
            .param("date", s.start.toLocalDate().toString())))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
    com.fasterxml.jackson.databind.JsonNode list = new com.fasterxml.jackson.databind.ObjectMapper().readTree(body).get(String.valueOf(owner.getId()));
    for (com.fasterxml.jackson.databind.JsonNode n : list) {
      if (n.get("id").asInt() == s.id) {
        com.fasterxml.jackson.databind.node.ArrayNode one = new com.fasterxml.jackson.databind.ObjectMapper().createArrayNode();
        one.add(n);
        return one;
      }
    }
    throw new AssertionError("응답에 일정 " + s.id + "이 없음: " + body);
  }

  private void assertMasked(com.fasterxml.jackson.databind.JsonNode seen, PrivateSchedule s) {
    assertThat(seen.get("title").asText()).as("제목").isEqualTo("비공개 약속");
    assertThat(java.time.LocalDateTime.parse(seen.get("startDateTime").asText().replace(' ', 'T'))).as("시작 시간").isEqualTo(s.start);
    assertThat(java.time.LocalDateTime.parse(seen.get("endDateTime").asText().replace(' ', 'T'))).as("끝 시간").isEqualTo(s.end);
    assertThat(seen.path("content").isNull() || seen.path("content").isMissingNode()).as("내용 숨김: " + seen.path("content")).isTrue();
    assertThat(seen.path("location").isNull() || seen.path("location").isMissingNode()).as("장소 숨김: " + seen.path("location")).isTrue();
  }

  /** 일정에서 해당 사용자의 (삭제되지 않은) 참여자 행 id, 없으면 null */
  private Integer participantIdOf(Integer scheduleId, User user) {
    return scheduleParticipantRepository.findByScheduleAndDeletedYnFalse(scheduleRepository.findById(scheduleId).orElseThrow())
        .stream()
        .filter(p -> p.getUser().getId().equals(user.getId()))
        .map(p -> p.getId())
        .findFirst()
        .orElse(null);
  }

  private Notification notificationOf(User recipient) {
    return notificationRepository.save(Notification.createNotification(
        recipient, NotificationType.SCHEDULE, "B에게 온 알림", null, null, null, null,
        false, true, false, LocalDateTime.now(), null, null));
  }

  private boolean readYnOf(Email mail, User recipient) {
    return emailRecipientRepository.findByEmail(mail).stream()
        .filter(r -> recipient.getId().equals(r.getUserId()))
        .anyMatch(r -> Boolean.TRUE.equals(r.getEmailReadYn()));
  }

  private int countChats(ChatRoom room) {
    return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM chat_message WHERE chat_room_id = ?", Integer.class, room.getId());
  }

  // ───────────── STOMP 도우미 ─────────────

  /** WebSocketAuthInterceptor가 핸드셰이크 때 세션에 넣는 값(wsUserEmail)을 그대로 넣은 SUBSCRIBE 프레임 */
  private Message<byte[]> subscribeFrame(String sessionId, User user, String destination) {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
    accessor.setSessionId(sessionId);
    accessor.setSubscriptionId("sub-" + sessionId);
    accessor.setDestination(destination);
    Map<String, Object> attributes = new HashMap<>();
    attributes.put("wsUserEmail", user.getEmail());
    accessor.setSessionAttributes(attributes);
    return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
  }

  private SimpMessageHeaderAccessor wsSession(User user) {
    SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.create();
    Map<String, Object> attributes = new HashMap<>();
    attributes.put("wsUserEmail", user.getEmail());
    accessor.setSessionAttributes(attributes);
    return accessor;
  }

  private void sendIgnoringRejection(Message<?> message) {
    try {
      clientInboundChannel.send(message);
    } catch (RuntimeException rejected) {
      // 인터셉터가 거부하면 MessageDeliveryException이 남. 결과는 구독 등록 여부로 판단
    }
  }

  /** SimpleBroker가 이 토픽으로 메시지를 보낼 세션 목록 (세션 id → 구독 id) */
  private Map<String, ?> subscribedSessions(String topic) {
    SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
    accessor.setDestination(topic);
    Message<byte[]> probe = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    return simpleBrokerMessageHandler.getSubscriptionRegistry().findSubscriptions(probe);
  }

  private void waitUntil(java.util.function.BooleanSupplier condition) throws InterruptedException {
    long deadline = System.currentTimeMillis() + 3000;
    while (!condition.getAsBoolean()) {
      if (System.currentTimeMillis() > deadline) {
        throw new AssertionError("3초 안에 조건이 만족되지 않음");
      }
      Thread.sleep(20);
    }
  }
}
