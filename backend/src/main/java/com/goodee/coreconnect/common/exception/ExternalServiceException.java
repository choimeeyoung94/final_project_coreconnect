package com.goodee.coreconnect.common.exception;

import org.springframework.http.HttpStatus;

/**
 * 🌐 외부 서비스(API) 호출 실패 시 발생하는 예외
 *
 * Unchecked Exception - 502 Bad Gateway
 *
 * ⚠️ 이 예외는 복구 가능한 상황이므로 재시도 로직과 함께 사용해야 함
 *
 * 사용 예시:
 * <pre>
 * try {
 *     emailService.sendEmail(to, subject, body);
 * } catch (Exception e) {
 *     throw new ExternalServiceException("이메일 전송 실패", "SENDGRID", e);
 * }
 * </pre>
 */
public class ExternalServiceException extends BusinessException {

    private final String serviceName;

    public ExternalServiceException(String message, String serviceName) {
        super(message, HttpStatus.BAD_GATEWAY);
        this.serviceName = serviceName;
    }

    public ExternalServiceException(String message, String serviceName, Throwable cause) {
        super(
            String.format("%s (서비스: %s)", message, serviceName),
            HttpStatus.BAD_GATEWAY,
            cause
        );
        this.serviceName = serviceName;
    }

    public String getServiceName() {
        return serviceName;
    }
}
