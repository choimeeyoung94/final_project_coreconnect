package com.goodee.coreconnect.common.notification.event;

import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.goodee.coreconnect.common.notification.service.NotificationService;
import com.goodee.coreconnect.common.notification.service.WebSocketDeliveryService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 알림 이벤트 리스너 — 본래 작업의 트랜잭션이 "커밋된 뒤"에만 알림을 저장·전송함
 *
 * - AFTER_COMMIT: 커밋에 성공했을 때만 실행. 롤백되면 실행되지 않음
 * - fallbackExecution = true: 트랜잭션 밖에서 발행된 이벤트는 바로 실행 (기존 동작 유지)
 * - 커밋 후에는 기존 트랜잭션에 참여할 수 없으므로, 저장은 NotificationService의 REQUIRES_NEW 트랜잭션에서 함
 *
 * 주의: 다른 코드의 afterCommit 콜백 안(이미 커밋이 끝난 뒤의 처리 도중)에서 이 이벤트를 발행하면
 * 새 커밋 예약이 실행되지 않아 이벤트가 조용히 사라질 수 있음. 그런 곳에서는 NotificationService를 직접 호출할 것
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationEventListener {

  private final NotificationService notificationService;
  private final WebSocketDeliveryService webSocketDeliveryService;

  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
  public void handle(NotificationRequestedEvent event) {
    try {
      if (event.single()) {
        notificationService.sendNotification(event.recipientIds().get(0), event.type(), event.message(),
            event.chatId(), event.roomId(), event.senderId(), event.senderName(), event.scheduleId());
      } else {
        notificationService.sendNotificationToUsers(event.recipientIds(), event.type(), event.message(),
            event.chatId(), event.roomId(), event.senderId(), event.senderName(), event.boardId(), event.scheduleId());
      }
    } catch (Exception e) {
      // 본래 작업은 이미 커밋됨 → 알림 실패가 사용자 요청을 실패로 만들지 않도록 로그만 남김 (재시도는 Outbox 단계에서)
      log.error("[NotificationEventListener] 알림 처리 실패: type={}, recipients={}", event.type(), event.recipientIds(), e);
    }
  }

  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
  public void handle(NotificationPushEvent event) {
    try {
      webSocketDeliveryService.sendToUser(event.recipientId(), event.payload());
    } catch (Exception e) {
      log.error("[NotificationEventListener] 화면 전송 실패: recipientId={}", event.recipientId(), e);
    }
  }
}
