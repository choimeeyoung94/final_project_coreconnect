package com.goodee.coreconnect.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mockingDetails;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.goodee.coreconnect.chat.controller.ChatMessageController;
import com.goodee.coreconnect.chat.dto.request.SendMessageRequestDTO;
import com.goodee.coreconnect.chat.entity.ChatRoom;
import com.goodee.coreconnect.chat.service.ChatRoomService;
import com.goodee.coreconnect.common.notification.service.WebSocketDeliveryService;
import com.goodee.coreconnect.support.AbstractIntegrationTest;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

/**
 * 채팅방을 나갈 때 그 방 알림 정리
 *
 * - 채팅 알림은 저장할 때 어느 메시지(→ 방)의 알림인지 연결돼 있어야 함 (notification.chat_message_id)
 * - 방을 나가면 나간 사람의 그 방 알림만 지워지고, 다른 사람·다른 방 알림은 남아야 함
 * - 이미 열린 다른 탭이 목록에서 지울 수 있게, 나가기가 커밋된 뒤에만 나간 사람에게만
 *   CHAT_ROOM_NOTIFICATIONS_REMOVED 이벤트를 알림 WebSocket으로 보냄 (롤백되면 보내지 않음)
 * - 메시지는 STOMP 전송 처리 메서드(ChatMessageController.sendMessage)로 보냄. 받는 사람은 접속 중이 아니라서 알림이 저장됨
 */
class ChatNotificationOnLeaveTest extends AbstractIntegrationTest {

  private static final String REMOVED_EVENT = "CHAT_ROOM_NOTIFICATIONS_REMOVED";

  @SpyBean private WebSocketDeliveryService webSocketDeliveryService;
  @Autowired private UserRepository userRepository;
  @Autowired private ChatRoomService chatRoomService;
  @Autowired private ChatMessageController chatMessageController;
  @Autowired private PlatformTransactionManager transactionManager;
  @Autowired private JdbcTemplate jdbcTemplate;

  private User b;
  private User c;
  private User d;
  private ChatRoom room1;
  private ChatRoom room2;

  @BeforeEach
  void setUp() {
    b = newUser("b");
    c = newUser("c");
    d = newUser("d");
    room1 = chatRoomService.createChatRoom("방1", List.of(b.getId(), c.getId()), b.getEmail());
    room2 = chatRoomService.createChatRoom("방2", List.of(c.getId(), d.getId()), d.getEmail());

    send(b, room1, "방1 첫 메시지");   // → C에게 알림
    send(b, room1, "방1 두 번째");     // → C에게 알림
    send(d, room2, "방2 메시지");      // → C에게 알림
    send(c, room1, "C가 방1에 보냄");  // → B에게 알림
    org.mockito.Mockito.clearInvocations(webSocketDeliveryService);
  }

  @Test
  @DisplayName("채팅 알림은 어느 방 메시지의 알림인지 연결돼 저장된다")
  void chatNotification_isLinkedToRoom() {
    assertThat(countRoomNotifications(c, room1)).as("C의 방1 알림 (메시지에 연결된 것)").isEqualTo(2);
    assertThat(countRoomNotifications(c, room2)).as("C의 방2 알림").isEqualTo(1);
    assertThat(countUnlinkedChatNotifications(c)).as("방 연결이 없는 C의 채팅 알림").isZero();
  }

  @Test
  @DisplayName("C가 방1을 나가면 C의 방1 알림만 지워지고, C의 방2 알림과 B의 방1 알림은 남는다")
  void leave_deletesOnlyLeaversNotificationsOfThatRoom() {
    chatRoomService.leaveChatRoom(room1.getId(), c.getEmail());

    assertThat(countRoomNotifications(c, room1)).as("C의 방1 알림").isZero();
    assertThat(countRoomNotifications(c, room2)).as("C의 방2 알림").isEqualTo(1);
    assertThat(countRoomNotifications(b, room1)).as("B의 방1 알림").isGreaterThanOrEqualTo(1);
  }

  @Test
  @DisplayName("방을 나가면 커밋 뒤 나간 사람에게만 알림 삭제 이벤트를 1번 보낸다")
  void leave_sendsRemovedEventOnlyToLeaverAfterCommit() {
    chatRoomService.leaveChatRoom(room1.getId(), c.getEmail());

    assertThat(removedEvents(c, room1)).as("C에게 보낸 방1 알림 삭제 이벤트").isEqualTo(1);
    assertThat(removedEvents(b, room1)).as("B에게 보낸 삭제 이벤트").isZero();
  }

  @Test
  @DisplayName("방 나가기가 롤백되면 알림은 그대로이고 삭제 이벤트도 보내지 않는다")
  void leaveRolledBack_keepsNotificationsAndSendsNoEvent() {
    int before = countRoomNotifications(c, room1);

    new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
      chatRoomService.leaveChatRoom(room1.getId(), c.getEmail());
      status.setRollbackOnly();
    });

    assertThat(countRoomNotifications(c, room1)).as("C의 방1 알림").isEqualTo(before);
    assertThat(removedEvents(c, room1)).as("삭제 이벤트").isZero();
  }

  // ───────────── 도우미 ─────────────

  private User newUser(String prefix) {
    String email = prefix + "-" + UUID.randomUUID() + "@test.com";
    return userRepository.save(User.createUser("pw", prefix, Role.USER, email, null, null, null, null));
  }

  private void send(User sender, ChatRoom room, String content) {
    SendMessageRequestDTO req = new SendMessageRequestDTO();
    req.setRoomId(room.getId());
    req.setContent(content);
    SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.create();
    Map<String, Object> attributes = new HashMap<>();
    attributes.put("wsUserEmail", sender.getEmail());
    accessor.setSessionAttributes(attributes);
    chatMessageController.sendMessage(req, accessor);
  }

  /** 받는 사람의 알림 중, 연결된 메시지가 그 방 메시지인 것의 수 */
  private int countRoomNotifications(User recipient, ChatRoom room) {
    return jdbcTemplate.queryForObject(
        "SELECT COUNT(*) FROM notification n JOIN chat_message m ON n.chat_message_id = m.id "
            + "WHERE n.user_id = ? AND m.chat_room_id = ?",
        Integer.class, recipient.getId(), room.getId());
  }

  private int countUnlinkedChatNotifications(User recipient) {
    return jdbcTemplate.queryForObject(
        "SELECT COUNT(*) FROM notification WHERE user_id = ? AND notification_type = 'CHAT' AND chat_message_id IS NULL",
        Integer.class, recipient.getId());
  }

  /** 해당 사용자에게 sendToUser로 보낸 "이 방 알림 삭제" 이벤트 수 */
  private long removedEvents(User user, ChatRoom room) {
    return mockingDetails(webSocketDeliveryService).getInvocations().stream()
        .filter(i -> i.getMethod().getName().equals("sendToUser"))
        .filter(i -> user.getId().equals(i.getArgument(0)))
        .filter(i -> i.getArgument(1) instanceof Map<?, ?> payload
            && REMOVED_EVENT.equals(payload.get("type"))
            && room.getId().equals(payload.get("roomId")))
        .count();
  }
}
