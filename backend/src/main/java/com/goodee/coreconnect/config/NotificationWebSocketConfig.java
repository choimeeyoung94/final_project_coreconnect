package com.goodee.coreconnect.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.beans.factory.annotation.Value;

import com.goodee.coreconnect.common.notification.handler.NotificationWebSocketHandler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Notification WebSocket 설정
 * - 일반 WebSocket 핸들러 (STOMP 아님)
 * - SockJS 지원
 */
@Slf4j
@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class NotificationWebSocketConfig implements WebSocketConfigurer {
    
    private final NotificationWebSocketHandler notificationWebSocketHandler;
    private final WebSocketAuthInterceptor webSocketAuthInterceptor;
    
    @Value("${app.websocket.allowed-origins:http://localhost:5173}")
    private String allowedOrigins;
    
    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        log.info("🔥 [NotificationWebSocketConfig] 알림 WebSocket 핸들러 등록 시작");
        
        // 환경 변수에서 허용된 Origin 목록 가져오기 (쉼표로 구분)
        String[] origins = allowedOrigins.split(",");
        for (int i = 0; i < origins.length; i++) {
            origins[i] = origins[i].trim();
        }
        log.info("🔥 [NotificationWebSocketConfig] 허용된 Origins: {}", java.util.Arrays.toString(origins));
        
        registry.addHandler(notificationWebSocketHandler, "/ws/notification")
                .setAllowedOrigins(origins)
                .addInterceptors(webSocketAuthInterceptor) // WebSocket 인증 인터셉터 추가
                .withSockJS(); // SockJS 지원
        
        log.info("🔥 [NotificationWebSocketConfig] /ws/notification 핸들러 등록 완료 (SockJS 지원)");
    }
}

