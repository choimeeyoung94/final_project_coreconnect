package com.goodee.coreconnect.notification;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.after;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.web.socket.WebSocketSession;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.goodee.coreconnect.common.notification.service.WebSocketDeliveryService;

/**
 * Redis에 발행하지 못하면(연결 끊김 등) 이 서버에 붙은 연결로는 보내는지 (알림이 아예 사라지지 않게)
 * - 스프링·Docker 없이 서비스 객체만 만들어서 확인
 */
class NotificationRelayFallbackTest {

  @Test
  @DisplayName("Redis 발행이 실패하면 이 서버에 붙은 받는 사람에게는 1번 보낸다")
  void redisDown_deliversLocally() throws Exception {
    StringRedisTemplate redis = mock(StringRedisTemplate.class);
    doThrow(new RedisConnectionFailureException("down")).when(redis).convertAndSend(anyString(), any());
    WebSocketDeliveryService service = new WebSocketDeliveryService(new ObjectMapper(), redis, new com.goodee.coreconnect.config.RedisGuard(), mock(RedisMessageListenerContainer.class));
    WebSocketSession local = mock(WebSocketSession.class);
    when(local.isOpen()).thenReturn(true);
    when(local.getId()).thenReturn("local");
    service.registerSession(5001, local);

    service.sendToUser(5001, Map.of("type", "CHAT", "message", "hi"));

    verify(local, timeout(2000).times(1)).sendMessage(any());
    verify(local, after(300).times(1)).sendMessage(any());
  }
}
