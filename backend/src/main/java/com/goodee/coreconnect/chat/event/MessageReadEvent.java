package com.goodee.coreconnect.chat.event;

/**
 * 메시지 읽음 이벤트
 * 비동기 처리를 위해 이벤트 방식으로 읽음 상태를 업데이트합니다.
 */
public class MessageReadEvent {
    private final Integer userId;
    private final Integer roomId;
    private final Integer messageId;

    public MessageReadEvent(Integer userId, Integer roomId, Integer messageId) {
        this.userId = userId;
        this.roomId = roomId;
        this.messageId = messageId;
    }

    public Integer getUserId() {
        return userId;
    }

    public Integer getRoomId() {
        return roomId;
    }

    public Integer getMessageId() {
        return messageId;
    }
}

