package com.goodee.coreconnect.common.notification.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * WebSocketDeliveryService (알림 WebSocket 실시간 전송, 서버 여러 대 지원)
 *
 * - userId별로 여러 WebSocketSession을 관리(동시 다중 접속 지원). 연결은 그 연결이 붙은 서버의 메모리에만 있음
 * - sendToUser / sendToUsers는 직접 보내지 않고 Redis 채널(notification:pubsub)에 발행
 *   → 모든 서버가 받아서 자기 서버에 연결이 있는 사용자에게만 보냄 (보낸 서버 자신도 같은 길로 받으므로 한 번만 감)
 * - Redis 발행이 실패하면 이 서버에 붙은 연결에만 보냄 (알림이 아예 사라지지 않게)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WebSocketDeliveryService implements MessageListener {

    /** 서버끼리 알림을 나누는 Redis 채널 */
    public static final String CHANNEL = "notification:pubsub";

    /** userId별로 여러 세션 동시 관리 */
    private final Map<Integer, CopyOnWriteArraySet<WebSocketSession>> sessions = new ConcurrentHashMap<>();

    /** Jackson ObjectMapper (JSR310 모듈등록, 직렬화 오류 방지) */
    private final ObjectMapper objectMapper;

    private final StringRedisTemplate redisTemplate;
    private final RedisMessageListenerContainer redisListenerContainer;

    /** 비동기 전송용 작업 스레드풀 (I/O blocking 방지) */
    private final ExecutorService sendExecutor = Executors.newFixedThreadPool(Math.max(4, Runtime.getRuntime().availableProcessors() * 2));

    /** Redis로 서버끼리 주고받는 내용: 받는 사람 id 목록 + 보낼 글(이미 JSON으로 만든 문자열) */
    record Relay(List<Integer> userIds, String text) {}

    @PostConstruct
    public void init() {
        redisListenerContainer.addMessageListener(this, new ChannelTopic(CHANNEL));
        log.info("[WebSocketDeliveryService] Redis 채널 '{}' 구독 등록", CHANNEL);
    }

    /** 특정 사용자(userId)의 세션을 등록. (탭/장치 추가 지원) */
    public void registerSession(Integer userId, WebSocketSession session) {
        if (userId != null && session != null) {
            sessions.computeIfAbsent(userId, k -> new CopyOnWriteArraySet<>()).add(session);
            log.info("[WebSocketDeliveryService] 세션 등록: userId={}, sessionId={}", userId, session.getId());
        }
    }

    /** 특정 사용자(userId)의 세션을 해제. */
    public void unregisterSession(Integer userId, WebSocketSession session) {
        if (userId != null && session != null) {
            Set<WebSocketSession> set = sessions.get(userId);
            if (set != null) {
                set.remove(session);
                log.info("[WebSocketDeliveryService] 세션 해제: userId={}, sessionId={}", userId, session.getId());
                if (set.isEmpty()) {
                    sessions.remove(userId);
                }
            }
        }
    }

    /**
     * 단일 사용자(userId)에게 실시간 메시지 전송 (어느 서버에 붙어 있든)
     * @return Redis 발행(또는 실패 시 이 서버 전송)을 시작했으면 true. 실제로 받았는지는 다른 서버에서 정해지므로 알 수 없음
     */
    public boolean sendToUser(Integer userId, Object payload) {
        if (userId == null) return false;
        return publish(List.of(userId), payload);
    }

    /** 여러 사용자(userId 리스트)에게 동일 payload 실시간 전송 (Redis 발행 1번) */
    public void sendToUsers(List<Integer> userIds, Object payload) {
        if (userIds == null || userIds.isEmpty() || payload == null) return;
        publish(userIds, payload);
    }

    private boolean publish(List<Integer> userIds, Object payload) {
        final String text;
        try {
            text = objectMapper.writeValueAsString(payload);
        } catch (IOException e) {
            log.warn("[WebSocketDeliveryService] 메시지 직렬화 오류: userIds={}, error={}", userIds, e.getMessage());
            return false;
        }
        try {
            redisTemplate.convertAndSend(CHANNEL, objectMapper.writeValueAsString(new Relay(userIds, text)));
            return true;
        } catch (Exception e) {
            log.warn("[WebSocketDeliveryService] Redis 발행 실패 → 이 서버 연결에만 전송: userIds={}, error={}", userIds, e.getMessage());
            userIds.forEach(uid -> deliverLocal(uid, text));
            return true;
        }
    }

    /** Redis에서 받은 알림: 이 서버에 연결이 있는 사용자에게만 보냄 */
    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            Relay relay = objectMapper.readValue(new String(message.getBody(), StandardCharsets.UTF_8), Relay.class);
            if (relay.userIds() == null || relay.text() == null) return;
            relay.userIds().forEach(uid -> deliverLocal(uid, relay.text()));
        } catch (Exception e) {
            log.warn("[WebSocketDeliveryService] Redis 알림 처리 오류: {}", e.getMessage());
        }
    }

    /** 이 서버에 붙은 그 사용자의 모든 세션에 비동기 전송. 이 서버에 연결이 없으면 아무것도 안 함 */
    private void deliverLocal(Integer userId, String text) {
        Set<WebSocketSession> set = sessions.get(userId);
        if (set == null || set.isEmpty()) {
            return; // 다른 서버에 붙어 있거나 접속 안 함 (DB 알림은 남아 있음)
        }
        TextMessage msg = new TextMessage(text);
        for (WebSocketSession s : set) {
            sendExecutor.execute(() -> {
                if (s.isOpen()) {
                    try {
                        s.sendMessage(msg);
                        log.debug("[WebSocketDeliveryService] 메시지 전송 성공: userId={}, sessionId={}", userId, s.getId());
                    } catch (IOException e) {
                        log.warn("[WebSocketDeliveryService] 메시지 전송 실패: userId={}, sessionId={}, err={}", userId, s.getId(), e.getMessage());
                        unregisterSession(userId, s);
                    }
                }
            });
        }
    }

    /** 모든 세션 강제 종료 (테스트/서버 다운시) */
    public void closeAll() {
        for (Map.Entry<Integer, CopyOnWriteArraySet<WebSocketSession>> entry : sessions.entrySet()) {
            for (WebSocketSession s : entry.getValue()) {
                try {
                    if (s.isOpen()) s.close();
                } catch (IOException ignore) {}
            }
        }
        sessions.clear();
    }
}
