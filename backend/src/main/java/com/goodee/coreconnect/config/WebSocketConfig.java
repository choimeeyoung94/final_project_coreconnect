package com.goodee.coreconnect.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.web.socket.config.annotation.*;
import org.springframework.beans.factory.annotation.Value;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 1. 서버 시작 시
   └─ WebSocketConfig.registerStompEndpoints() 실행
   └─ 인터셉터 등록 (호출 아님!)

2. 클라이언트 연결 요청 시
   └─ 프론트엔드가 /ws/chat으로 연결 시도

3. Spring 프레임워크가 자동으로
   └─ 연결 요청 감지
   └─ 등록된 인터셉터 확인
   └─ beforeHandshake() 자동 호출 
 * 
 * ┌─────────────────────────────────────────────────────────────┐
│ 1️ 서버 시작 시 (등록 단계)                                           │
│                                                                │
│ WebSocketConfig                                                │
│   └─ registerStompEndpoints() 실행                              │
│       └─ addInterceptors(webSocketAuthInterceptor)             │
│           └─ Spring 내부 레지스트리에 등록                            │
│                                                                │
│ 결과: 인터셉터가 등록됨 (아직 호출 안 됨)                                 │
└────────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 2️ 클라이언트 연결 시 (호출 단계)                                    │
│                                                             │
│ 프론트엔드                                                   │
│   └─ new SockJS('/ws/chat')                                │
│                                                             │
│ Spring WebSocket 프레임워크                                 │
│   └─ 연결 요청 감지                                         │
│   └─ /ws/chat 엔드포인트 매칭                              │
│   └─ 등록된 인터셉터 목록 확인                              │
│   └─ beforeHandshake() 자동 호출 ⭐                        │
│       └─ WebSocketAuthInterceptor.beforeHandshake()        │
│                                                             │
│ 결과: 인증 처리 후 연결 허용/거부                            │
└─────────────────────────────────────────────────────────────┘
 * 
 * */


@Slf4j
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    
    private final WebSocketAuthInterceptor webSocketAuthInterceptor;
    
    @Value("${app.websocket.allowed-origins:http://localhost:5173}")
    private String allowedOrigins;
    
    // stomp 엔드포인트 등록
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        log.info("🔥 [WebSocketConfig] STOMP 엔드포인트 등록 시작");
        
        // 환경 변수에서 허용된 Origin 목록 가져오기 (쉼표로 구분)
        String[] origins = allowedOrigins.split(",");
        for (int i = 0; i < origins.length; i++) {
            origins[i] = origins[i].trim();
        }
        log.info("🔥 [WebSocketConfig] 허용된 Origins: {}", java.util.Arrays.toString(origins));
        
        // 엔드포인트 경로, allow origins 등 설정
        registry.addEndpoint("/ws/chat") // 프론트엔드 엔드포인트와 일치해야 한다
                .setAllowedOrigins(origins)
                .addInterceptors(webSocketAuthInterceptor) // WebSocket 인증 인터셉터 추가
                .withSockJS(); // 필요하다면 SockJS 지원도 추가
        log.info("🔥 [WebSocketConfig] /ws/chat 엔드포인트 등록 완료");
        
        // 부하 테스트용 순수 WebSocket 엔드포인트 (SockJS 없음)
        registry.addEndpoint("/ws/chat-raw")
                .setAllowedOrigins("*") // 부하 테스트용이므로 모든 origin 허용
                // 인터셉터 없음 - 부하 테스트에서는 인증 생략
                ; // SockJS 없음
        log.info("🔥 [WebSocketConfig] /ws/chat-raw 엔드포인트 등록 완료 (부하 테스트용)");
        
        // 알림 WebSocket은 NotificationWebSocketConfig에서 별도로 등록됨 (일반 WebSocket 핸들러)
        log.info("🔥 [WebSocketConfig] /ws/notification은 NotificationWebSocketConfig에서 등록됨");
        log.info("🔥 [WebSocketConfig] STOMP 엔드포인트 등록 완료");
    }
    
    // 메시지 브로커 설정
    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        log.info("🔥 [WebSocketConfig] 메시지 브로커 설정 시작");
        // /topic/* 으로 publish 될 메시지는 내부 메시지 브로커에서 관리 (방송)
        registry.enableSimpleBroker("/topic", "/queue");
        log.info("🔥 [WebSocketConfig] SimpleBroker 활성화: /topic, /queue");
        // 클라이언트가 /app으로 시작하는 주소로 send한 메시지는 @MessageMapping 대상으로 전달
        registry.setApplicationDestinationPrefixes("/app");
        log.info("🔥 [WebSocketConfig] ApplicationDestinationPrefixes 설정: /app");
        log.info("🔥 [WebSocketConfig] 메시지 브로커 설정 완료");
    }
    
    // 인바운드 채널 인터셉터 설정
    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        log.info("🔥 [WebSocketConfig] 클라이언트 인바운드 채널 설정 시작");
        // STOMP 메시지가 서버로 들어올 때 인터셉터 추가 가능
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                Object destination = message.getHeaders().get("simpDestination");
                String messageType = message.getHeaders().get("simpMessageType") != null ? 
                        message.getHeaders().get("simpMessageType").toString() : "UNKNOWN";
                
                // ⭐ SEND 메시지 (메시지 전송)에 대한 특별 로그
                if (destination != null && destination.toString().startsWith("/app/")) {
                    log.info("🔥🔥🔥 [WebSocketConfig] ⭐⭐⭐ SEND 메시지 수신 (메시지 전송) ⭐⭐⭐ - destination: {}, messageType: {}, headers: {}", 
                            destination, messageType, message.getHeaders());
                    // ⭐ 메시지 본문도 로그 출력 (디버깅용)
                    Object payload = message.getPayload();
                    if (payload != null) {
                        log.info("🔥🔥🔥 [WebSocketConfig] SEND 메시지 본문: {}", payload);
                    }
                } else {
                    log.info("🔥 [WebSocketConfig] ========== STOMP 메시지 수신 ========== - destination: {}, messageType: {}, headers: {}", 
                            destination, messageType, message.getHeaders());
                }
                return message;
            }
        });
        log.info("🔥 [WebSocketConfig] 클라이언트 인바운드 채널 설정 완료");
    }
}