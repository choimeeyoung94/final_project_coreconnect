package com.goodee.coreconnect.config;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;
import org.springframework.web.socket.messaging.SessionUnsubscribeEvent;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 채팅방을 지금 보고 있는 사용자 명단 (파일 메시지 알림을 보낼지 판단할 때 사용)
 *
 * - 읽음 판단에는 쓰지 않는다. 서버가 죽은 직후에는 끊긴 사용자가 남아 있을 수 있어서, 읽음은 화면이 받은 뒤 요청한다
 * - 프론트는 방을 열 때 /topic/chat.room.{roomId}를 구독하고 닫을 때 해제한다. 구독 중이면 보고 있는 것으로 본다
 * - 구독 이벤트는 인바운드 인터셉터를 통과한 구독에만 발생하므로 방 참여자만 등록된다
 * - 서버 여러 대가 같은 명단을 보도록 Redis Sorted Set에 저장한다 (값: 사용자|서버|세션|구독, 점수: 마지막 확인 시각)
 * - 서버가 죽으면 해제 이벤트가 오지 않는다. 각 서버가 자기 구독의 시각을 주기적으로 갱신하고, 오래된 값은 명단에서 뺀다
 * - Redis에 쓸 수 없으면 이 서버의 구독만으로 답한다
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ChatRoomViewerRegistry {

  static final String KEY_PREFIX = "chat:room:viewers:";
  static final long STALE_MILLIS = Duration.ofSeconds(90).toMillis();
  private static final long REFRESH_MILLIS = 30_000;
  private static final Duration KEY_TTL = Duration.ofMinutes(5);
  private static final Pattern ROOM_TOPIC = Pattern.compile("^/topic/chat\\.room\\.(\\d+)$");

  private final StompSessionUserRegistry sessionUserRegistry;
  private final StringRedisTemplate redisTemplate;
  private final RedisGuard redisGuard;

  private final String serverId = UUID.randomUUID().toString();
  private final Map<String, Viewer> localViewers = new ConcurrentHashMap<>();

  private record Viewer(Integer roomId, String member) {
  }

  public List<Integer> viewerIds(Integer roomId) {
    if (!redisGuard.available()) {
      return localViewerIds(roomId);
    }
    try {
      long oldestAllowed = System.currentTimeMillis() - STALE_MILLIS;
      Set<String> members = redisTemplate.opsForZSet()
          .rangeByScore(key(roomId), oldestAllowed, Double.MAX_VALUE);
      if (members == null) {
        return localViewerIds(roomId);
      }
      return members.stream().map(ChatRoomViewerRegistry::userIdOf).distinct().toList();
    } catch (RuntimeException e) {
      redisGuard.failed();
      log.warn("[ChatRoomViewerRegistry] Redis 조회 실패, 이 서버 명단 사용 - roomId: {}, error: {}", roomId, e.getMessage());
      return localViewerIds(roomId);
    }
  }

  @EventListener
  public void onSubscribe(SessionSubscribeEvent event) {
    StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
    String destination = accessor.getDestination();
    Matcher matcher = destination == null ? null : ROOM_TOPIC.matcher(destination);
    Integer userId = sessionUserRegistry.userIdOf(accessor.getSessionId());
    if (matcher == null || !matcher.matches() || userId == null) {
      return;
    }

    Integer roomId = Integer.valueOf(matcher.group(1));
    String subscription = subscription(accessor.getSessionId(), accessor.getSubscriptionId());
    Viewer viewer = new Viewer(roomId, userId + "|" + serverId + "|" + subscription);
    localViewers.put(subscription, viewer);
    write(viewer);
  }

  @EventListener
  public void onUnsubscribe(SessionUnsubscribeEvent event) {
    StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
    remove(subscription(accessor.getSessionId(), accessor.getSubscriptionId()));
  }

  @EventListener
  public void onDisconnect(SessionDisconnectEvent event) {
    String prefix = event.getSessionId() + "/";
    localViewers.keySet().stream()
        .filter(subscription -> subscription.startsWith(prefix))
        .toList()
        .forEach(this::remove);
  }

  /** 이 서버가 살아 있는 동안 구독의 마지막 확인 시각을 갱신한다 */
  @Scheduled(fixedDelay = REFRESH_MILLIS)
  public void refresh() {
    localViewers.values().forEach(this::write);
  }

  private void write(Viewer viewer) {
    if (!redisGuard.available()) {
      return;
    }
    try {
      String key = key(viewer.roomId());
      long now = System.currentTimeMillis();
      redisTemplate.opsForZSet().add(key, viewer.member(), now);
      redisTemplate.opsForZSet().removeRangeByScore(key, 0, now - STALE_MILLIS);
      redisTemplate.expire(key, KEY_TTL);
    } catch (RuntimeException e) {
      redisGuard.failed();
      log.warn("[ChatRoomViewerRegistry] Redis 기록 실패 - roomId: {}, error: {}", viewer.roomId(), e.getMessage());
    }
  }

  private void remove(String subscription) {
    Viewer viewer = localViewers.remove(subscription);
    if (viewer == null) {
      return;
    }
    if (!redisGuard.available()) {
      return;
    }
    try {
      redisTemplate.opsForZSet().remove(key(viewer.roomId()), viewer.member());
    } catch (RuntimeException e) {
      redisGuard.failed();
      log.warn("[ChatRoomViewerRegistry] Redis 삭제 실패 - roomId: {}, error: {}", viewer.roomId(), e.getMessage());
    }
  }

  private List<Integer> localViewerIds(Integer roomId) {
    return localViewers.values().stream()
        .filter(viewer -> Objects.equals(viewer.roomId(), roomId))
        .map(viewer -> userIdOf(viewer.member()))
        .distinct()
        .toList();
  }

  private static Integer userIdOf(String member) {
    return Integer.valueOf(member.substring(0, member.indexOf('|')));
  }

  private static String key(Integer roomId) {
    return KEY_PREFIX + roomId;
  }

  private static String subscription(String sessionId, String subscriptionId) {
    return sessionId + "/" + subscriptionId;
  }
}
