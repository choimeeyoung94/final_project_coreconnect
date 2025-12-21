package com.goodee.coreconnect.chat.service;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import com.goodee.coreconnect.chat.event.MessageReadEvent;

import lombok.RequiredArgsConstructor;

/**
 * 메시지 조회 후 응답은 바로 반환하고,
 * 읽음 처리/알림 카운트 등 부가 작업은 이벤트로 발행해 비동기로 처리한다.
 */
@Service
@RequiredArgsConstructor
public class ChatService {

    private final ApplicationEventPublisher publisher;

    /**
     * 메시지 읽음 처리 (비동기 이벤트 발행)
     * @param userId 사용자 ID
     * @param roomId 채팅방 ID
     * @param messageId 메시지 ID
     */
    public void markAsRead(Integer userId, Integer roomId, Integer messageId) {
        // 최소 로직만 수행하고 이벤트 발행
        publisher.publishEvent(new MessageReadEvent(userId, roomId, messageId));
    }
}

