package com.goodee.coreconnect.chat.pubsub;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatPubSubService {

    public static final String CHANNEL = "chat:pubsub";

    private final RedisTemplate<String, Object> redisTemplate;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Publish chat payload to Redis so all nodes broadcast locally.
     * Falls back to local send if Redis publish fails.
     */
    public void publish(String topic, Object payload) {
        if (topic == null || payload == null) {
            log.warn("[ChatPubSubService] publish skipped - topic or payload is null");
            return;
        }

        ChatPubSubMessage message = new ChatPubSubMessage(topic, payload);
        try {
            redisTemplate.convertAndSend(CHANNEL, message);
            log.debug("[ChatPubSubService] published - topic: {}", topic);
        } catch (Exception e) {
            log.warn("[ChatPubSubService] publish failed, fallback to local send - topic: {}, error: {}", topic, e.getMessage());
            try {
                messagingTemplate.convertAndSend(topic, payload);
            } catch (Exception ex) {
                log.error("[ChatPubSubService] local send failed - topic: {}, error: {}", topic, ex.getMessage(), ex);
            }
        }
    }
}
