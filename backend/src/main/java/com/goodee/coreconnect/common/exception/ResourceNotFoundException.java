package com.goodee.coreconnect.common.exception;

import org.springframework.http.HttpStatus;

/**
 * 🔍 리소스를 찾을 수 없을 때 발생하는 예외
 *
 * Unchecked Exception - 404 Not Found
 *
 * 사용 예시:
 * <pre>
 * User user = userRepository.findById(userId)
 *     .orElseThrow(() -> new ResourceNotFoundException("사용자를 찾을 수 없습니다. ID: " + userId));
 * </pre>
 */
public class ResourceNotFoundException extends BusinessException {

    public ResourceNotFoundException(String message) {
        super(message, HttpStatus.NOT_FOUND);
    }

    public ResourceNotFoundException(String resourceName, Long id) {
        super(String.format("%s를 찾을 수 없습니다. ID: %d", resourceName, id), HttpStatus.NOT_FOUND);
    }

    public ResourceNotFoundException(String resourceName, String identifier) {
        super(String.format("%s를 찾을 수 없습니다. 식별자: %s", resourceName, identifier), HttpStatus.NOT_FOUND);
    }
}
