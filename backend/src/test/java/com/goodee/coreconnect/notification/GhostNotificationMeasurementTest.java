package com.goodee.coreconnect.notification;

import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.mockingDetails;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
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

import lombok.extern.slf4j.Slf4j;

/**
 * 유령 알림 결과 수치 측정용 (검증이 아니라 기록용이라 assert 없음)
 *
 * 평소 테스트 실행에서는 건너뛰고, 환경변수 MEASURE=true일 때만 실행
 * - 롤백 시나리오(일정·채팅·결재)를 각각 100회 반복해 남은 유령 알림 행 수와 유령 화면 전송 수를 셈
 * - 정상 시나리오를 각각 100회 반복해 알림 저장·전송 수와 처리 시간(평균/p95)을 셈
 */
@Slf4j
@EnabledIfEnvironmentVariable(named = "MEASURE", matches = "true")
class GhostNotificationMeasurementTest extends AbstractIntegrationTest {

  private static final int REPEAT = 100;

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

  private Integer templateId;

  @Test
  @DisplayName("유령 알림 수치 측정")
  void measure() {
    templateId = normalTemplateId();
    List<String> rows = new ArrayList<>();
    rows.add(scheduleRollback());
    rows.add(chatRollback());
    rows.add(approvalRollback());
    rows.add(scheduleSuccess());
    rows.add(chatSuccess());
    rows.add(approvalSuccess());

    log.info("MEASURE_RESULT scenario,repeat,expectedNotifications,actualNotifications,expectedPushes,actualPushes,avgMs,p95Ms");
    rows.forEach(r -> log.info("MEASURE_RESULT {}", r));
  }

  // ───────────── 롤백 시나리오: 기대 알림 0, 전송 0 ─────────────

  private String scheduleRollback() {
    long ghostRows = 0, ghostPushes = 0;
    for (int i = 0; i < REPEAT; i++) {
      LocalDateTime start = slot(i);
      User owner = newUser("owner"), a = newUser("a"), b = newUser("b");
      scheduleService.createSchedule(schedule("B 기존 일정", start, List.of()), b.getEmail());
      clearInvocations(webSocketDeliveryService);
      try {
        scheduleService.createSchedule(schedule("회의", start, List.of(a.getId(), b.getId())), owner.getEmail());
      } catch (IllegalArgumentException expected) {
        // B 시간 충돌로 롤백
      }
      ghostRows += countNotifications(a) + countNotifications(owner);
      ghostPushes += pushCount(a) + pushCount(owner);
    }
    return row("schedule_rollback", 0, ghostRows, 0, ghostPushes, null);
  }

