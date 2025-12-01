package com.goodee.coreconnect.common.exception;

/**
 * 비즈니스 로직 위반 시 발생하는 예외
 * (예: 이미 처리된 결재 문서, 중복된 출근 기록 등)
 */
public class BusinessException extends RuntimeException {

    public BusinessException(String message) {
        super(message);
    }

    public BusinessException(String message, Throwable cause) {
        super(message, cause);
    }
}
