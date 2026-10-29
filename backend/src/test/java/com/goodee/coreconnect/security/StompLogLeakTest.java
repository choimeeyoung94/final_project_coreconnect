package com.goodee.coreconnect.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;

import com.goodee.coreconnect.support.AbstractIntegrationTest;

/**
 * STOMP 프레임이 들어올 때 로그에 토큰·채팅 내용이 남지 않는지
 *
 * - WebSocketAuthInterceptor가 핸드셰이크 때 세션 속성에 access_token을 넣음 → 이전 로깅 인터셉터는 헤더 전체(세션 속성 포함)와 본문을 INFO로 남겼음
 * - 운영과 같은 clientInboundChannel로 SUBSCRIBE·SEND 프레임을 보내고, 그동안 찍힌 콘솔 로그를 검사
 */
@ExtendWith(OutputCaptureExtension.class)
class StompLogLeakTest extends AbstractIntegrationTest {

  @Autowired @Qualifier("clientInboundChannel") private MessageChannel clientInboundChannel;

  @Test
  @DisplayName("들어오는 STOMP 프레임 로그에 세션의 access_token 값과 채팅 본문이 찍히지 않는다")
  void inboundFrames_doNotLogTokenOrContent(CapturedOutput output) {
    String token = "test-token-" + UUID.randomUUID();
    String content = "로그에-나오면-안되는-대화-" + UUID.randomUUID();
    String sessionId = "ws-" + UUID.randomUUID();

    send(StompCommand.SUBSCRIBE, sessionId, token, "/topic/notice.board", new byte[0]);
    send(StompCommand.SEND, sessionId, token, "/app/unknown", content.getBytes(StandardCharsets.UTF_8));

    assertThat(output.getAll()).as("로그에 토큰 값").doesNotContain(token);
    assertThat(output.getAll()).as("로그에 채팅 본문").doesNotContain(content);
  }

  private void send(StompCommand command, String sessionId, String token, String destination, byte[] payload) {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(command);
    accessor.setSessionId(sessionId);
    accessor.setDestination(destination);
    if (command == StompCommand.SUBSCRIBE) {
      accessor.setSubscriptionId("sub-" + sessionId);
    }
    Map<String, Object> attributes = new HashMap<>();
    attributes.put("wsUserEmail", "someone@test.com");
    attributes.put("access_token", token);
    accessor.setSessionAttributes(attributes);
    try {
      clientInboundChannel.send(MessageBuilder.createMessage(payload, accessor.getMessageHeaders()));
    } catch (RuntimeException ignored) {
      // 처리할 곳이 없는 목적지 등은 무시. 확인 대상은 로그
    }
  }
}
