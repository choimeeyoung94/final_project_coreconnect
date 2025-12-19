package com.goodee.coreconnect.chat.dto.response;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 채팅방 목록 조회 시 최신 메시지만 담는 슬림 DTO
 * 필요한 필드만 노출하여 페이로드를 최소화한다.
 */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatRoomLatestMessageDTO {
    private Integer roomId;
    private String roomName;
    private Integer lastMessageId;
    private String lastMessageContent;
    private String lastSenderName;
    private LocalDateTime lastMessageTime;
}

