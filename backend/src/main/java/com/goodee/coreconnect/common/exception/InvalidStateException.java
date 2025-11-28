package com.goodee.coreconnect.common.exception;

import org.springframework.http.HttpStatus;

/**
 * ⚠️ 잘못된 상태 전환 시 발생하는 예외
 *
 * Unchecked Exception - 400 Bad Request
 *
 * 사용 예시:
 * <pre>
 * if (document.getStatus() != DocumentStatus.PENDING) {
 *     throw new InvalidStateException("대기 중인 문서만 승인할 수 있습니다.");
 * }
 * </pre>
 */
public class InvalidStateException extends BusinessException {

    public InvalidStateException(String message) {
        super(message, HttpStatus.BAD_REQUEST);
    }

    public InvalidStateException(String currentState, String requiredState) {
        super(
            String.format("잘못된 상태입니다. 현재: %s, 필요: %s", currentState, requiredState),
            HttpStatus.BAD_REQUEST
        );
    }
}
