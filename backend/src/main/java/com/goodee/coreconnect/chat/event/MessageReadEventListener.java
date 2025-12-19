package com.goodee.coreconnect.chat.event;

import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import com.goodee.coreconnect.chat.repository.ChatMessageReadStatusRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 메시지 읽음 처리/알림 카운트 감소 등 부가 작업을 비동기(@Async)로 처리하여
 * 요청 응답 지연(P95) 스파이크를 줄인다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MessageReadEventListener {

    private final ChatMessageReadStatusRepository readStatusRepo;

    @Async("asyncTaskExecutor")
    @EventListener
    public void handle(MessageReadEvent event) {
        try {
            // TODO: 읽음 상태 업데이트 메서드가 준비되면 아래 로직을 구현하세요.
            // readStatusRepo.updateReadStatus(event.getUserId(), event.getMessageId());

            // TODO: 알림/미읽음 카운트 감소가 필요하면 NotificationService를 주입해 호출하세요.
        } catch (Exception e) {
            log.warn("MessageReadEvent handling failed: {}", e.getMessage(), e);
        }
    }
}
