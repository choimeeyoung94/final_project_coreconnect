package com.goodee.coreconnect.common.notification.handler;

import java.util.List;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.goodee.coreconnect.common.notification.service.WebSocketDeliveryService;
import com.goodee.coreconnect.security.jwt.JwtProvider;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationWebSocketHandler extends TextWebSocketHandler {

    private final JwtProvider jwtProvider;
    private final UserRepository userRepository;
    private final WebSocketDeliveryService webSocketDeliveryService;


    /**
     * 클라이언트(WebSocket) 연결 시 호출
     */
    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String token = (String) session.getAttributes().get("access_token");
        if (token == null || token.trim().isEmpty()) {
            log.warn("[NotificationWebSocketHandler] access_token 없음! 소켓 종료");
            session.close();
            return;
        }
        try {
            String email = jwtProvider.getSubject(token);
            if (email == null || email.trim().isEmpty()) {
                log.warn("[NotificationWebSocketHandler] JWT에서 이메일(subject) 추출 실패, 소켓 종료");
                session.close();
                return;
            }
            User user = userRepository.findByEmail(email).orElse(null);
            if (user != null) {
                webSocketDeliveryService.registerSession(user.getId(), session);
                session.getAttributes().put("userId", user.getId());
                log.info("[NotificationWebSocketHandler] 세션 등록 성공: userId={}, sessionId={}", user.getId(), session.getId());
            } else {
                log.warn("[NotificationWebSocketHandler] email '{}'에 해당하는 사용자가 없음. 세션 종료.", email);
                session.close();
            }
        } catch (Exception e) {
            log.warn("[NotificationWebSocketHandler] JWT 파싱 실패: {}. 세션 종료.", e.getMessage());
            session.close();
        }
    }

    /**
     * 클라이언트(WebSocket) 해제 시 호출
     */
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        // 보다 정확하게: 세션 attribute에서 userId 추출
        Integer userId = (Integer) session.getAttributes().get("userId");
        if (userId == null) {
            // 백업: JWT에서 추출(cf. 아래 헬퍼 참고)
            userId = getUserIdFromSession(session);
        }
        // 정확하게 해당 세션만 해제!
        if (userId != null) {
            webSocketDeliveryService.unregisterSession(userId, session);
            log.info("WebSocket session unregistered for userId={}, sessionId={}", userId, session.getId());
        } else {
            log.warn("WebSocket: Unable to unregister session (no userId found), sessionId={}", session.getId());
        }
    }

    // 클라이언트가 보낸 메시지로는 알림을 만들지 않는다. 알림은 서버 서비스에서만 생성한다
    // 프론트의 PING은 TextWebSocketHandler 기본 동작으로 무시된다

    /**
     * WebSocketSession에서 JWT 토큰을 파싱하여 사용자 ID 추출 (백업용)
     */
    private Integer getUserIdFromSession(WebSocketSession session) {
        // 1. Attribute에 userId가 우선 저장돼 있으면 사용
        Object attr = session.getAttributes().get("userId");
        if (attr instanceof Integer) {
            return (Integer) attr;
        }

        // 2. Authorization 헤더에서 Bearer 토큰 추출
        List<String> authHeaders = session.getHandshakeHeaders().get("Authorization");
        String token = null;
        if (authHeaders != null && !authHeaders.isEmpty()) {
            String bearer = authHeaders.get(0);
            if (bearer.startsWith("Bearer ")) {
                token = bearer.substring(7);
            }
        }

        // 3. 쿼리 파라미터 accessToken=xxx 지원 (프론트가 넣을 때)
        if (token == null) {
            String query = session.getUri().getQuery();
            if (query != null && query.startsWith("accessToken=")) {
                token = query.substring("accessToken=".length());
            }
        }

        // 4. attribute에 access_token 있는 경우
        if (token == null) {
            token = (String) session.getAttributes().get("access_token");
        }

        // 토큰 없으면 null 반환
        if (token == null) {
            return null;
        }

        try {
            String email = jwtProvider.getSubject(token);
            User user = userRepository.findByEmail(email).orElse(null);
            return user != null ? user.getId() : null;
        } catch (Exception e) {
            return null;
        }
    }
}