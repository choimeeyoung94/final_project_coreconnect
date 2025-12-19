package com.goodee.coreconnect.chat.event;

public class MessageReadEvent {
    private final Long userId;
    private final Long roomId;
    private final Long messageId;

    public MessageReadEvent(Long userId, Long roomId, Long messageId) {
        this.userId = userId;
        this.roomId = roomId;
        this.messageId = messageId;
    }

    public Long getUserId() {
        return userId;
    }

    public Long getRoomId() {
        return roomId;
    }

    public Long getMessageId() {
        return messageId;
    }
}

