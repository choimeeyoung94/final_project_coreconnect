package com.goodee.coreconnect.chat.handler;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.goodee.coreconnect.chat.service.ChatRoomService;
import com.goodee.coreconnect.security.jwt.JwtProvider;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.repository.UserRepository;

import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 1:1, 1:N 채팅을 위한 WebSocketHandler
 * 
 * 
 * */
@Slf4j
@Component
@RequiredArgsConstructor
public class ChatWebSocketHandler extends TextWebSocketHandler {
	
	// 사용자ID와 세션 매핑 (추후 Redis로 확장 가능)
	private final Map<Long, WebSocketSession> userSessions = new ConcurrentHashMap<>();
	
	private final JwtProvider jwtProvider;
	
	private final UserRepository userRepository;
		
	private final ChatRoomService chatRoomService;
	
	// JSON 파싱용 ObjectMapper
	private final ObjectMapper objectMapper = new ObjectMapper();
	
	// 사용자별 구독 중인 채팅방 목록을 관리 (userId -> List of roomIds)
	private final Map<Long, List<Long>> userSubscriptions = new ConcurrentHashMap<>();
	
	// 클라이언트 연결 시 사용자 세션 저장
	@Override
	public void afterConnectionEstablished(WebSocketSession session) throws Exception {
		Long userId = getUserIdFromSession(session); // JWT/Principal에서 추출
		if (userId != null) {
			userSessions.put(userId, session);
		}		
	}
	
	
	// 클라이언트 연결 해제 시 세션 제거
	@Override
	public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
		Long userId = getUserIdFromSession(session);
		if (userId != null) {
			userSessions.remove(userId);
		}
	}	
	
	
	// JWT, Principal 에서 userId 추출하는 로직
	private Long getUserIdFromSession(WebSocketSession session) {
		// 1. JWT 토큰 추출 (클라이언트가 "Authorization: Bearer xxx"로 보내야 함)
		String token = null;
		
		// 표준 헤더
		List<String> authHeaders = session.getHandshakeHeaders().get("Authorization");
		if (authHeaders != null && !authHeaders.isEmpty()) {
			String bearer = authHeaders.get(0);
			if (bearer.startsWith("Bearer ")) {
				token = bearer.substring(7);
			}
		}

		if (token == null) {
			String query = session.getUri().getQuery(); // "accessToken=xxx"
			if (query != null && query.startsWith("accessToken=")) {
				token = query.substring("accessToken=".length());
			}
		}
		
		if (token == null) return null;
		
		try {
			// 2. JwtProvider에서 subject(email) 추출
			String email = jwtProvider.getSubject(token);
			// 3. email로 userId 조회
			User user = userRepository.findByEmail(email).orElse(null);
			return user != null ? user.getId().longValue() : null;
		} catch (Exception e) {
			return null;
		}
	}
	
	@Override
	protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
		// 1. 메시지 파싱 (JSON -> DTO 변환)
		// payload(문자열)는 일반적으로 JSON 형태의 채팅 메시지 데이터
		// 예) { "roomId": 123, "senderId": 456, "content": "안녕하세요!" }
		// 이 데이터 에서 채팅방ID, 메시지내용 등을 추출할때 사용하는게 extractRoomId, extractChatContent 메서드
		String payload = message.getPayload();
		
		// 1. 한번만 JSON 파싱
		JsonNode node = null;
		try {
			node = objectMapper.readTree(payload);
		} catch (Exception e) {
			log.error("[handleTextMessage] JSON 파싱 오류: " + e.getMessage());
			e.printStackTrace();
			return;
		}
		
		String type = node.has("type") ? node.get("type").asText() : "";
				
		// payload에서 roomId 추출
		Long roomId = extractRoomId(payload);
		
		// JWT에서 userId/email 추출
		Long senderId = getUserIdFromSession(session);
		
		// payload에서 메시지 내용 추출
		String chatContent = extractChatContent(payload);

		// 2.  채팅방의 참여자 userID 리스트 조회
		List<Integer> participantIds = chatRoomService.getParticipantIds(roomId != null ? roomId.intValue() : null);
		
		// email로도 관리 하므로 email 정보도 조회
		List<String> participatnEmails = chatRoomService.getParticipantEmail(roomId != null ? roomId.intValue() : null);
		
		Long userId = getUserIdFromSession(session);
		
		
		//  구독 요청 처리
		if ("subscribe".equals(type)) {
			roomId = node.has("roomId") ? node.get("roomId").asLong() : null;
			if (userId != null && roomId != null) {
				userSubscriptions.computeIfAbsent(userId, key -> new ArrayList<>()).add(roomId);
			}
		}
		
		
		// 3. 메시지 저장, 알람 생성 
		chatRoomService.saveMessageAndAlarm(
				roomId != null ? roomId.intValue() : null, 
				senderId != null ? senderId.intValue() : null, 
				chatContent);
		
		// 4. 참여자에게만 메시지 전송
		for (Integer user : participantIds) {
			WebSocketSession userSession = userSessions.get(user);
			if (userSession != null && userSession.isOpen()) {
				userSession.sendMessage(new TextMessage(chatContent));
			}
		}
	}
	
	
	// 메시지 payload(JSON)에서 채팅방ID(roomId) 값을 추출
	private Long extractRoomId(String payload) {
		
		try {
			JsonNode node = objectMapper.readTree(payload);
			if (node.has("roomId")) {
				return node.get("roomId").asLong();
			}
		} catch (Exception e) {
			log.error("[extractRoomId] JSON 파싱 오류: " + e.getMessage());
			e.printStackTrace();
		}
		
		return null;		
	}
	
	
	// 메시지 payload(JSON)에서 실제 메시지 내용(content)을 추출
	private String extractChatContent(String payload) {
		try {
			JsonNode node = objectMapper.readTree(payload);
			if (node.has("content")) {
				return node.get("content").asText();
			}
		} catch (Exception e) {
			log.error("[extractChatContent] content 필드가 없습니다. payload: " + payload);
			e.printStackTrace();
		}
		return null;
	}
	
	
	
	
}
