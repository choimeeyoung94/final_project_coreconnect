package com.goodee.coreconnect.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.after;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import com.goodee.coreconnect.common.notification.service.WebSocketDeliveryService;
import com.goodee.coreconnect.support.AbstractIntegrationTest;

/**
 * 알림 실시간 전송을 서버 여러 대에서도 받게 하는지 (Redis 채널로 서버끼리 나누기)
 *
 * - 서버1 = 테스트가 띄운 스프링의 WebSocketDeliveryService
 * - 서버2 = 같은 Redis를 쓰는 WebSocketDeliveryService를 하나 더 만듦 (자기 Redis 구독 컨테이너 포함)
 *   생성자는 코드 버전에 따라 받는 것이 달라서, 스프링에 있는 빈을 타입으로 찾아 넘김
 * - 브라우저 연결은 가짜 WebSocketSession(mock). sendMessage가 몇 번 불렸는지로 "받았는지" 셈
 * - 전송은 비동기(스레드풀)라 Mockito timeout/after로 기다림
 */
class NotificationRedisRelayTest extends AbstractIntegrationTest {

  @Autowired private WebSocketDeliveryService server1;
  @Autowired private ApplicationContext context;
  @Autowired private RedisConnectionFactory redisConnectionFactory;

  private final List<RedisMessageListenerContainer> extraContainers = new ArrayList<>();

  @AfterEach
  void tearDown() throws Exception {
    for (RedisMessageListenerContainer c : extraContainers) {
      c.stop();
      c.destroy();
    }
  }

  @Test
  @DisplayName("C의 알림 연결이 서버2에만 있어도, 서버1에서 보낸 알림을 C가 1번 받는다")
  void otherServer_receivesOnce() throws Exception {
    WebSocketDeliveryService server2 = newServer();
    WebSocketSession cOnServer2 = session("c-on-2");
    server2.registerSession(3001, cOnServer2);

    server1.sendToUser(3001, Map.of("type", "CHAT", "message", "B: 안녕"));

    ArgumentCaptor<TextMessage> sent = ArgumentCaptor.forClass(TextMessage.class);
    verify(cOnServer2, timeout(3000).times(1)).sendMessage(sent.capture());
    verify(cOnServer2, after(500).times(1)).sendMessage(any()); // 더 오지 않음
    assertThat(sent.getValue().getPayload()).contains("\"message\":\"B: 안녕\"");
  }

  @Test
  @DisplayName("C가 서버1(보낸 서버)에 붙어 있으면 1번만 받는다 (두 번 가지 않음)")
  void sameServer_receivesOnce() throws Exception {
    newServer(); // 서버가 여러 대인 상태
    WebSocketSession cOnServer1 = session("c-on-1");
    server1.registerSession(3002, cOnServer1);

    server1.sendToUser(3002, Map.of("type", "CHAT", "message", "hi"));

    verify(cOnServer1, timeout(3000).times(1)).sendMessage(any());
    verify(cOnServer1, after(500).times(1)).sendMessage(any());
  }

  @Test
  @DisplayName("여러 명에게 보내면(sendToUsers) 서버1의 B와 서버2의 C가 각각 1번 받는다")
  void manyRecipients_acrossServers() throws Exception {
    WebSocketDeliveryService server2 = newServer();
    WebSocketSession bOnServer1 = session("b-on-1");
    WebSocketSession cOnServer2 = session("c-on-2b");
    server1.registerSession(3003, bOnServer1);
    server2.registerSession(3004, cOnServer2);

    server1.sendToUsers(List.of(3003, 3004), Map.of("type", "SCHEDULE", "message", "회의"));

    verify(bOnServer1, timeout(3000).times(1)).sendMessage(any());
    verify(cOnServer2, timeout(3000).times(1)).sendMessage(any());
    verify(bOnServer1, after(500).times(1)).sendMessage(any());
    verify(cOnServer2, times(1)).sendMessage(any());
  }

  @Test
  @DisplayName("받는 사람이 어느 서버에도 연결돼 있지 않으면 오류 없이 아무에게도 안 간다")
  void nobodyConnected_noError() throws Exception {
    WebSocketDeliveryService server2 = newServer();
    WebSocketSession other = session("other");
    server2.registerSession(3005, other);

    server1.sendToUser(3999, Map.of("type", "CHAT", "message", "x"));

    verify(other, after(800).never()).sendMessage(any());
  }

  @Test
  @EnabledIfEnvironmentVariable(named = "MEASURE", matches = "true")
  void measureCrossServerLatency() throws Exception {
    WebSocketDeliveryService server2 = newServer();
    List<Long> nanos = new ArrayList<>();
    for (int i = 0; i < 120; i++) {
      WebSocketSession s = session("m" + i);
      long[] got = new long[1];
      org.mockito.Mockito.doAnswer(inv -> { got[0] = System.nanoTime(); return null; }).when(s).sendMessage(any());
      server2.registerSession(4000 + i, s);
      long t0 = System.nanoTime();
      server1.sendToUser(4000 + i, Map.of("type", "CHAT", "message", "m" + i));
      verify(s, timeout(3000).times(1)).sendMessage(any());
      if (i >= 20) nanos.add(got[0] - t0); // 처음 20번은 워밍업으로 버림
    }
    nanos.sort(Long::compare);
    System.out.printf("[MEASURE] cross-server notification n=%d p50=%.2fms p95=%.2fms max=%.2fms%n", nanos.size(),
        nanos.get(nanos.size() / 2) / 1e6, nanos.get((int) Math.ceil(nanos.size() * 0.95) - 1) / 1e6, nanos.get(nanos.size() - 1) / 1e6);
  }

  // ───────────── 도우미 ─────────────

  /** 같은 Redis를 쓰는 "다른 서버"의 WebSocketDeliveryService */
  private WebSocketDeliveryService newServer() throws Exception {
    RedisMessageListenerContainer container = new RedisMessageListenerContainer();
    container.setConnectionFactory(redisConnectionFactory);
    container.afterPropertiesSet();
    container.start();
    extraContainers.add(container);

    Constructor<?> ctor = WebSocketDeliveryService.class.getConstructors()[0];
    Object[] args = new Object[ctor.getParameterCount()];
    Class<?>[] types = ctor.getParameterTypes();
    for (int i = 0; i < types.length; i++) {
      args[i] = types[i] == RedisMessageListenerContainer.class ? container : context.getBean(types[i]);
    }
    WebSocketDeliveryService server = (WebSocketDeliveryService) ctor.newInstance(args);
    for (Method m : WebSocketDeliveryService.class.getDeclaredMethods()) {
      if (m.isAnnotationPresent(jakarta.annotation.PostConstruct.class)) {
        m.setAccessible(true);
        m.invoke(server);
      }
    }
    Thread.sleep(300); // 구독 등록이 Redis에 반영될 시간
    return server;
  }

  private static WebSocketSession session(String id) {
    WebSocketSession s = mock(WebSocketSession.class);
    when(s.isOpen()).thenReturn(true);
    when(s.getId()).thenReturn(id);
    return s;
  }
}
