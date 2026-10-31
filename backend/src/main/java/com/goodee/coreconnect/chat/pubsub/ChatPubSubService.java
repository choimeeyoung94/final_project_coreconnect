package com.goodee.coreconnect.chat.pubsub;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.goodee.coreconnect.config.RedisGuard;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatPubSubService {

    public static final String CHANNEL = "chat:pubsub";

    private final RedisTemplate<String, Object> redisTemplate;
    private final SimpMessagingTemplate messagingTemplate;
    private final RedisGuard redisGuard;

    /**
     * Publish chat payload to Redis so all nodes broadcast locally.
     * Falls back to local send if Redis publish fails.
     * 트랜잭션 안에서 호출되면 커밋 뒤에 보낸다. 받은 쪽이 바로 조회해도 저장된 값을 보도록 하기 위함이고, 롤백되면 보내지 않는다.
     */
    public void publish(String topic, Object payload) {
        if (topic == null || payload == null) {
            log.warn("[ChatPubSubService] publish skipped - topic or payload is null");
            return;
        }

        if (TransactionSynchronizationManager.isSynchronizationActive()
                && TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    send(topic, payload);
                }
            });
            return;
        }
        send(topic, payload);
    }

    private void send(String topic, Object payload) {
        if (!redisGuard.available()) {
            sendLocal(topic, payload);
            return;
        }

        ChatPubSubMessage message = new ChatPubSubMessage(topic, payload);
        try {
            redisTemplate.convertAndSend(CHANNEL, message);
            log.debug("[ChatPubSubService] published - topic: {}", topic);
        } catch (Exception e) {
            redisGuard.failed();
            log.warn("[ChatPubSubService] publish failed, fallback to local send - topic: {}, error: {}", topic, e.getMessage());
            sendLocal(topic, payload);
        }
    }

    private void sendLocal(String topic, Object payload) {
        try {
            messagingTemplate.convertAndSend(topic, payload);
        } catch (Exception ex) {
            log.error("[ChatPubSubService] local send failed - topic: {}, error: {}", topic, ex.getMessage(), ex);
        }
    }
}
