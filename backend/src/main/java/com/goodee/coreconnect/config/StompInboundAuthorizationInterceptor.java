package com.goodee.coreconnect.config;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.stereotype.Component;

import com.goodee.coreconnect.chat.repository.ChatRoomUserRepository;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 클라이언트가 보내는 STOMP 프레임 권한 검사 (clientInboundChannel)
 *
 * - CONNECT: 세션 id ↔ 로그인 사용자 id를 StompSessionUserRegistry에 등록 (내보낼 때 참여자 확인용)
 * - SUBSCRIBE: /topic/chat.room.{roomId}(및 .unreadCount 같은 하위 토픽)는 그 방 참여자만,
 *   와일드카드(/topic/** , /topic/chat.room.* 등)는 SimpleBroker가 여러 방을 한꺼번에 매칭하므로 거부
 * - SEND: 브로커 경로(/topic, /queue, /user)로 직접 보내면 컨트롤러(@MessageMapping)의 검증·저장 없이
 *   구독자에게 그대로 전달되므로 거부. 클라이언트는 /app/... 으로만 보낼 수 있음
 * - 거부는 예외 대신 null을 돌려 그 프레임만 버림 → 스프링이 ERROR 프레임을 보내고 연결을 닫지 않음
 *   (StompSubProtocolHandler는 send()가 예외를 던질 때만 handleError → sendErrorMessage → close(1002))
 * - 로그인 사용자는 핸드셰이크 때 WebSocketAuthInterceptor가 세션에 넣은 wsUserEmail로 판단
 * - WebSocketConfig가 이 빈을 주입받으므로, 메시징 빈을 쓰는 ChatRoomService 대신 Repository를 직접 써서 순환 의존을 피함
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StompInboundAuthorizationInterceptor implements ChannelInterceptor {

  private static final Pattern CHAT_ROOM_TOPIC = Pattern.compile("^/topic/chat\\.room\\.(\\d+)(\\..+)?$");
  private static final String[] BROKER_PREFIXES = {"/topic", "/queue", "/user"};

  private final ChatRoomUserRepository chatRoomUserRepository;
  private final UserRepository userRepository;
  private final StompSessionUserRegistry sessionUserRegistry;

  @Override
  public Message<?> preSend(Message<?> message, MessageChannel channel) {
    StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
    StompCommand command = accessor.getCommand();
    if (command == StompCommand.CONNECT) {
      sessionUserRegistry.register(accessor.getSessionId(), loginUserId(accessor.getSessionAttributes()));
      return message;
    }
    if (command == StompCommand.SEND) {
      return checkSend(message, accessor);
    }
    if (command == StompCommand.SUBSCRIBE) {
      return checkSubscribe(message, accessor);
    }
    return message;
  }

  private Message<?> checkSend(Message<?> message, StompHeaderAccessor accessor) {
    String destination = accessor.getDestination();
    if (destination != null && startsWithBrokerPrefix(destination)) {
      log.warn("[STOMP] 브로커 경로로 직접 SEND 거부 - email: {}, destination: {}", loginEmail(accessor), destination);
      return null;
    }
    return message;
  }

  private Message<?> checkSubscribe(Message<?> message, StompHeaderAccessor accessor) {
    String destination = accessor.getDestination();
    if (destination == null) {
      return message;
    }
    if (destination.contains("*") || destination.contains("{") || destination.contains("?")) {
      log.warn("[STOMP] 와일드카드 구독 거부 - email: {}, destination: {}", loginEmail(accessor), destination);
      return null;
    }

    Matcher matcher = CHAT_ROOM_TOPIC.matcher(destination);
    if (!matcher.matches()) {
      return message;
    }

    Integer roomId = Integer.valueOf(matcher.group(1));
    Integer userId = loginUserId(accessor.getSessionAttributes());
    if (userId == null || !chatRoomUserRepository.existsByChatRoomIdAndUserId(roomId, userId)) {
      log.warn("[STOMP] 참여자가 아닌 구독 거부 - email: {}, roomId: {}", loginEmail(accessor), roomId);
      return null;
    }
    return message;
  }

  private static boolean startsWithBrokerPrefix(String destination) {
    for (String prefix : BROKER_PREFIXES) {
      if (destination.equals(prefix) || destination.startsWith(prefix + "/")) {
        return true;
      }
    }
    return false;
  }

  private static String loginEmail(StompHeaderAccessor accessor) {
    Map<String, Object> attributes = accessor.getSessionAttributes();
    return attributes == null ? null : (String) attributes.get("wsUserEmail");
  }

  private Integer loginUserId(Map<String, Object> sessionAttributes) {
    if (sessionAttributes == null || !(sessionAttributes.get("wsUserEmail") instanceof String email)) {
      return null;
    }
    return userRepository.findByEmail(email).map(User::getId).orElse(null);
  }
}
