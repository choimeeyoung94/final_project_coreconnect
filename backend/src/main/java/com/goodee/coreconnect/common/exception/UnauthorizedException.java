package com.goodee.coreconnect.common.exception;

import org.springframework.http.HttpStatus;

/**
 * 🔐 인증되지 않은 사용자가 접근할 때 발생하는 예외
 *
 * Unchecked Exception - 401 Unauthorized
 *
 * 사용 예시:
 * <pre>
 * if (jwtToken == null || !jwtService.validateToken(jwtToken)) {
 *     throw new UnauthorizedException("유효하지 않은 토큰입니다.");
 * }
 * </pre>
 */
public class UnauthorizedException extends BusinessException {

    public UnauthorizedException(String message) {
        super(message, HttpStatus.UNAUTHORIZED);
    }

    public UnauthorizedException() {
        super("인증이 필요합니다.", HttpStatus.UNAUTHORIZED);
    }
}
