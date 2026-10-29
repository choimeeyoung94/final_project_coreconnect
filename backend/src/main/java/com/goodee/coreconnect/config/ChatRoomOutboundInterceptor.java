package com.goodee.coreconnect.config;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 서버가 구독자에게 채팅방 메시지를 내보내기 직전 참여자 확인 (clientOutboundChannel)
 *
 * - SimpleBroker는 구독할 때 한 번만 등록하고, 이후 방을 나가도 그 구독을 지우지 않음
 *   → 다른 탭에 남은 구독으로 나간 방의 새 메시지가 계속 전달됐음
 * - 그래서 /topic/chat.room.{roomId} 메시지를 세션마다 내보낼 때, 그 세션 사용자가 지금도 참여자인지 확인하고
 *   아니면 null을 돌려 그 세션으로만 보내지 않음 (다른 참여자에게는 그대로 전달)
 * - 확인은 ChatRoomMemberCache(방 → 참여자 목록, 5초)로 함. 처음엔 연결마다 DB를 조회해서 참여자 수만큼 조회가 늘어났음
 *   (측정: 50명 방 메시지 1건당 조회 50번) → 방마다 5초에 최대 1번
 * - 서버가 여러 대일 때: 나가기를 처리한 서버는 커밋 직후 캐시를 비워 바로 막히고,
 *   다른 서버는 그 서버 캐시가 끝날 때(최대 5초)까지 이전 목록을 씀
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ChatRoomOutboundInterceptor implements ChannelInterceptor {

  private static final Pattern CHAT_ROOM_TOPIC = Pattern.compile("^/topic/chat\\.room\\.(\\d+)(\\..+)?$");

  private final ChatRoomMemberCache memberCache;
  private final StompSessionUserRegistry sessionUserRegistry;

  @Override
  public Message<?> preSend(Message<?> message, MessageChannel channel) {
    SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.wrap(message);
    if (accessor.getMessageType() != SimpMessageType.MESSAGE || accessor.getDestination() == null) {
      return message;
    }
    Matcher matcher = CHAT_ROOM_TOPIC.matcher(accessor.getDestination());
    if (!matcher.matches()) {
      return message;
    }

    Integer roomId = Integer.valueOf(matcher.group(1));
    Integer userId = sessionUserRegistry.userIdOf(accessor.getSessionId());
    if (userId == null || !memberCache.isMember(roomId, userId)) {
      log.debug("[STOMP] 참여자가 아닌 세션으로 전달 안 함 - roomId: {}, userId: {}", roomId, userId);
      return null;
    }
    return message;
  }
}
