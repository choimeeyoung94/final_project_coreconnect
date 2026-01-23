package com.goodee.coreconnect.chat.pubsub;

import jakarta.annotation.PostConstruct;

import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatPubSubSubscriber implements MessageListener {

    private final RedisMessageListenerContainer redisListenerContainer;
    private final RedisTemplate<String, Object> redisTemplate;
    private final SimpMessagingTemplate messagingTemplate;

    @PostConstruct
    public void init() {
        redisListenerContainer.addMessageListener(this, new ChannelTopic(ChatPubSubService.CHANNEL));
        log.info("[ChatPubSubSubscriber] Redis pub/sub subscribed - channel: {}", ChatPubSubService.CHANNEL);
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            Object deserialized = redisTemplate.getValueSerializer().deserialize(message.getBody());
            if (!(deserialized instanceof ChatPubSubMessage)) {
                log.warn("[ChatPubSubSubscriber] unexpected payload type: {}", deserialized != null ? deserialized.getClass() : "null");
                return;
            }

            ChatPubSubMessage pubSubMessage = (ChatPubSubMessage) deserialized;
            if (pubSubMessage.getTopic() == null || pubSubMessage.getPayload() == null) {
                log.warn("[ChatPubSubSubscriber] invalid message - topic or payload is null");
                return;
            }

            messagingTemplate.convertAndSend(pubSubMessage.getTopic(), pubSubMessage.getPayload());
            log.debug("[ChatPubSubSubscriber] delivered - topic: {}", pubSubMessage.getTopic());
        } catch (Exception e) {
            log.warn("[ChatPubSubSubscriber] message handling failed: {}", e.getMessage(), e);
        }
    }
}
