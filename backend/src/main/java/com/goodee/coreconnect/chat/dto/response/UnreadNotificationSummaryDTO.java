package com.goodee.coreconnect.chat.dto.response;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.goodee.coreconnect.common.entity.Notification;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
public class UnreadNotificationSummaryDTO {
	private Integer notificationId; // 최신 알림 ID
    private String message;         // 최신 알림 메시지
    private String senderName;      // 알림 보낸 사람 이름
    // ⭐ ISO 8601 형식으로 직렬화 (프론트엔드에서 한국 시간대로 파싱)
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime sentAt;   // 최신 알림 발송 시간
    private String notificationType;// 알림 타입
    private int unreadCount;        // 미읽은 알림 개수
    private String receiverName;

    public static UnreadNotificationSummaryDTO from(Notification latest, int unreadCount) {
        if (latest == null) {
            return UnreadNotificationSummaryDTO.builder()
                    .notificationId(null)
                    .message(null)
                    .senderName(null)
                    .receiverName(null) // 추가
                    .sentAt(null)
                    .notificationType(null)
                    .unreadCount(unreadCount)
                    .build();
        }
        // 로그 추가
        log.info("notificationSentAt: {}", latest.getNotificationSentAt());
        return UnreadNotificationSummaryDTO.builder()
                .notificationId(latest.getId())
                .message(latest.getNotificationMessage())
                .senderName(latest.getSender() != null ? latest.getSender().getName() : null)
                .receiverName(latest.getUser() != null ? latest.getUser().getName() : null)  
                .sentAt(latest.getNotificationSentAt())
                .notificationType(latest.getNotificationType() != null ? latest.getNotificationType().name() : null)
                .unreadCount(unreadCount)
                .build();
    }

}
