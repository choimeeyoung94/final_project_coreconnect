package com.goodee.coreconnect.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mockingDetails;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.goodee.coreconnect.approval.dto.request.ApprovalLineRequestDTO;
import com.goodee.coreconnect.approval.dto.request.DocumentCreateRequestDTO;
import com.goodee.coreconnect.approval.entity.Template;
import com.goodee.coreconnect.approval.enums.ApprovalLineType;
import com.goodee.coreconnect.approval.repository.TemplateRepository;
import com.goodee.coreconnect.approval.service.ApprovalService;
import com.goodee.coreconnect.chat.controller.ChatMessageController;
import com.goodee.coreconnect.chat.dto.request.SendMessageRequestDTO;
import com.goodee.coreconnect.chat.entity.ChatRoom;
import com.goodee.coreconnect.chat.service.ChatRoomService;
import com.goodee.coreconnect.common.notification.service.WebSocketDeliveryService;
import com.goodee.coreconnect.schedule.dto.request.RequestScheduleDTO;
import com.goodee.coreconnect.schedule.service.ScheduleService;
import com.goodee.coreconnect.support.AbstractIntegrationTest;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

/**
 * 유령 알림 테스트
 *
 * 본래 작업(일정·채팅·결재)이 롤백되면 알림도 저장·전송되면 안 되고,
 * 성공하면 수신자마다 알림이 정확히 1번 저장·전송되어야 함.
 *
 * 화면 전송(WebSocketDeliveryService.sendToUser)은 @SpyBean으로 감싸 호출 횟수를 셈.
 * 각 테스트는 새 사용자를 만들어 쓰므로 서로의 데이터에 영향을 주지 않음.
 */
class GhostNotificationTest extends AbstractIntegrationTest {

  @SpyBean
  private WebSocketDeliveryService webSocketDeliveryService;

  @Autowired private UserRepository userRepository;
  @Autowired private ScheduleService scheduleService;
  @Autowired private ChatRoomService chatRoomService;
  @Autowired private ChatMessageController chatMessageController;
  @Autowired private ApprovalService approvalService;
  @Autowired private TemplateRepository templateRepository;
  @Autowired private PlatformTransactionManager transactionManager;
  @Autowired private JdbcTemplate jdbcTemplate;

  private static final LocalDateTime START = LocalDateTime.of(2030, 1, 10, 10, 0);
  private static final LocalDateTime END = START.plusHours(1);

  // ───────────── 일정 ─────────────

  @Test
  @DisplayName("[일정] 참여자 B의 시간 충돌로 일정 생성이 롤백되면, 먼저 처리된 참여자 A에게 알림이 저장·전송되지 않는다")
  void schedule_rollback_noGhostNotification() {
    User owner = newUser("owner");
    User a = newUser("a");
    User b = newUser("b");
    scheduleService.createSchedule(schedule("B의 기존 일정", List.of()), b.getEmail()); // B는 같은 시간에 일정이 있음
    clearPushHistory();

    assertThatThrownBy(() -> scheduleService.createSchedule(schedule("회의", List.of(a.getId(), b.getId())), owner.getEmail()))
        .isInstanceOf(IllegalArgumentException.class);

    assertThat(countSchedules(owner)).as("일정은 롤백되어 없어야 함").isZero();
    assertThat(countNotifications(a)).as("A의 알림 행").isZero();
    assertThat(pushCount(a)).as("A에게 화면 전송 횟수").isZero();
  }

  @Test
  @DisplayName("[일정] 일정 생성이 성공하면 참여자와 생성자에게 알림이 정확히 1번씩 저장·전송된다")
  void schedule_success_notifiesOnce() {
    User owner = newUser("owner");
    User a = newUser("a");

    scheduleService.createSchedule(schedule("회의", List.of(a.getId())), owner.getEmail());

    assertThat(countNotifications(a)).isEqualTo(1);
    assertThat(pushCount(a)).isEqualTo(1);
    assertThat(countNotifications(owner)).isEqualTo(1);
    assertThat(pushCount(owner)).isEqualTo(1);
  }

  // ───────────── 채팅 ─────────────

