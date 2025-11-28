package com.goodee.coreconnect.common.exception;

import org.springframework.http.HttpStatus;

/**
 * 🔁 중복된 리소스가 있을 때 발생하는 예외
 *
 * Unchecked Exception - 409 Conflict
 *
 * 사용 예시:
 * <pre>
 * if (userRepository.existsByEmail(email)) {
 *     throw new DuplicateResourceException("이미 사용 중인 이메일입니다: " + email);
 * }
 * </pre>
 */
public class DuplicateResourceException extends BusinessException {

    public DuplicateResourceException(String message) {
        super(message, HttpStatus.CONFLICT);
    }

    public DuplicateResourceException(String resourceName, String field, String value) {
        super(
            String.format("이미 존재하는 %s입니다. %s: %s", resourceName, field, value),
            HttpStatus.CONFLICT
        );
    }
}
