package com.goodee.coreconnect.common.notification.event;

/**
 * "화면(WebSocket)으로 알림을 보내 달라"는 요청 이벤트
 *
 * 알림 행은 본래 작업과 같은 트랜잭션에 이미 저장한 경우(예: 결재)에 사용.
 * 저장은 함께 롤백되지만 화면 전송은 되돌릴 수 없으므로, 전송만 커밋 후로 미룸.
 */
public record NotificationPushEvent(Integer recipientId, Object payload) {
}