  private String chatRollback() {
    long ghostRows = 0, ghostPushes = 0;
    for (int i = 0; i < REPEAT; i++) {
      User sender = newUser("sender"), receiver = newUser("receiver");
      ChatRoom room = chatRoomService.createChatRoom("방", List.of(sender.getId(), receiver.getId()), sender.getEmail());
      clearInvocations(webSocketDeliveryService);
      new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
        chatMessageController.sendMessage(message(room), wsSession(sender));
        status.setRollbackOnly();
      });
      ghostRows += countNotifications(receiver);
      ghostPushes += pushCount(receiver);
    }
    return row("chat_rollback", 0, ghostRows, 0, ghostPushes, null);
  }

  private String approvalRollback() {
    long ghostRows = 0, ghostPushes = 0;
    for (int i = 0; i < REPEAT; i++) {
      User drafter = newUser("drafter"), approver = newUser("approver");
      clearInvocations(webSocketDeliveryService);
      new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
        approvalService.createDocument(document(approver), null, drafter.getEmail());
        status.setRollbackOnly();
      });
      ghostRows += countNotifications(approver) + countNotifications(drafter);
      ghostPushes += pushCount(approver) + pushCount(drafter);
    }
    return row("approval_rollback", 0, ghostRows, 0, ghostPushes, null);
  }

  // ───────────── 정상 시나리오: 수신자마다 알림 1, 전송 1 ─────────────

  private String scheduleSuccess() {
    long rows = 0, pushes = 0;
    List<Long> nanos = new ArrayList<>();
    for (int i = 0; i < REPEAT; i++) {
      User owner = newUser("owner"), a = newUser("a");
      clearInvocations(webSocketDeliveryService);
      long begin = System.nanoTime();
      scheduleService.createSchedule(schedule("회의", slot(i), List.of(a.getId())), owner.getEmail());
      nanos.add(System.nanoTime() - begin);
      rows += countNotifications(a) + countNotifications(owner);
      pushes += pushCount(a) + pushCount(owner);
    }
    return row("schedule_success", REPEAT * 2, rows, REPEAT * 2, pushes, nanos);
  }

  private String chatSuccess() {
    long rows = 0, pushes = 0;
    List<Long> nanos = new ArrayList<>();
    for (int i = 0; i < REPEAT; i++) {
      User sender = newUser("sender"), receiver = newUser("receiver");
      ChatRoom room = chatRoomService.createChatRoom("방", List.of(sender.getId(), receiver.getId()), sender.getEmail());
      clearInvocations(webSocketDeliveryService);
      long begin = System.nanoTime();
      chatMessageController.sendMessage(message(room), wsSession(sender));
      nanos.add(System.nanoTime() - begin);
      rows += countNotifications(receiver);
      pushes += pushCount(receiver);
    }
    return row("chat_success", REPEAT, rows, REPEAT, pushes, nanos);
  }

  private String approvalSuccess() {
    long rows = 0, pushes = 0;
    List<Long> nanos = new ArrayList<>();
    for (int i = 0; i < REPEAT; i++) {
      User drafter = newUser("drafter"), approver = newUser("approver");
      clearInvocations(webSocketDeliveryService);
      long begin = System.nanoTime();
      approvalService.createDocument(document(approver), null, drafter.getEmail());
      nanos.add(System.nanoTime() - begin);
      rows += countNotifications(approver) + countNotifications(drafter);
      pushes += pushCount(approver) + pushCount(drafter);
    }
    return row("approval_success", REPEAT * 2, rows, REPEAT * 2, pushes, nanos);
  }

  // ───────────── 도우미 ─────────────

  private String row(String scenario, long expectedRows, long rows, long expectedPushes, long pushes, List<Long> nanos) {
    String timing = ",,";
    if (nanos != null) {
      List<Long> sorted = new ArrayList<>(nanos);
      Collections.sort(sorted);
      double avgMs = sorted.stream().mapToLong(Long::longValue).average().orElse(0) / 1_000_000.0;
      double p95Ms = sorted.get((int) Math.ceil(sorted.size() * 0.95) - 1) / 1_000_000.0;
      timing = String.format(",%.1f,%.1f", avgMs, p95Ms);
    }
    return scenario + "," + REPEAT + "," + expectedRows + "," + rows + "," + expectedPushes + "," + pushes + timing;
  }

  /** 반복마다 다른 시간대를 써서 이전 반복의 일정과 겹치지 않게 함 */
  private LocalDateTime slot(int i) {
    return LocalDateTime.of(2031, 1, 1, 0, 0).plusHours(i * 2L);
  }

  private User newUser(String prefix) {
    String email = prefix + "-" + UUID.randomUUID() + "@test.com";
    return userRepository.save(User.createUser("pw", prefix, Role.USER, email, null, null, null, null));
  }

  private RequestScheduleDTO schedule(String title, LocalDateTime start, List<Integer> participantIds) {
    return RequestScheduleDTO.builder()
        .title(title)
        .startDateTime(start)
        .endDateTime(start.plusHours(1))
        .participantIds(participantIds)
        .build();
  }

  private SendMessageRequestDTO message(ChatRoom room) {
    SendMessageRequestDTO req = new SendMessageRequestDTO();
    req.setRoomId(room.getId());
    req.setContent("안녕하세요");
    return req;
  }

  private SimpMessageHeaderAccessor wsSession(User user) {
    SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.create();
    Map<String, Object> attributes = new HashMap<>();
    attributes.put("wsUserEmail", user.getEmail());
    accessor.setSessionAttributes(attributes);
    return accessor;
  }

  /** 1번 양식은 휴가 양식이라, 휴가가 아닌 양식 ID를 돌려줌 */
  private Integer normalTemplateId() {
    User owner = newUser("template-owner");
    Template template = templateRepository.save(Template.createTemplate("일반", "<p></p>", "GENERAL-" + UUID.randomUUID(), owner));
    if (template.getId() == 1) {
      template = templateRepository.save(Template.createTemplate("일반", "<p></p>", "GENERAL-" + UUID.randomUUID(), owner));
    }
    return template.getId();
  }

  private DocumentCreateRequestDTO document(User approver) {
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

  private long pushCount(User user) {
    return mockingDetails(webSocketDeliveryService).getInvocations().stream()
        .filter(i -> i.getMethod().getName().equals("sendToUser"))
        .filter(i -> user.getId().equals(i.getArgument(0)))
        .count();
  }
}
