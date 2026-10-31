package com.goodee.coreconnect.chat;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Type;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.messaging.converter.CompositeMessageConverter;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.converter.StringMessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import com.goodee.coreconnect.chat.entity.Chat;
import com.goodee.coreconnect.chat.entity.ChatRoom;
import com.goodee.coreconnect.chat.repository.ChatRepository;
import com.goodee.coreconnect.chat.service.ChatRoomService;
import com.goodee.coreconnect.security.jwt.JwtProvider;
import com.goodee.coreconnect.support.AbstractIntegrationTest;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.JobGrade;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

/**
 * 채팅방을 보고 있는 사용자를 서버가 알아보는지 확인하는 재현 테스트
 *
 * 실제 STOMP 클라이언트 2개로 같은 방을 구독한 뒤, 프론트와 같은 주소로 메시지를 보낸다.
 * 수정 전 코드에서 실패하면 접속자 명단이 비어 있다는 증거다.
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
@TestPropertySource(properties = "security.mode=secure")
class ChatConnectedUsersTest extends AbstractIntegrationTest {

  @LocalServerPort private int port;
  @Autowired private JwtProvider jwtProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private ChatRoomService chatRoomService;
  @Autowired private ChatRepository chatRepository;

  private final WebSocketStompClient stompClient = newClient();

  @AfterEach
  void tearDown() {
    stompClient.stop();
  }

  @Test
  @DisplayName("방을 구독 중인 사용자는 접속자로 조회된다")
  void subscribedUser_isConnected() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    ChatRoom room = roomOf(a, b);

    StompSession session = connect(b);
    subscribe(session, room);
    Thread.sleep(500);

    assertThat(chatRoomService.getConnectedUserIdsInRoom(room.getId())).contains(b.getId());
  }

  @Test
  @DisplayName("상대가 방을 구독 중이어도 저장 때는 안 읽음이고, 상대 화면이 읽음 처리하면 0이 된다")
  void messageToViewingUser_isReadAfterClientConfirms() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    ChatRoom room = roomOf(a, b);

    StompSession sender = connect(a);
    subscribe(sender, room);
    StompSession viewer = connect(b);
    BlockingQueue<Object> inbox = subscribe(viewer, room);
    Thread.sleep(500);

    StompHeaders headers = new StompHeaders();
    headers.setDestination("/app/chat.sendMessage");
    sender.send(headers, Map.of("roomId", room.getId(), "content", "보고 있나요"));

    assertThat(inbox.poll(5, TimeUnit.SECONDS)).isNotNull();
    Chat chat = savedChat(room);
    assertThat(chatRoomService.countUnreadByChatId(chat.getId())).isEqualTo(1);

    chatRoomService.markMessagesAsRead(room.getId(), b.getId());

    assertThat(chatRoomService.countUnreadByChatId(chat.getId())).isZero();
  }

  @Test
  @DisplayName("방을 나가면(구독 해제) 접속자에서 빠지고, 연결을 끊어도 빠진다")
  void leavingRoom_removesFromConnected() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    User c = newUser("c");
    ChatRoom room = chatRoomService.createChatRoom("방", List.of(a.getId(), b.getId(), c.getId()), a.getEmail());

    StompSession left = connect(b);
    StompSession.Subscription subscription = left.subscribe("/topic/chat.room." + room.getId(), ignoreFrames());
    StompSession dropped = connect(c);
    dropped.subscribe("/topic/chat.room." + room.getId(), ignoreFrames());
    Thread.sleep(500);
    assertThat(chatRoomService.getConnectedUserIdsInRoom(room.getId())).contains(b.getId(), c.getId());

    subscription.unsubscribe();
    dropped.disconnect();
    Thread.sleep(500);

    assertThat(chatRoomService.getConnectedUserIdsInRoom(room.getId())).isEmpty();
  }

  @Test
  @DisplayName("상대가 방을 보고 있지 않으면 보낸 메시지의 안 읽은 인원은 1이다")
  void messageToAbsentUser_isUnread() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    ChatRoom room = roomOf(a, b);

    StompSession sender = connect(a);
    BlockingQueue<Object> inbox = subscribe(sender, room);
    Thread.sleep(500);

    StompHeaders headers = new StompHeaders();
    headers.setDestination("/app/chat.sendMessage");
    sender.send(headers, Map.of("roomId", room.getId(), "content", "없나요"));

    assertThat(inbox.poll(5, TimeUnit.SECONDS)).isNotNull();
    Chat chat = savedChat(room);
    assertThat(chatRoomService.countUnreadByChatId(chat.getId())).isEqualTo(1);
  }

  /** 방송은 커밋 뒤에 나가므로 받은 직후 조회하면 저장되어 있어야 한다 */
  private Chat savedChat(ChatRoom room) {
    return chatRepository.findByChatRoomId(room.getId()).get(0);
  }

  private static WebSocketStompClient newClient() {
    WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
    client.setMessageConverter(new CompositeMessageConverter(
        List.of(new StringMessageConverter(), new MappingJackson2MessageConverter())));
    return client;
  }

  private StompSession connect(User user) throws Exception {
    WebSocketHttpHeaders handshake = new WebSocketHttpHeaders();
    handshake.add("Cookie", "access_token=" + jwtProvider.createAccess(user.getEmail(), user.getRole(), 30));
    return stompClient
        .connectAsync("ws://localhost:" + port + "/ws/chat-ws", handshake, new StompHeaders(),
            new StompSessionHandlerAdapter() {})
        .get(5, TimeUnit.SECONDS);
  }

  private BlockingQueue<Object> subscribe(StompSession session, ChatRoom room) {
    BlockingQueue<Object> inbox = new LinkedBlockingQueue<>();
    session.subscribe("/topic/chat.room." + room.getId(), new StompFrameHandler() {
      @Override
      public Type getPayloadType(StompHeaders headers) {
        return Map.class;
      }

      @Override
      public void handleFrame(StompHeaders headers, Object payload) {
        inbox.add(payload);
      }
    });
    return inbox;
  }

  private StompFrameHandler ignoreFrames() {
    return new StompFrameHandler() {
      @Override
      public Type getPayloadType(StompHeaders headers) {
        return Map.class;
      }

      @Override
      public void handleFrame(StompHeaders headers, Object payload) {
      }
    };
  }

  private User newUser(String prefix) {
    String email = prefix + "-" + UUID.randomUUID() + "@test.com";
    return userRepository.save(User.createUser("pw", prefix, Role.USER, email, null, null, JobGrade.STAFF, null));
  }

  private ChatRoom roomOf(User creator, User other) {
    return chatRoomService.createChatRoom("방", List.of(creator.getId(), other.getId()), creator.getEmail());
  }
}
