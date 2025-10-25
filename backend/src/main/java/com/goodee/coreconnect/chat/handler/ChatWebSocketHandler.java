package com.goodee.coreconnect.chat.handler;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.goodee.coreconnect.chat.entity.Alarm;
import com.goodee.coreconnect.chat.repository.AlarmRepository;
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
	private final Map<Integer, WebSocketSession> userSessions = new ConcurrentHashMap<>();
	
	private final JwtProvider jwtProvider;
	
	private final UserRepository userRepository;
		
	private final ChatRoomService chatRoomService;
	
	private final AlarmRepository alarmRepository;
	
	// JSON 파싱용 ObjectMapper
	private final ObjectMapper objectMapper = new ObjectMapper();
	
	// 사용자별 구독 중인 채팅방 목록을 관리 (userId -> List of roomIds)
	private final Map<Integer, List<Integer>> userSubscriptions = new ConcurrentHashMap<>();
	
	// 클라이언트 연결 시 사용자 세션 저장
	@Override
	public void afterConnectionEstablished(WebSocketSession session) throws Exception {
		Integer userId = getUserIdFromSession(session); // JWT/Principal에서 추출
		if (userId != null) {
			userSessions.put(userId, session);
		}		
	}
	
	
	// 클라이언트 연결 해제 시 세션 제거
	@Override
	public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
		Integer userId = getUserIdFromSession(session);
		if (userId != null) {
			userSessions.remove(userId);
		}
	}	
	
	
	// JWT, Principal 에서 userId 추출하는 로직
	private Integer getUserIdFromSession(WebSocketSession session) {
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
			return user != null ? user.getId().intValue() : null;
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
		Integer senderId = getUserIdFromSession(session);
		
		// payload에서 메시지 내용 추출
		String chatContent = extractChatContent(payload);

		// 2.  채팅방의 참여자 userID 리스트 조회
		List<Integer> participantIds = chatRoomService.getParticipantIds(roomId != null ? roomId.intValue() : null);
		
		// email로도 관리 하므로 email 정보도 조회
		List<String> participatnEmails = chatRoomService.getParticipantEmail(roomId != null ? roomId.intValue() : null);
		
		Integer userId = getUserIdFromSession(session);
		
		
		//  구독 요청 처리
		if ("subscribe".equals(type)) {
			roomId = node.has("roomId") ? node.get("roomId").asLong() : null;
			if (userId != null && roomId != null) {
				userSubscriptions.computeIfAbsent(userId, key -> new ArrayList<>()).add(roomId.intValue());
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
	
	
	// 알림을 받아야 하는 사용자가 여러명 일때 
	public void sendAlarmToUsers(List<Integer> userIds, String alarmType, String message, List<Integer> alarmIds) {
		
		for (int i = 0; i < userIds.size(); i++) {
			Integer userId = userIds.get(i);
			Integer alarmId = (alarmIds != null && alarmIds.size() > i) ? alarmIds.get(i) : null;
			sendAlarmToUser(userId, alarmType, message, alarmId);
		}
	}
		
	
	// 알림이 채팅, 이메일, 전자결제, 일정, 공지에서 발생한 경우 사용자에게 알림을 보낼수 있도록 하는 메서드
	public void sendAlarmToUser(Integer userId, String alarmType, String message, Integer alarmId ) {
		WebSocketSession session = userSessions.get(userId);
		String title = "";
		boolean sentSuccess = false;
		if (session != null && session.isOpen()) {
			ObjectNode json = objectMapper.createObjectNode();
			json.put("type", "alarm");
			json.put("alarmType", alarmType); // mail, message, calendar, board, schedule, approval
			json.put("recipientId", userId); // 알람 수신자
			json.put("title", title); // "전자결개 승인 요청이 있습니다", "새로운 일정이 등록되었습니다", "채팅 메시지가 도착했습니다", "이메일이 도착했습니다", "공지가 등록되었습니다."
			json.put("message", message);    
			json.put("alarmId", alarmId);
			try {
				
			} catch (Exception e) {
				log.error("[sendAlarmToUser] 알림 전송 오류: " + e.getMessage());
				sentSuccess = false;
			}
		}
		  updateAlarmSentYn(alarmId, sentSuccess);		
	}
	
	
	// 알림 전송 성공/실패 상태 DB에 저장
	public void updateAlarmSentYn(Integer alarmId, boolean sentSuccess) {
		if (alarmId == null) return;
		try {
			Optional<Alarm> alarmOpt = alarmRepository.findById(alarmId);
			if (alarmOpt.isPresent()) {
				Alarm alarm = alarmOpt.get();
				alarm.setAlarmSentYn(sentSuccess); // 알람 전송 성공/실패
				alarm.setAlarmSentAt(LocalDateTime.now()); // 전송 시각
				alarmRepository.save(alarm);
			}
			
		} catch (Exception e) {
			log.error("[updatedAlarmSentYn] 알림 전송 상태 저장 오류: " + e.getMessage());
		}
	}
	
	
}
