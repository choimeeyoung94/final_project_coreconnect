package com.goodee.coreconnect.chat.event;

import java.time.LocalDateTime;

import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.goodee.coreconnect.chat.repository.ChatMessageReadStatusRepository;
import com.goodee.coreconnect.chat.repository.ChatRepository;
import com.goodee.coreconnect.chat.entity.Chat;
import com.goodee.coreconnect.common.notification.enums.NotificationType;
import com.goodee.coreconnect.common.notification.service.NotificationService;

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
    private final ChatRepository chatRepository;
    private final NotificationService notificationService;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * 메시지 읽음 이벤트 처리 (비동기)
     * 1. 읽음 상태 업데이트
     * 2. unreadCount 재계산 및 브로드캐스트
     * 3. 알림 전송 (필요시)
     */
    @Async("asyncTaskExecutor")
    @EventListener
    @Transactional
    public void handle(MessageReadEvent event) {
        try {
            log.info("[MessageReadEventListener] 메시지 읽음 처리 시작 - userId: {}, roomId: {}, messageId: {}", 
                    event.getUserId(), event.getRoomId(), event.getMessageId());

            // 1. 읽음 상태 업데이트
            int updatedCount = readStatusRepo.updateReadStatus(
                    event.getUserId(), 
                    event.getMessageId(), 
                    LocalDateTime.now()
            );

            if (updatedCount > 0) {
                log.info("[MessageReadEventListener] 읽음 상태 업데이트 완료 - userId: {}, messageId: {}, updatedRows: {}", 
                        event.getUserId(), event.getMessageId(), updatedCount);

                // 2. unreadCount 재계산
                int newUnreadCount = readStatusRepo.countUnreadByChatId(event.getMessageId());
                log.info("[MessageReadEventListener] unreadCount 재계산 완료 - messageId: {}, newUnreadCount: {}", 
                        event.getMessageId(), newUnreadCount);

                // 3. Chat 엔티티의 unreadCount 업데이트
                chatRepository.findById(event.getMessageId()).ifPresent(chat -> {
                    chat.updateUnreadCount(newUnreadCount);
                    chatRepository.save(chat);
                    log.info("[MessageReadEventListener] Chat 엔티티 unreadCount 업데이트 완료 - messageId: {}, unreadCount: {}", 
                            event.getMessageId(), newUnreadCount);
                });

                // 4. 실시간으로 unreadCount 변경 사항 브로드캐스트
                String topic = "/topic/chat.room." + event.getRoomId() + ".unreadCount";
                messagingTemplate.convertAndSend(topic, java.util.Map.of(
                        "messageId", event.getMessageId(),
                        "unreadCount", newUnreadCount,
                        "readBy", event.getUserId()
                ));
                log.info("[MessageReadEventListener] unreadCount 브로드캐스트 완료 - topic: {}, messageId: {}, unreadCount: {}", 
                        topic, event.getMessageId(), newUnreadCount);

                // 5. 알림 전송 (선택적 - 읽음 확인 알림이 필요한 경우)
                // 예: "A님이 메시지를 읽었습니다" 같은 알림이 필요한 경우
                // 현재는 주석 처리 (필요시 활성화)
                /*
                chatRepository.findById(event.getMessageId()).ifPresent(chat -> {
                    if (chat.getSender() != null && !chat.getSender().getId().equals(event.getUserId())) {
                        try {
                            notificationService.sendNotification(
                                    chat.getSender().getId(),
                                    NotificationType.CHAT,
                                    "메시지가 읽혔습니다",
                                    event.getMessageId(),
                                    event.getRoomId(),
                                    event.getUserId(),
                                    null, // senderName
                                    null  // scheduleId
                            );
                            log.info("[MessageReadEventListener] 읽음 알림 전송 완료 - senderId: {}, messageId: {}", 
                                    chat.getSender().getId(), event.getMessageId());
                        } catch (Exception e) {
                            log.warn("[MessageReadEventListener] 읽음 알림 전송 실패: {}", e.getMessage());
                        }
                    }
                });
                */

            } else {
                log.debug("[MessageReadEventListener] 이미 읽음 처리된 메시지이거나 업데이트할 row가 없습니다 - userId: {}, messageId: {}", 
                        event.getUserId(), event.getMessageId());
            }

        } catch (Exception e) {
            log.error("[MessageReadEventListener] MessageReadEvent handling failed - userId: {}, roomId: {}, messageId: {}, error: {}", 
                    event.getUserId(), event.getRoomId(), event.getMessageId(), e.getMessage(), e);
        }
    }
}
