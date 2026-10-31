package com.goodee.coreconnect.notification;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.socket.sockjs.client.SockJsClient;
import org.springframework.web.socket.sockjs.client.WebSocketTransport;

import com.goodee.coreconnect.chat.repository.NotificationRepository;
import com.goodee.coreconnect.security.jwt.JwtProvider;
import com.goodee.coreconnect.support.AbstractIntegrationTest;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.JobGrade;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

/**
 * 알림 WebSocket 위조 재현 테스트
 *
 * 공격자가 자기 알림 소켓으로 recipientId를 넣은 메시지를 보내 다른 사람에게 알림을 만들 수 있는지 확인한다.
 * 수정 전 코드에서 실패하는 것이 정상이다(= 구멍이 실제로 있다는 증거).
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
class NotificationWebSocketSpoofTest extends AbstractIntegrationTest {

  @Autowired private JwtProvider jwtProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private NotificationRepository notificationRepository;

  @LocalServerPort
  private int port;

  @Test
  @DisplayName("로그인한 사용자가 소켓 메시지로 다른 사람의 알림을 만들 수 없다")
  void clientMessage_cannotCreateNotificationForOthers() throws Exception {
    User attacker = newUser("공격자");
    User victim = newUser("피해자");
    WebSocketSession session = connect(attacker);

    try {
      session.sendMessage(new TextMessage("{\"recipientId\":" + victim.getId() + ",\"type\":\"NOTICE\",\"message\":\"위조 공지\"}"));
      Thread.sleep(1500);

      assertThat(notificationRepository.findByUserId(victim.getId())).isEmpty();
    } finally {
      session.close();
    }
  }

  @Test
  @DisplayName("프론트의 PING을 받아도 연결이 유지된다")
  void ping_keepsConnectionOpen() throws Exception {
    User user = newUser("사용자");
    WebSocketSession session = connect(user);

    try {
      session.sendMessage(new TextMessage("{\"type\":\"PING\",\"ts\":1}"));
      Thread.sleep(500);

      assertThat(session.isOpen()).isTrue();
    } finally {
      session.close();
    }
  }

  /** 프론트와 같은 SockJS 클라이언트로, 로그인 쿠키를 붙여 연결한다 */
  private WebSocketSession connect(User user) throws Exception {
    String token = jwtProvider.createAccess(user.getEmail(), user.getRole(), 10);
    WebSocketHttpHeaders headers = new WebSocketHttpHeaders();
    headers.add("Cookie", "access_token=" + token);
    SockJsClient client = new SockJsClient(List.of(new WebSocketTransport(new StandardWebSocketClient())));
    return client.execute(new TextWebSocketHandler(), headers,
        URI.create("http://localhost:" + port + "/ws/notification")).get(5, TimeUnit.SECONDS);
  }

  private User newUser(String name) {
    String email = "spoof-" + UUID.randomUUID() + "@test.com";
    return userRepository.save(User.createUser("pw", name, Role.USER, email, null, null, JobGrade.STAFF, null));
  }
}
