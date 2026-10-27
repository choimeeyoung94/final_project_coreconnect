package com.goodee.coreconnect.common.notification.event;

import java.util.Collections;
import java.util.List;

import com.goodee.coreconnect.common.notification.enums.NotificationType;

/**
 * "알림을 보내 달라"는 요청 이벤트
 *
 * 서비스는 알림을 직접 저장·전송하지 않고 이 이벤트만 발행함.
 * 본래 작업의 트랜잭션이 커밋된 뒤에만 NotificationEventListener가 실제 알림을 처리하므로,
 * 본래 작업이 롤백되면 알림도 생기지 않음 (유령 알림 방지).
 *
 * 필드는 NotificationService.sendNotification / sendNotificationToUsers의 인자와 같음.
 */
public record NotificationRequestedEvent(
    boolean single,
    List<Integer> recipientIds,
    NotificationType type,
    String message,
    Integer chatId,
    Integer roomId,
    Integer senderId,
    String senderName,
    Integer boardId,
    Integer scheduleId
) {

  /** NotificationService.sendNotification(단건)과 같은 인자 */
  public static NotificationRequestedEvent single(Integer recipientId, NotificationType type, String message,
                                                  Integer chatId, Integer roomId,
                                                  Integer senderId, String senderName, Integer scheduleId) {
    return new NotificationRequestedEvent(true, Collections.singletonList(recipientId), type, message,
        chatId, roomId, senderId, senderName, null, scheduleId);
  }

  /** NotificationService.sendNotificationToUsers(다건)과 같은 인자 */
  public static NotificationRequestedEvent toUsers(List<Integer> recipientIds, NotificationType type, String message,
                                                   Integer chatId, Integer roomId,
                                                   Integer senderId, String senderName,
                                                   Integer boardId, Integer scheduleId) {
    return new NotificationRequestedEvent(false, recipientIds, type, message,
        chatId, roomId, senderId, senderName, boardId, scheduleId);
  }
}
