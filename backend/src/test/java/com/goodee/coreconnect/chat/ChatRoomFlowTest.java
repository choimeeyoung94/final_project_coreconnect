package com.goodee.coreconnect.chat;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.goodee.coreconnect.chat.dto.response.ChatRoomLatestMessageResponseDTO;
import com.goodee.coreconnect.chat.entity.Chat;
import com.goodee.coreconnect.chat.entity.ChatRoom;
import com.goodee.coreconnect.chat.entity.ChatRoomUser;
import com.goodee.coreconnect.chat.entity.MessageFile;
import com.goodee.coreconnect.chat.repository.ChatRepository;
import com.goodee.coreconnect.chat.repository.ChatRoomUserRepository;
import com.goodee.coreconnect.chat.repository.NotificationRepository;
import com.goodee.coreconnect.chat.service.ChatRoomService;
import com.goodee.coreconnect.common.entity.Notification;
import com.goodee.coreconnect.common.notification.enums.NotificationType;
import com.goodee.coreconnect.common.notification.service.NotificationService;
import com.goodee.coreconnect.security.jwt.JwtProvider;
import com.goodee.coreconnect.support.AbstractIntegrationTest;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.JobGrade;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

/**
 * 채팅방·메시지·알림 흐름 테스트
 *
 * 테스트마다 사용자와 방을 직접 만든다. 실제 계정이나 고정된 방 번호에 의존하지 않는다.
 * STOMP 전송과 구독 권한은 StompSubscriptionE2ETest, AuthorizationIdorTest에서 확인한다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "jwt.secret=integration-test-jwt-secret-key-must-be-at-least-256-bits-long",
    "cloud.aws.credentials.access-key=test",
    "cloud.aws.credentials.secret-key=test",
    "cloud.aws.region.static=ap-northeast-2",
    "cloud.aws.s3.bucket=test-bucket",
    "sendgrid.api.key=test",
    "sendgrid.from.email=test@coreconnect.test",
    "sendgrid.from.name=CoreConnect",
    "sendgrid.reply.to=test@coreconnect.test",
    "spring.mail.host=localhost",
    "spring.mail.username=test@coreconnect.test"
})
class ChatRoomFlowTest extends AbstractIntegrationTest {

  @Autowired private ChatRoomService chatRoomService;
  @Autowired private UserRepository userRepository;
  @Autowired private JwtProvider jwtProvider;
  @Autowired private NotificationRepository notificationRepository;
  @Autowired private NotificationService notificationService;
  @Autowired private ChatRepository chatRepository;
  @Autowired private ChatRoomUserRepository chatRoomUserRepository;

  @LocalServerPort
  private int port;

  @Test
  @DisplayName("알림 WebSocket에 접속한 수신자에게 알림이 실시간으로 도착한다")
  void notificationWebSocket_pushesToConnectedUser() throws Exception {
    User user = newUser("알림수신자");
    String token = jwtProvider.createAccess(user.getEmail(), user.getRole(), 10);

    BlockingQueue<String> received = new LinkedBlockingQueue<>();
    TextWebSocketHandler clientHandler = new TextWebSocketHandler() {
      @Override
      protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        received.add(message.getPayload());
      }
    };
    // 서버는 SockJS로 등록되어 있어 일반 WebSocket은 /websocket 경로로 연결한다
    URI uri = URI.create("ws://localhost:" + port + "/ws/notification/websocket?accessToken=" + token);
    WebSocketSession session = new StandardWebSocketClient()
        .execute(clientHandler, new WebSocketHttpHeaders(), uri).get(5, TimeUnit.SECONDS);

    try {
      assertThat(session.isOpen()).isTrue();

      notificationService.sendNotification(user.getId(), NotificationType.EMAIL, "새 이메일이 왔습니다",
          null, null, user.getId(), user.getName(), null);

      assertThat(received.poll(5, TimeUnit.SECONDS)).contains("새 이메일이 왔습니다");
    } finally {
      session.close();
    }
  }

  @Test
  @DisplayName("여러 명으로 방을 만들면 group 방이 되고 참여자가 모두 저장된다")
  void createRoom_withManyUsers_isGroup() {
    User owner = newUser("방장");
    List<Integer> userIds = ids(owner, newUser("참여자1"), newUser("참여자2"), newUser("참여자3"), newUser("참여자4"));

    ChatRoom room = chatRoomService.createChatRoom("testRoom", userIds, owner.getEmail());

    ChatRoom found = chatRoomService.findById(room.getId());
    assertThat(found.getRoomName()).isEqualTo("testRoom");
    assertThat(found.getRoomType()).isEqualTo("group");
    assertThat(chatRoomService.getParticipantIds(room.getId())).containsExactlyInAnyOrderElementsOf(userIds);
  }

  @Test
  @DisplayName("방 종류를 alone으로 바꾸면 저장된다")
  void updateRoomType_changesToAlone() {
    User owner = newUser("방장");
    ChatRoom room = chatRoomService.createChatRoom("타입변경방", ids(owner, newUser("참여자")), owner.getEmail());
    assertThat(room.getRoomType()).isEqualTo("group");

    chatRoomService.updateRoomType(room.getId(), "alone");

    assertThat(chatRoomService.findById(room.getId()).getRoomType()).isEqualTo("alone");
  }

  @Test
  @DisplayName("텍스트와 파일 메시지가 방에 저장된다")
  void sendMessage_savesTextAndFile() {
    User owner = newUser("방장");
    ChatRoom room = chatRoomService.createChatRoom("메시지방", ids(owner, newUser("참여자")), owner.getEmail());

    chatRoomService.sendChatMessage(room.getId(), owner.getId(), "어서 오십시오");
    chatRoomService.sendChatMessage(room.getId(), owner.getId(),
        MessageFile.createMessageFile("test2.pdf", 12345.0, "chatfiles/test.pdf", null));

    List<Chat> chats = chatRepository.findByChatRoomId(room.getId());
    assertThat(chats).extracting(Chat::getMessageContent).contains("어서 오십시오");
    assertThat(chats).anyMatch(chat -> Boolean.TRUE.equals(chat.getFileYn()));
  }

  @Test
  @Transactional
  @DisplayName("참여 중인 방마다 마지막 메시지만 조회된다")
  void latestMessages_onePerRoom() {
    User me = newUser("나");
    User other = newUser("상대");
    ChatRoom first = chatRoomService.createChatRoom("방1", ids(me, other), me.getEmail());
    ChatRoom second = chatRoomService.createChatRoom("방2", ids(me, other), me.getEmail());
    chatRoomService.sendChatMessage(first.getId(), me.getId(), "방1 첫 메시지");
    chatRoomService.sendChatMessage(first.getId(), other.getId(), "방1 마지막");
    chatRoomService.sendChatMessage(second.getId(), other.getId(), "방2 마지막");

    List<Integer> roomIds = chatRoomService.getChatRoomIdsByUserId(me.getId()).stream()
        .map(ChatRoomLatestMessageResponseDTO::getRoomId)
        .collect(Collectors.toList());
    List<Chat> latest = chatRepository.findLatestMessageByChatRoomIds(roomIds);

    assertThat(roomIds).containsExactlyInAnyOrder(first.getId(), second.getId());
    assertThat(latest).extracting(Chat::getMessageContent).containsExactlyInAnyOrder("방1 마지막", "방2 마지막");
  }

  @Test
  @Transactional
  @DisplayName("3명 방의 메시지가 보낸 시각 오름차순으로 나오고 보낸 사람을 구분할 수 있다")
  void messages_orderedBySentTimeWithSender() {
    User me = newUser("나");
    User second = newUser("둘째");
    User third = newUser("셋째");
    ChatRoom room = chatRoomService.createChatRoom("정렬방", ids(me, second, third), me.getEmail());
    chatRoomService.sendChatMessage(room.getId(), me.getId(), "하나");
    chatRoomService.sendChatMessage(room.getId(), second.getId(), "둘");
    chatRoomService.sendChatMessage(room.getId(), third.getId(), "셋");

    List<Chat> messages = chatRepository.findByChatRoomIdOrderBySendAtAsc(room.getId());

    assertThat(messages).hasSize(3);
    assertThat(messages).isSortedAccordingTo(Comparator.comparing(Chat::getSendAt));
    assertThat(messages).filteredOn(chat -> chat.getSender().getId().equals(me.getId()))
        .extracting(Chat::getMessageContent).containsExactly("하나");
  }

  @Test
  @DisplayName("메시지를 받은 사람이 답신하면 순서대로 저장된다")
  void reply_savedAfterOriginal() {
    User sender = newUser("송신자");
    User receiver = newUser("수신자");
    ChatRoom room = chatRoomService.createChatRoom("답신방", ids(sender, receiver), sender.getEmail());

    chatRoomService.sendChatMessage(room.getId(), sender.getId(), "안녕하세요");
    chatRoomService.sendChatMessage(room.getId(), receiver.getId(), "네, 잘 받았습니다");

    List<Chat> messages = chatRepository.findByChatRoomIdOrderBySendAtAsc(room.getId());
    assertThat(messages).extracting(Chat::getMessageContent).containsExactly("안녕하세요", "네, 잘 받았습니다");
  }

  @Test
  @DisplayName("초대된 사용자는 참여자가 되고 메시지를 보낼 수 있다")
  void invite_addsParticipantWhoCanSend() {
    User owner = newUser("방장");
    User invited = newUser("초대대상");
    ChatRoom room = chatRoomService.createChatRoom("초대방", ids(owner, newUser("참여자")), owner.getEmail());
    assertThat(chatRoomService.getParticipantIds(room.getId())).doesNotContain(invited.getId());

    chatRoomUserRepository.save(ChatRoomUser.createChatRoomUser(invited, chatRoomService.findById(room.getId())));
    Chat joinChat = chatRoomService.sendChatMessage(room.getId(), invited.getId(), "참여했습니다");

    assertThat(chatRoomService.getParticipantIds(room.getId())).contains(invited.getId());
    assertThat(joinChat.getMessageContent()).isEqualTo("참여했습니다");
  }

  @Test
  @Transactional
  @DisplayName("이미지 메시지를 보내면 파일 이름이 메시지에 연결된다")
  void fileMessage_linksFileToChat() {
    User me = newUser("나");
    ChatRoom room = chatRoomService.createChatRoom("파일방", ids(me, newUser("상대")), me.getEmail());
    MessageFile image = MessageFile.createMessageFile("profile.png", 1024.0, "chatfiles/profile.png", null);

    chatRoomService.sendChatMessage(room.getId(), me.getId(), image);

    List<Chat> messages = chatRepository.findByChatRoomIdOrderBySendAtAsc(room.getId());
    assertThat(messages).hasSize(1);
    assertThat(messages.get(0).getFileYn()).isTrue();
    assertThat(messages.get(0).getMessageFiles()).extracting(MessageFile::getFileName).containsExactly("profile.png");
  }

  @Test
  @DisplayName("안 읽은 알림은 허용한 종류만 조회된다")
  void unreadNotifications_filteredByType() {
    User user = newUser("알림사용자");
    List<NotificationType> allowed = List.of(NotificationType.EMAIL, NotificationType.NOTICE,
        NotificationType.APPROVAL, NotificationType.SCHEDULE);
    notificationService.sendNotification(user.getId(), NotificationType.EMAIL, "메일 도착",
        null, null, user.getId(), user.getName(), null);
    notificationService.sendNotification(user.getId(), NotificationType.APPROVAL, "결재 도착",
        null, null, user.getId(), user.getName(), null);
    notificationService.sendNotification(user.getId(), NotificationType.CHAT, "채팅 도착",
        null, null, user.getId(), user.getName(), null);

    List<Notification> unread = notificationRepository.findUnreadByUserIdAndTypes(user.getId(), allowed);

    assertThat(unread).extracting(Notification::getNotificationMessage)
        .containsExactlyInAnyOrder("메일 도착", "결재 도착");
  }

  @Test
  @Transactional
  @DisplayName("안 읽은 메시지를 읽음 처리하면 더 이상 조회되지 않는다")
  void unreadChats_clearedAfterMarkRead() {
    User me = newUser("나");
    User other = newUser("상대");
    ChatRoom room = chatRoomService.createChatRoom("읽음방", ids(me, other), me.getEmail());
    chatRoomService.sendChatMessage(room.getId(), other.getId(), "안 읽은 메시지");

    List<Chat> unread = chatRepository.findByChatRoom_IdAndReadYnIsFalseWithSender(room.getId());
    assertThat(unread).extracting(Chat::getMessageContent).containsExactly("안 읽은 메시지");

    unread.forEach(Chat::markRead);

    assertThat(chatRepository.findByChatRoom_IdAndReadYnIsFalseWithSender(room.getId())).isEmpty();
  }

  @Test
  @DisplayName("화면이 받은 번호까지만 읽음이 되고, 그 뒤 메시지는 안 읽음으로 남는다")
  void markAsRead_upToReceivedMessageOnly() {
    User me = newUser("나");
    User other = newUser("상대");
    ChatRoom room = chatRoomService.createChatRoom("부분읽음방", ids(me, other), me.getEmail());
    Chat received = chatRoomService.sendChatMessage(room.getId(), me.getId(), "받은 메시지");
    Chat notReceived = chatRoomService.sendChatMessage(room.getId(), me.getId(), "못 받은 메시지");

    chatRoomService.markMessagesAsRead(room.getId(), other.getId(), received.getId());

    assertThat(chatRoomService.countUnreadByChatId(received.getId())).isZero();
    assertThat(chatRoomService.countUnreadByChatId(notReceived.getId())).isEqualTo(1);
  }

  @Test
  @DisplayName("접속하지 않은 참여자는 보낸 메시지의 안 읽은 인원에 잡힌다")
  void sendMessage_countsUnreadForNotConnectedUsers() {
    User me = newUser("나");
    User offline1 = newUser("미접속1");
    User offline2 = newUser("미접속2");
    ChatRoom room = chatRoomService.createChatRoom("미읽음방", ids(me, offline1, offline2), me.getEmail());

    Chat sent = chatRoomService.sendChatMessage(room.getId(), me.getId(), "테스트 메시지");

    assertThat(chatRoomService.getConnectedUserIdsInRoom(room.getId())).isEmpty();
    assertThat(chatRoomService.countUnreadByChatId(sent.getId())).isEqualTo(2);
  }

  private User newUser(String name) {
    String email = "chat-" + UUID.randomUUID() + "@test.com";
    return userRepository.save(User.createUser("pw", name, Role.USER, email, null, null, JobGrade.STAFF, null));
  }

  private List<Integer> ids(User... users) {
    List<Integer> ids = new ArrayList<>();
    for (User user : users) {
      ids.add(user.getId());
    }
    return ids;
  }
}
