package com.goodee.coreconnect.security;

import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
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
import org.springframework.messaging.support.AbstractMessageChannel;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import com.goodee.coreconnect.chat.entity.ChatRoom;
import com.goodee.coreconnect.chat.service.ChatRoomService;
import com.goodee.coreconnect.config.ChatRoomOutboundInterceptor;
import com.goodee.coreconnect.security.jwt.JwtProvider;
import com.goodee.coreconnect.support.AbstractIntegrationTest;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

import jakarta.persistence.EntityManagerFactory;

/**
 * 나가는 메시지 참여자 확인(ChatRoomOutboundInterceptor) 비용 측정
 *
 * - 평소 테스트 실행에서는 건너뛰고, 환경변수 MEASURE=true일 때만 실행
 * - 참여자 N명(10, 50)이 모두 실제 STOMP로 방을 구독한 상태에서, 서버가 그 방에 메시지 M건을 보냄
 * - 같은 JVM에서 검사기를 빼고(OFF) / 넣고(ON) 번갈아 3회씩 잼. 처음 1회는 워밍업으로 버림
 * - 메시지 1건당: 모든 참여자가 받을 때까지 걸린 시간(ms), 실행된 DB 조회 수(Hibernate Statistics)
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
    "spring.mail.username=test@coreconnect.test",
    "spring.jpa.properties.hibernate.generate_statistics=true",
    "logging.level.org.hibernate.SQL=WARN",
    "logging.level.org.hibernate.engine.internal.StatisticalLoggingSessionEventListener=WARN"
})
@TestPropertySource(properties = "security.mode=secure")
@EnabledIfEnvironmentVariable(named = "MEASURE", matches = "true")
class ChatOutboundCheckMeasurementTest extends AbstractIntegrationTest {

  private static final int MESSAGES = 100;

  @LocalServerPort private int port;
  @Autowired private JwtProvider jwtProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private ChatRoomService chatRoomService;
  @Autowired private SimpMessagingTemplate messagingTemplate;
  @Autowired private ChatRoomOutboundInterceptor outboundInterceptor;
  @Autowired @Qualifier("clientOutboundChannel") private AbstractMessageChannel clientOutboundChannel;
  @Autowired private EntityManagerFactory entityManagerFactory;

  private final WebSocketStompClient stompClient = newClient();
  private final List<StompSession> sessions = new ArrayList<>();

  @AfterEach
  void tearDown() {
    sessions.forEach(s -> { try { s.disconnect(); } catch (Exception ignored) { } });
    stompClient.stop();
    if (!clientOutboundChannel.getInterceptors().contains(outboundInterceptor)) {
      clientOutboundChannel.addInterceptor(outboundInterceptor);
    }
  }

  @Test
  void measure() throws Exception {
    for (int members : new int[] {10, 50}) {
      Room room = roomWith(members);
      run(room, true, "warmup");   // 워밍업, 버림
      run(room, false, "warmup");
      for (int round = 1; round <= 3; round++) {
        run(room, false, "N=" + members + " OFF#" + round);
        run(room, true, "N=" + members + " ON#" + round);
      }
      sessions.forEach(s -> { try { s.disconnect(); } catch (Exception ignored) { } });
      sessions.clear();
    }
  }

  private void run(Room room, boolean checkOn, String label) throws Exception {
    if (checkOn) {
      if (!clientOutboundChannel.getInterceptors().contains(outboundInterceptor)) {
        clientOutboundChannel.addInterceptor(outboundInterceptor);
      }
    } else {
      clientOutboundChannel.removeInterceptor(outboundInterceptor);
    }
    CountDownLatch received = new CountDownLatch(room.members * MESSAGES);
    room.latch.set(received);

    Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
    stats.clear();
    long t0 = System.nanoTime();
    for (int i = 0; i < MESSAGES; i++) {
      messagingTemplate.convertAndSend(room.topic, "m-" + i);
    }
    if (!received.await(60, TimeUnit.SECONDS)) {
      throw new AssertionError(label + ": 60초 안에 모두 받지 못함, 남은 수=" + received.getCount());
    }
    long elapsed = System.nanoTime() - t0;
    long queries = stats.getPrepareStatementCount();
    if (!label.equals("warmup")) {
      System.out.printf("[MEASURE] %s msPerMessage=%.3f queriesPerMessage=%.2f deliveries=%d%n",
          label, elapsed / 1_000_000.0 / MESSAGES, (double) queries / MESSAGES, room.members * MESSAGES);
    }
  }

  // ───────────── 준비 ─────────────

  private record Room(String topic, int members, AtomicReference<CountDownLatch> latch) {}

  private Room roomWith(int members) throws Exception {
    List<User> users = new ArrayList<>();
    for (int i = 0; i < members; i++) {
      users.add(userRepository.save(User.createUser("pw", "m" + i, Role.USER, "m" + i + "-" + UUID.randomUUID() + "@test.com",
          null, null, null, null)));
    }
    ChatRoom room = chatRoomService.createChatRoom("측정방", users.stream().map(User::getId).toList(), users.get(0).getEmail());
    String topic = "/topic/chat.room." + room.getId();
    AtomicReference<CountDownLatch> latch = new AtomicReference<>(new CountDownLatch(0));
    for (User u : users) {
      WebSocketHttpHeaders handshake = new WebSocketHttpHeaders();
      handshake.add("Cookie", "access_token=" + jwtProvider.createAccess(u.getEmail(), u.getRole(), 60));
      StompSession session = stompClient
          .connectAsync("ws://localhost:" + port + "/ws/chat-ws", handshake, new StompHeaders(), new StompSessionHandlerAdapter() { })
          .get(10, TimeUnit.SECONDS);
      session.subscribe(topic, new StompFrameHandler() {
        @Override
        public Type getPayloadType(StompHeaders headers) {
          return String.class;
        }

        @Override
        public void handleFrame(StompHeaders headers, Object payload) {
          latch.get().countDown();
        }
      });
      sessions.add(session);
    }
    Thread.sleep(1000); // 구독 등록 대기
    return new Room(topic, members, latch);
  }

  private static WebSocketStompClient newClient() {
    WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
    client.setMessageConverter(new CompositeMessageConverter(List.of(new StringMessageConverter(), new MappingJackson2MessageConverter())));
    client.setInboundMessageSizeLimit(64 * 1024);
    return client;
  }
}
