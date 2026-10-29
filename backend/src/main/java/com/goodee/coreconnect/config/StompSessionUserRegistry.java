package com.goodee.coreconnect.config;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

/**
 * STOMP 세션 id → 로그인 사용자 id
 *
 * - 서버가 구독자에게 메시지를 내보낼 때(clientOutboundChannel) 메시지 헤더에는 세션 id만 있고
 *   핸드셰이크 때 넣은 세션 속성(wsUserEmail)은 없음 → 받는 사람이 누구인지 알려고 이 표를 씀
 * - CONNECT 때 StompInboundAuthorizationInterceptor가 등록, 연결이 끊기면 SessionDisconnectEvent로 제거
 * - 서버 한 대의 메모리에만 있음 (각 서버는 자기에게 붙은 세션만 내보내므로 충분)
 */
@Component
public class StompSessionUserRegistry {

  private final Map<String, Integer> userIdBySession = new ConcurrentHashMap<>();

  public void register(String sessionId, Integer userId) {
    if (sessionId != null && userId != null) {
      userIdBySession.put(sessionId, userId);
    }
  }

  public Integer userIdOf(String sessionId) {
    return sessionId == null ? null : userIdBySession.get(sessionId);
  }

  @EventListener
  public void onDisconnect(SessionDisconnectEvent event) {
    userIdBySession.remove(event.getSessionId());
  }
}
