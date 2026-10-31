package com.goodee.coreconnect.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;
import org.springframework.web.socket.messaging.SessionUnsubscribeEvent;

import com.goodee.coreconnect.support.AbstractIntegrationTest;

/**
 * 서버 여러 대의 접속자 명단 테스트
 *
 * 같은 Redis를 쓰는 등록부 객체 2개를 서버 2대로 보고, 한쪽의 구독이 다른 쪽에서 보이는지 확인한다.
 */
class ChatRoomViewerRegistryTest extends AbstractIntegrationTest {

  @Autowired private StringRedisTemplate redisTemplate;

  private final StompSessionUserRegistry sessionsOfServerA = new StompSessionUserRegistry();
  private final StompSessionUserRegistry sessionsOfServerB = new StompSessionUserRegistry();

  @Test
  @DisplayName("서버 A에 붙은 사용자가 서버 B의 명단에도 보이고, 해제하면 빠진다")
  void viewerOnOtherServer_isVisible() {
    ChatRoomViewerRegistry serverA = new ChatRoomViewerRegistry(sessionsOfServerA, redisTemplate, new RedisGuard());
    ChatRoomViewerRegistry serverB = new ChatRoomViewerRegistry(sessionsOfServerB, redisTemplate, new RedisGuard());
    sessionsOfServerA.register("session-1", 7);

    serverA.onSubscribe(subscribe("session-1", "sub-1", "/topic/chat.room.9001"));
    assertThat(serverB.viewerIds(9001)).containsExactly(7);

    serverA.onUnsubscribe(unsubscribe("session-1", "sub-1"));
    assertThat(serverB.viewerIds(9001)).isEmpty();
  }

  @Test
  @DisplayName("같은 사용자가 두 서버에서 같은 방을 보면 한 명으로 센다")
  void sameUserOnTwoServers_countsOnce() {
    ChatRoomViewerRegistry serverA = new ChatRoomViewerRegistry(sessionsOfServerA, redisTemplate, new RedisGuard());
    ChatRoomViewerRegistry serverB = new ChatRoomViewerRegistry(sessionsOfServerB, redisTemplate, new RedisGuard());
    sessionsOfServerA.register("session-1", 7);
    sessionsOfServerB.register("session-2", 7);

    serverA.onSubscribe(subscribe("session-1", "sub-1", "/topic/chat.room.9002"));
    serverB.onSubscribe(subscribe("session-2", "sub-1", "/topic/chat.room.9002"));

    assertThat(serverA.viewerIds(9002)).containsExactly(7);
  }

  @Test
  @DisplayName("죽은 서버처럼 시각이 갱신되지 않은 구독은 명단에서 빠진다")
  void staleViewer_isExcluded() {
    ChatRoomViewerRegistry server = new ChatRoomViewerRegistry(sessionsOfServerA, redisTemplate, new RedisGuard());
    long old = System.currentTimeMillis() - ChatRoomViewerRegistry.STALE_MILLIS - 1000;
    redisTemplate.opsForZSet().add(ChatRoomViewerRegistry.KEY_PREFIX + 9003, "7|dead-server|session/sub", old);

    assertThat(server.viewerIds(9003)).isEmpty();
  }

  @Test
  @DisplayName("살아 있는 서버는 시각을 갱신해 구독이 유지된다")
  void refresh_keepsLiveViewer() {
    ChatRoomViewerRegistry server = new ChatRoomViewerRegistry(sessionsOfServerA, redisTemplate, new RedisGuard());
    sessionsOfServerA.register("session-1", 7);
    server.onSubscribe(subscribe("session-1", "sub-1", "/topic/chat.room.9004"));
    String key = ChatRoomViewerRegistry.KEY_PREFIX + 9004;
    String member = redisTemplate.opsForZSet().range(key, 0, -1).iterator().next();
    redisTemplate.opsForZSet().add(key, member, System.currentTimeMillis() - ChatRoomViewerRegistry.STALE_MILLIS - 1000);
    assertThat(server.viewerIds(9004)).isEmpty();

    server.refresh();

    assertThat(server.viewerIds(9004)).containsExactly(7);
  }

  @Test
  @DisplayName("Redis 조회가 실패하면 이 서버 명단으로 답하고, 이후에는 Redis를 호출하지 않는다")
  void redisFailure_usesLocalAndSkipsRedis() {
    StringRedisTemplate broken = mock(StringRedisTemplate.class);
    given(broken.opsForZSet()).willThrow(new QueryTimeoutException("timeout"));
    ChatRoomViewerRegistry server = new ChatRoomViewerRegistry(sessionsOfServerA, broken, new RedisGuard());
    sessionsOfServerA.register("session-1", 7);

    server.onSubscribe(subscribe("session-1", "sub-1", "/topic/chat.room.9005"));

    assertThat(server.viewerIds(9005)).containsExactly(7);
    assertThat(server.viewerIds(9005)).containsExactly(7);
    verify(broken, times(1)).opsForZSet();
  }

  private SessionSubscribeEvent subscribe(String sessionId, String subscriptionId, String destination) {
    return new SessionSubscribeEvent(this, message(StompCommand.SUBSCRIBE, sessionId, subscriptionId, destination));
  }

  private SessionUnsubscribeEvent unsubscribe(String sessionId, String subscriptionId) {
    return new SessionUnsubscribeEvent(this, message(StompCommand.UNSUBSCRIBE, sessionId, subscriptionId, null));
  }

  private Message<byte[]> message(StompCommand command, String sessionId, String subscriptionId, String destination) {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(command);
    accessor.setSessionId(sessionId);
    accessor.setSubscriptionId(subscriptionId);
    accessor.setDestination(destination);
    Map<String, Object> attributes = new HashMap<>();
    accessor.setSessionAttributes(attributes);
    return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
  }
}
