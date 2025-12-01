package com.goodee.coreconnect.common.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;

/**
 * 운영 환경에서 심각한 오류 발생 시 개발팀에 알림을 보내는 서비스
 * (Slack, 이메일, SMS 등)
 */
@Slf4j
@Service
public class ErrorNotificationService {

    @Value("${spring.profiles.active:dev}")
    private String activeProfile;

    @Value("${error.notification.enabled:false}")
    private boolean notificationEnabled;

    /**
     * 500 에러 발생 시 알림 전송
     *
     * @param errorType 예외 타입
     * @param errorMessage 에러 메시지
     * @param requestURI 요청 URI
     * @param stackTrace 스택 트레이스
     */
    public void sendErrorNotification(String errorType, String errorMessage, String requestURI, String stackTrace) {
        // 운영 환경(prod)에서만 알림 전송
        if (!"prod".equals(activeProfile) || !notificationEnabled) {
            log.debug("[ErrorNotificationService] 알림 비활성화 또는 개발 환경 (profile: {})", activeProfile);
            return;
        }

        try {
            // 여기에 실제 알림 전송 로직 추가
            // 예시:
            // 1. Slack Webhook
            // 2. SendGrid 이메일
            // 3. SMS (Twilio, AWS SNS 등)

            String notificationMessage = String.format(
                "🚨 [운영 서버 500 에러 발생]\n" +
                "• 예외 타입: %s\n" +
                "• 에러 메시지: %s\n" +
                "• 요청 URI: %s\n" +
                "• 시간: %s\n" +
                "• 스택 트레이스: %s",
                errorType,
                errorMessage,
                requestURI,
                java.time.LocalDateTime.now(),
                stackTrace != null ? stackTrace.substring(0, Math.min(stackTrace.length(), 500)) : "N/A"
            );

            log.info("[ErrorNotificationService] 알림 전송: {}", notificationMessage);

            // TODO: 실제 알림 전송 코드 작성
            // Example: slackWebhookService.send(notificationMessage);
            // Example: emailService.sendToDevTeam(notificationMessage);

        } catch (Exception e) {
            // 알림 전송 실패 시 로그만 남기고 예외는 무시 (원래 예외 처리에 영향 없도록)
            log.error("[ErrorNotificationService] 알림 전송 실패: {}", e.getMessage());
        }
    }

    /**
     * 외부 서비스 연동 실패 시 알림 전송
     */
    public void sendExternalServiceErrorNotification(String serviceName, String errorMessage) {
        if (!"prod".equals(activeProfile) || !notificationEnabled) {
            return;
        }

        try {
            String notificationMessage = String.format(
                "⚠️  [외부 서비스 연동 오류]\n" +
                "• 서비스: %s\n" +
                "• 에러: %s\n" +
                "• 시간: %s",
                serviceName,
                errorMessage,
                java.time.LocalDateTime.now()
            );

            log.info("[ErrorNotificationService] 외부 서비스 오류 알림: {}", notificationMessage);

            // TODO: 실제 알림 전송 코드 작성

        } catch (Exception e) {
            log.error("[ErrorNotificationService] 알림 전송 실패: {}", e.getMessage());
        }
    }
}
