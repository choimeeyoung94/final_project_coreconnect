package com.goodee.coreconnect.chat.dto.response;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.goodee.coreconnect.common.entity.Notification;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UnreadNotificationListDTO {
	private Integer notificationId;
    private String message;
    private String senderName;
    private String receiverName;
    // ⭐ ISO 8601 형식으로 직렬화 (프론트엔드에서 한국 시간대로 파싱)
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime sentAt;
    private String notificationType;
    private Integer documentId; // APPROVAL 타입 알림의 경우 결재 문서 ID
    private Integer boardId; // NOTICE 타입 알림의 경우 게시글 ID
    private Integer scheduleId; // SCHEDULE 타입 알림의 경우 일정 ID
    private Integer roomId; // CHAT 타입 알림의 경우 채팅방 ID

    // 엔티티 → DTO 변환
    public static UnreadNotificationListDTO from(Notification n) {
        return UnreadNotificationListDTO.builder()
            .notificationId(n.getId())
            .message(n.getNotificationMessage())
            .senderName(n.getSender() != null ? n.getSender().getName() : null)
            .receiverName(n.getUser() != null ? n.getUser().getName() : null)
            .sentAt(n.getNotificationSentAt())
            .notificationType(n.getNotificationType() != null ? n.getNotificationType().name() : null)
            .documentId(n.getDocument() != null ? n.getDocument().getId() : null)
            .boardId(n.getBoard() != null ? n.getBoard().getId() : null)
            .scheduleId(n.getSchedule() != null ? n.getSchedule().getId() : null)
            .roomId(n.getChat() != null && n.getChat().getChatRoom() != null ? n.getChat().getChatRoom().getId() : null)
            .build();
    
	}
}
