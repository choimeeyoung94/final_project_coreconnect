package com.goodee.coreconnect.common.exception;

/**
 * 외부 서비스 호출 실패 시 발생하는 예외
 * (예: SendGrid 이메일 전송 실패, AWS S3 연결 실패 등)
 */
public class ExternalServiceException extends RuntimeException {

    public ExternalServiceException(String message) {
        super(message);
    }

    public ExternalServiceException(String message, Throwable cause) {
        super(message, cause);
    }

    public ExternalServiceException(Throwable cause) {
        super("외부 서비스 연동 중 오류가 발생했습니다.", cause);
    }
}