  @Test
  @DisplayName("[채팅] 메시지 전송 트랜잭션이 롤백되면 메시지·알림이 모두 없고 알림 전송도 없다")
  void chat_rollback_noGhostNotification() {
    User sender = newUser("sender");
    User receiver = newUser("receiver");
    ChatRoom room = chatRoomService.createChatRoom("방", List.of(sender.getId(), receiver.getId()), sender.getEmail());

    // 메시지 전송 이후 단계에서 실패한 상황을 흉내 냄: 바깥 트랜잭션을 롤백으로 끝냄
    new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
      chatMessageController.sendMessage(message(room, "안녕하세요"), wsSession(sender));
      status.setRollbackOnly();
    });

    assertThat(countChats(room)).as("메시지는 롤백되어 없어야 함").isZero();
    assertThat(countNotifications(receiver)).as("수신자 알림 행").isZero();
    assertThat(pushCount(receiver)).as("수신자에게 화면 전송 횟수").isZero();
  }

  @Test
  @DisplayName("[채팅] 메시지 전송이 성공하면 수신자에게 알림이 정확히 1번 저장·전송된다")
  void chat_success_notifiesOnce() {
    User sender = newUser("sender");
    User receiver = newUser("receiver");
    ChatRoom room = chatRoomService.createChatRoom("방", List.of(sender.getId(), receiver.getId()), sender.getEmail());

    chatMessageController.sendMessage(message(room, "안녕하세요"), wsSession(sender));

    assertThat(countChats(room)).isEqualTo(1);
    assertThat(countNotifications(receiver)).isEqualTo(1);
    assertThat(pushCount(receiver)).isEqualTo(1);
  }

  // ───────────── 결재 ─────────────

  @Test
  @DisplayName("[결재] 결재 상신 트랜잭션이 롤백되면 결재자·기안자에게 알림 전송이 없다")
  void approval_rollback_noGhostPush() {
    User drafter = newUser("drafter");
    User approver = newUser("approver");
    Integer templateId = normalTemplateId(drafter);

    new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
      approvalService.createDocument(document(templateId, approver), null, drafter.getEmail());
      status.setRollbackOnly();
    });

    assertThat(countNotifications(approver)).as("결재자 알림 행").isZero();
    assertThat(pushCount(approver)).as("결재자에게 화면 전송 횟수").isZero();
    assertThat(pushCount(drafter)).as("기안자에게 화면 전송 횟수").isZero();
  }

  @Test
  @DisplayName("[결재] 결재 상신이 성공하면 결재자와 기안자에게 알림이 정확히 1번씩 저장·전송된다")
  void approval_success_notifiesOnce() {
    User drafter = newUser("drafter");
    User approver = newUser("approver");
    Integer templateId = normalTemplateId(drafter);

    approvalService.createDocument(document(templateId, approver), null, drafter.getEmail());

    assertThat(countNotifications(approver)).isEqualTo(1);
    assertThat(pushCount(approver)).isEqualTo(1);
    assertThat(countNotifications(drafter)).isEqualTo(1);
    assertThat(pushCount(drafter)).isEqualTo(1);
  }

  // ───────────── 준비·집계 도우미 ─────────────

  private User newUser(String prefix) {
    String email = prefix + "-" + UUID.randomUUID() + "@test.com";
    return userRepository.save(User.createUser("pw", prefix, Role.USER, email, null, null, null, null));
  }

  private RequestScheduleDTO schedule(String title, List<Integer> participantIds) {
    return RequestScheduleDTO.builder()
        .title(title)
        .startDateTime(START)
        .endDateTime(END)
        .participantIds(participantIds)
        .build();
  }

  private SendMessageRequestDTO message(ChatRoom room, String content) {
    SendMessageRequestDTO req = new SendMessageRequestDTO();
    req.setRoomId(room.getId());
    req.setContent(content);
    return req;
  }

  /** WebSocketAuthInterceptor가 세션에 넣어 주는 로그인 정보를 테스트에서 직접 만듦 */
  private SimpMessageHeaderAccessor wsSession(User user) {
    SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.create();
    Map<String, Object> attributes = new HashMap<>();
    attributes.put("wsUserEmail", user.getEmail());
    accessor.setSessionAttributes(attributes);
    return accessor;
  }

  /** 1번 양식은 휴가 양식(ApprovalServiceImpl.LEAVE_TEMPLATE_ID)이라, 휴가가 아닌 양식 ID를 돌려줌 */
  private Integer normalTemplateId(User owner) {
    Template template = templateRepository.save(Template.createTemplate("일반", "<p></p>", "GENERAL-" + UUID.randomUUID(), owner));
    if (template.getId() == 1) {
      template = templateRepository.save(Template.createTemplate("일반", "<p></p>", "GENERAL-" + UUID.randomUUID(), owner));
    }
    return template.getId();
  }

  private DocumentCreateRequestDTO document(Integer templateId, User approver) {
    ApprovalLineRequestDTO line = new ApprovalLineRequestDTO();
    line.setUserId(approver.getId());
    line.setType(ApprovalLineType.APPROVE);

    DocumentCreateRequestDTO dto = new DocumentCreateRequestDTO();
    dto.setTemplateId(templateId);
    dto.setDocumentTitle("구매 요청");
    dto.setDocumentDataJson("{}");
    dto.setApprovalLines(List.of(line));
    return dto;
  }

  private int countNotifications(User user) {
    return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM notification WHERE user_id = ?", Integer.class, user.getId());
  }

  private int countSchedules(User owner) {
    return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM schedule WHERE user_id = ?", Integer.class, owner.getId());
  }

  private int countChats(ChatRoom room) {
    return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM chat_message WHERE chat_room_id = ?", Integer.class, room.getId());
  }

  /** 해당 사용자에게 sendToUser가 호출된 횟수 */
  private long pushCount(User user) {
    return mockingDetails(webSocketDeliveryService).getInvocations().stream()
        .filter(i -> i.getMethod().getName().equals("sendToUser"))
        .filter(i -> user.getId().equals(i.getArgument(0)))
        .count();
  }

  private void clearPushHistory() {
    org.mockito.Mockito.clearInvocations(webSocketDeliveryService);
  }
}
