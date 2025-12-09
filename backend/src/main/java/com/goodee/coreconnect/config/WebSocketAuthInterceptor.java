package com.goodee.coreconnect.config;

import java.util.Map;

import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.socket.WebSocketHandler;

import com.goodee.coreconnect.security.jwt.JwtProvider;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * WebSocket handshake 시 토큰을 검사해서 session attributes 에 사용자 정보 저장
 * - 우선순위: cookie(access_token) -> query param(accessToken)
 * - 토큰 검증 실패 시 핸드쉐이크 거부
 *
 *  쿠키에서 토큰 추출 (45-58번 라인)
   └─ for문으로 쿠키 순회
   └─ "access_token" 쿠키 찾기
   └─ token = c.getValue() (52번 라인)

2. 쿠키에 없으면 쿼리 파라미터 확인 (61-73번 라인)
   └─ access_token 또는 accessToken 쿼리 파라미터 확인

3. 토큰이 없으면 연결 거부 (75-77번 라인)
   └─ return false

4. JWT 토큰 검증 (80-93번 라인)
   └─ jwtProvider.isValid(token)  (81번 라인)
   └─ jwtProvider.getSubject(token)  (85번 라인)
   └─ 세션에 정보 저장
   └─ return true (연결 허용)
 *
 * spring websocket 프레임워크가 websocket handshake 과정에서 인터셉터를 자동으로 출한다
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketAuthInterceptor implements HandshakeInterceptor {

    private final JwtProvider jwtProvider;

    // 웹소켓 인증 처리
    @Override
    public boolean beforeHandshake(org.springframework.http.server.ServerHttpRequest request,
                                   org.springframework.http.server.ServerHttpResponse response,
                                   WebSocketHandler wsHandler,
                                   Map<String, Object> attributes) throws Exception {
        if (!(request instanceof ServletServerHttpRequest)) {
            return true;
        }
        ServletServerHttpRequest servletReq = (ServletServerHttpRequest) request;
        HttpServletRequest httpReq = servletReq.getServletRequest();

        log.info("[WebSocketAuthInterceptor] 핸드셰이크 시작 - URI: {}", httpReq.getRequestURI());
        
        // (1) 쿠키 우선 조회
        String token = null;
        if (httpReq.getCookies() != null) { // 쿠키 존재 확인
            log.info("[WebSocketAuthInterceptor] 쿠키 개수: {}", httpReq.getCookies().length);
            for (Cookie c : httpReq.getCookies()) {// 쿠키 순회
                log.debug("[WebSocketAuthInterceptor] 쿠키 이름: {}", c.getName());
                if ("access_token".equals(c.getName())) {// access_token 쿠키 찾기
                    token = c.getValue();// 토큰 추출
                    log.info("[WebSocketAuthInterceptor] access_token 쿠키 발견");
                    break;
                }
            }
        } else {
            log.warn("[WebSocketAuthInterceptor] 쿠키가 null입니다");
        }

        // (2) 쿼리 파라미터(fallback) - 이름 다 받아주기
        if (token == null || token.isBlank()) {
            token = httpReq.getParameter("access_token");
            if (token != null) {
                log.info("[WebSocketAuthInterceptor] access_token 쿼리 파라미터 발견");
            }
        }
        if (token == null || token.isBlank()) {
            token = httpReq.getParameter("accessToken");
            if (token != null) {
                log.info("[WebSocketAuthInterceptor] accessToken 쿼리 파라미터 발견");
            }
        }

        if (token == null || token.isBlank()) {
            log.warn("[WebSocketAuthInterceptor] handshake without token (쿠키/쿼리 모두 없음) - reject");
            return false;
        }

        try {
            if (!jwtProvider.isValid(token)) {// JWT 토큰 유휴성 검증
                log.warn("[WebSocketAuthInterceptor] invalid token during websocket handshake");
                return false;
            }
            // JWT에서 이메일 추출
            String email = jwtProvider.getSubject(token);
            if (email == null || email.isBlank()) {
                log.warn("[WebSocketAuthInterceptor] token has no subject - reject");
                return false;
            }
            // 세션에 저장: NotificationWebSocketHandler will read "wsUserEmail" (or userId if you prefer)
            attributes.put("wsUserEmail", email);
            attributes.put("access_token", token);
            return true;
        } catch (Exception e) {
            log.warn("[WebSocketAuthInterceptor] token parsing error: {}", e.getMessage());
            return false;
        }
    }

    @Override
    public void afterHandshake(org.springframework.http.server.ServerHttpRequest request,
                               org.springframework.http.server.ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // no-op
    }
}