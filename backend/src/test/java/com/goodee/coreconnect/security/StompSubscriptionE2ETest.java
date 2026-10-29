package com.goodee.coreconnect.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Type;
import java.util.List;
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
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import com.goodee.coreconnect.chat.entity.ChatRoom;
import com.goodee.coreconnect.chat.service.ChatRoomService;
import com.goodee.coreconnect.security.jwt.JwtProvider;
import com.goodee.coreconnect.support.AbstractIntegrationTest;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

/**
 * 실제 서버 포트를 띄우고, 실제 STOMP 클라이언트로 접속해서 구독·전송을 확인하는 테스트
 *
 * - 핸드셰이크 때 access_token 쿠키를 보내므로 WebSocketAuthInterceptor → 세션 속성(wsUserEmail)까지 운영과 같음
 * - 엔드포인트는 SockJS 없는 /ws/chat-ws (프론트의 /ws/chat과 같은 인터셉터·브로커를 씀)
 * - 서버가 방에 보내는 메시지는 SimpMessagingTemplate.convertAndSend로 직접 만듦 (Redis 경유 없이 SimpleBroker로)
 * - "받았다"는 3초 안에 도착, "안 받았다"는 같은 토픽의 대조 메시지가 도착할 때까지 기다린 뒤 판단
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
class StompSubscriptionE2ETest extends AbstractIntegrationTest {

  @LocalServerPort private int port;
  @Autowired private JwtProvider jwtProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private ChatRoomService chatRoomService;
  @Autowired private SimpMessagingTemplate messagingTemplate;
  @Autowired private org.springframework.transaction.PlatformTransactionManager transactionManager;
  @Autowired private com.goodee.coreconnect.chat.repository.ChatRoomUserRepository chatRoomUserRepository;
  @Autowired private com.goodee.coreconnect.chat.repository.ChatRoomRepository chatRoomRepository;

  private final WebSocketStompClient stompClient = newClient();

  @AfterEach
  void tearDown() {
    stompClient.stop();
  }

  @Test
  @DisplayName("[(나)] 남의 방 구독이 거부돼도 연결은 유지되고, 이미 구독한 내 방 메시지는 계속 받는다")
  void rejectedSubscription_keepsConnection() throws Exception {
    User a = newUser("a");
    ChatRoom myRoom = roomOf(a, newUser("friend"));
    ChatRoom othersRoom = roomOf(newUser("b"), newUser("c"));
    Client client = connect(a);

    BlockingQueue<String> myRoomInbox = client.subscribe("/topic/chat.room." + myRoom.getId());
    BlockingQueue<String> othersInbox = client.subscribe("/topic/chat.room." + othersRoom.getId());
    Thread.sleep(500); // 거부 처리(ERROR 프레임·연결 종료가 있다면)가 끝날 시간

    String mine = "내방-" + UUID.randomUUID();
    String others = "남의방-" + UUID.randomUUID();
    messagingTemplate.convertAndSend("/topic/chat.room." + othersRoom.getId(), others);
    messagingTemplate.convertAndSend("/topic/chat.room." + myRoom.getId(), mine);

    assertThat(myRoomInbox.poll(3, TimeUnit.SECONDS)).as("내 방 메시지 수신 (연결 유지)").isEqualTo(mine);
    assertThat(othersInbox.poll(500, TimeUnit.MILLISECONDS)).as("남의 방 메시지 수신").isNull();
    assertThat(client.session.isConnected()).as("STOMP 연결 상태").isTrue();
    assertThat(client.errors).as("받은 STOMP ERROR 프레임").isEmpty();
  }

  @Test
  @DisplayName("방에서 나간 B의 기존 구독으로는 그 방의 새 메시지가 더 이상 오지 않는다")
  void leftMember_existingSubscription_stopsReceiving() throws Exception {
    User b = newUser("b");
    User c = newUser("c");
    ChatRoom room = roomOf(b, c);
    String topic = "/topic/chat.room." + room.getId();
    Client clientB = connect(b);
    Client clientC = connect(c);
    BlockingQueue<String> inboxB = clientB.subscribe(topic);
    BlockingQueue<String> inboxC = clientC.subscribe(topic);
    Thread.sleep(300);

    chatRoomService.leaveChatRoom(room.getId(), b.getEmail());
    inboxB.clear(); // 나가기 안내 메시지는 버림
    inboxC.clear();

    String after = "나간뒤-" + UUID.randomUUID();
    messagingTemplate.convertAndSend(topic, after);

    assertThat(inboxC.poll(3, TimeUnit.SECONDS)).as("남아 있는 C는 받음 (대조군) / C 연결=" + clientC.session.isConnected()
        + ", C 오류=" + clientC.errors + ", B 연결=" + clientB.session.isConnected() + ", B 오류=" + clientB.errors).isEqualTo(after);
    assertThat(inboxB.poll(500, TimeUnit.MILLISECONDS)).as("나간 B가 받은 메시지").isNull();
  }

  @Test
  @DisplayName("참여자 캐시가 채워진 뒤에 B가 나가도, 같은 서버에서는 나간 직후 메시지부터 B에게 가지 않는다 (캐시 즉시 비움)")
  void leftMember_afterCacheWarmed_blockedImmediately() throws Exception {
    User b = newUser("b");
    User c = newUser("c");
    ChatRoom room = roomOf(b, c);
    String topic = "/topic/chat.room." + room.getId();
    Client clientB = connect(b);
    Client clientC = connect(c);
    BlockingQueue<String> inboxB = clientB.subscribe(topic);
    BlockingQueue<String> inboxC = clientC.subscribe(topic);
    Thread.sleep(300);

    // 나가기 전 메시지 1건 → 이때 캐시에 "B, C 참여"가 들어감
    String before = "나가기전-" + UUID.randomUUID();
    messagingTemplate.convertAndSend(topic, before);
    assertThat(inboxB.poll(3, TimeUnit.SECONDS)).as("나가기 전 B 수신 (캐시 채움)").isEqualTo(before);
    assertThat(inboxC.poll(3, TimeUnit.SECONDS)).isEqualTo(before);

    chatRoomService.leaveChatRoom(room.getId(), b.getEmail());
    Thread.sleep(300);
    inboxB.clear();
    inboxC.clear();

    // 캐시 유지 시간(5초)이 지나기 전에 바로 보냄
    String after = "나간직후-" + UUID.randomUUID();
    messagingTemplate.convertAndSend(topic, after);

    assertThat(inboxC.poll(3, TimeUnit.SECONDS)).as("남아 있는 C는 받음 (대조군)").isEqualTo(after);
    assertThat(inboxB.poll(500, TimeUnit.MILLISECONDS)).as("나간 B가 받은 메시지").isNull();
  }

  @Test
  @DisplayName("캐시가 채워진 뒤 다른 서버에서 초대된 것처럼 DB에만 참여자가 추가돼도, 새 참여자 D는 바로 메시지를 받는다 (유실 없음)")
  void newMemberAddedElsewhere_receivesDespiteStaleCache() throws Exception {
    User b = newUser("b");
    User c = newUser("c");
    User d = newUser("d");
    ChatRoom room = roomOf(b, c);
    String topic = "/topic/chat.room." + room.getId();
    Client clientB = connect(b);
    BlockingQueue<String> inboxB = clientB.subscribe(topic);
    Thread.sleep(300);

    // 캐시 채움 (B, C)
    String warm = "캐시채움-" + UUID.randomUUID();
    messagingTemplate.convertAndSend(topic, warm);
    assertThat(inboxB.poll(3, TimeUnit.SECONDS)).isEqualTo(warm);

    // 다른 서버에서 초대된 상황: 이 서버에는 캐시 비움 이벤트가 오지 않고 DB에만 행이 생김
    new org.springframework.transaction.support.TransactionTemplate(transactionManager).executeWithoutResult(status ->
        chatRoomUserRepository.save(com.goodee.coreconnect.chat.entity.ChatRoomUser.createChatRoomUser(
            userRepository.findById(d.getId()).orElseThrow(), chatRoomRepository.findById(room.getId()).orElseThrow())));

    Client clientD = connect(d);
    BlockingQueue<String> inboxD = clientD.subscribe(topic); // 구독 검사는 DB를 보므로 통과
    Thread.sleep(300);

    String msg = "초대직후-" + UUID.randomUUID();
    messagingTemplate.convertAndSend(topic, msg);

    assertThat(inboxD.poll(3, TimeUnit.SECONDS)).as("새 참여자 D가 받은 메시지").isEqualTo(msg);
    assertThat(inboxB.poll(3, TimeUnit.SECONDS)).as("기존 참여자 B").isEqualTo(msg);
  }

  @Test
  @DisplayName("A가 SEND를 /topic/chat.room.{id}로 직접 보내도 방 구독자에게 전달되지 않는다 (서버 메시지는 전달됨)")
  void sendDirectlyToTopic_notBroadcast() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    ChatRoom room = roomOf(b, newUser("c"));
    String topic = "/topic/chat.room." + room.getId();
    Client clientB = connect(b);
    BlockingQueue<String> inboxB = clientB.subscribe(topic);
    Thread.sleep(300);

    Client clientA = connect(a);
    String forged = "위조-" + UUID.randomUUID();
    clientA.session.send(topic, forged);
    Thread.sleep(500);
    String real = "서버-" + UUID.randomUUID();
    messagingTemplate.convertAndSend(topic, real);

    String first = inboxB.poll(3, TimeUnit.SECONDS);
    assertThat(first).as("B가 처음 받은 메시지 (위조가 막혔다면 서버 메시지)").isEqualTo(real);
  }

  // ───────────── 도우미 ─────────────

  private static WebSocketStompClient newClient() {
    WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
    // 서버가 문자열을 보내면 text/plain, 클라이언트가 보내면 application/json이라 둘 다 읽게 묶음
    client.setMessageConverter(new CompositeMessageConverter(List.of(new StringMessageConverter(), new MappingJackson2MessageConverter())));
    return client;
  }

  private Client connect(User user) throws Exception {
    WebSocketHttpHeaders handshake = new WebSocketHttpHeaders();
    handshake.add("Cookie", "access_token=" + jwtProvider.createAccess(user.getEmail(), user.getRole(), 30));
    Client client = new Client();
    client.session = stompClient
        .connectAsync("ws://localhost:" + port + "/ws/chat-ws", handshake, new StompHeaders(), client.handler)
        .get(5, TimeUnit.SECONDS);
    return client;
  }

  private User newUser(String prefix) {
    String email = prefix + "-" + UUID.randomUUID() + "@test.com";
    return userRepository.save(User.createUser("pw", prefix, Role.USER, email, null, null, null, null));
  }

  private ChatRoom roomOf(User creator, User other) {
    return chatRoomService.createChatRoom("방", List.of(creator.getId(), other.getId()), creator.getEmail());
  }

  /** STOMP 세션 하나 + 받은 ERROR 프레임 기록 */
  static class Client {
    StompSession session;
    final List<String> errors = new java.util.concurrent.CopyOnWriteArrayList<>();
    final StompSessionHandlerAdapter handler = new StompSessionHandlerAdapter() {
      @Override
      public void handleFrame(StompHeaders headers, Object payload) {
        errors.add(String.valueOf(headers.get("message")));
      }

      @Override
      public void handleTransportError(StompSession s, Throwable ex) {
        errors.add("transport: " + ex.getMessage());
      }
    };

    BlockingQueue<String> subscribe(String destination) {
      BlockingQueue<String> inbox = new LinkedBlockingQueue<>();
      session.subscribe(destination, new StompFrameHandler() {
        @Override
        public Type getPayloadType(StompHeaders headers) {
          return String.class;
        }

        @Override
        public void handleFrame(StompHeaders headers, Object payload) {
          inbox.add((String) payload);
        }
      });
      return inbox;
    }
  }
}
