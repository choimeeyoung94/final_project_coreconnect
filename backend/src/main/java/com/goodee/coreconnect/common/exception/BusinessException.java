package com.goodee.coreconnect.common.exception;

import org.springframework.http.HttpStatus;

import lombok.Getter;

/**
 * 🎯 비즈니스 로직 예외의 기본 클래스
 *
 * Unchecked Exception (RuntimeException 상속)
 * - 비즈니스 규칙 위반 시 발생
 * - GlobalExceptionHandler에서 일괄 처리
 *
 * 예시:
 * - 재고 부족
 * - 권한 없음
 * - 중복 데이터
 * - 잘못된 상태 전환
 */
@Getter
public class BusinessException extends RuntimeException {

    private final HttpStatus status;
    private final String errorCode;

    public BusinessException(String message) {
        this(message, HttpStatus.BAD_REQUEST);
    }

    public BusinessException(String message, HttpStatus status) {
        this(message, status, null);
    }

    public BusinessException(String message, HttpStatus status, String errorCode) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
    }

    public BusinessException(String message, Throwable cause) {
        this(message, HttpStatus.BAD_REQUEST, cause);
    }

    public BusinessException(String message, HttpStatus status, Throwable cause) {
        super(message, cause);
        this.status = status;
        this.errorCode = null;
    }
}
