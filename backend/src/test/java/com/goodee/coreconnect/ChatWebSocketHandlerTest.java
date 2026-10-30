package com.goodee.coreconnect;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;


import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Optional;

import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import javax.sql.DataSource;
import java.lang.reflect.Field;
import org.mockito.MockitoAnnotations;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.goodee.coreconnect.approval.entity.Document;
import com.goodee.coreconnect.approval.entity.Template;
import com.goodee.coreconnect.approval.repository.DocumentRepository;
import com.goodee.coreconnect.approval.repository.TemplateRepository;
import com.goodee.coreconnect.chat.dto.response.ChatRoomLatestMessageResponseDTO;
import com.goodee.coreconnect.chat.entity.Chat;
import com.goodee.coreconnect.chat.entity.ChatRoom;
import com.goodee.coreconnect.chat.entity.ChatRoomUser;
import com.goodee.coreconnect.chat.entity.MessageFile;
import com.goodee.coreconnect.chat.handler.ChatWebSocketHandler;
import com.goodee.coreconnect.chat.repository.ChatRepository;
import com.goodee.coreconnect.chat.repository.ChatRoomUserRepository;
import com.goodee.coreconnect.chat.repository.MessageFileRepository;
import com.goodee.coreconnect.chat.repository.NotificationRepository;
import com.goodee.coreconnect.chat.service.ChatRoomService;
import com.goodee.coreconnect.chat.service.ChatRoomServiceImpl;
import com.goodee.coreconnect.common.entity.Notification;
import com.goodee.coreconnect.common.notification.enums.NotificationType;
import com.goodee.coreconnect.common.notification.service.NotificationService;
import com.goodee.coreconnect.common.notification.service.WebSocketDeliveryService;
import com.goodee.coreconnect.common.service.S3Service;
import com.goodee.coreconnect.security.jwt.JwtProvider;
import com.goodee.coreconnect.support.AbstractIntegrationTest;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

import lombok.extern.slf4j.Slf4j;

/**
 * WebSocketHandler 및 채팅/알림 비즈니스 로직 테스트
 *
 * legacy: 개발 DB에 있던 실제 계정(이메일)과 방 번호(2, 4)에 의존해서 빈 DB에서는 돌 수 없음.
 * 데이터를 스스로 만들도록 고칠 때까지 CI에서 제외함. (여기에만 있는 시나리오가 있을 수 있어 삭제는 하지 않음)
 * */
@Slf4j
@Tag("legacy")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "jwt.secret=integration-test-jwt-secret-key-must-be-at-least-256-bits-long",
    "cloud.aws.credentials.access-key=test",
    "cloud.aws.credentials.secret-key=test",
    "cloud.aws.region.static=ap-northeast-2",
    "cloud.aws.s3.bucket=test-bucket",
    "sendgrid.api.key=test",
    "sendgrid.from.email=test@coreconnect.test",
    "sendgrid.from.name=CoreConnect",
    "sendgrid.reply.to=test@coreconnect.test",
    "spring.mail.host=localhost",
    "spring.mail.username=test@coreconnect.test"
})
public class ChatWebSocketHandlerTest extends AbstractIntegrationTest {

	@Autowired
	ChatRoomService chatRoomService;
	
	@Autowired
	UserRepository userRepository;
	
	@Autowired
	JwtProvider jwtProvider;
	
	@Autowired
	NotificationRepository notificationRepository;
	
	@Autowired
	ChatRepository chatRepository;
	
	@Autowired
	DataSource dataSource;
	
	@Autowired
	TemplateRepository templateRepository;
	
	@Autowired
	DocumentRepository documentRepository;
	
	@Autowired
	ChatRoomUserRepository chatRoomUserRepository;
	
	@Autowired
	NotificationService notificationService;
	
	@Autowired
	MessageFileRepository messageFileRepository;
	
	@Autowired
	ChatWebSocketHandler chatWebSocketHandler;
	
	@Autowired
	S3Service s3Service;
	
	@Autowired
	private PlatformTransactionManager transactionManager;
	
	@Autowired
	private WebSocketDeliveryService webSocketDeliverService;
	
	
	@LocalServerPort
	int port;

	// 각 테스트 메서드 실행 전에 항상 이 메서드를 먼저 실행함 (테스트 준비)
	@BeforeEach
	void setUP() {
		// this를 사용하여 Mockitor가 @Mock으로 선언된 필드들을 초기화 (가짜 객체 생성 및 주입)
		MockitoAnnotations.openMocks(this);
		
		// 테스트용 ChatWebSocketHandler 인스턴스 생성
		// 생성자에 필요한 의존성(Mock개체들)을 주입
		/* handler = new WebSocketHandler(jwtProvider, userRepository, chatRoomService, notificationRepository, documentRepository);*/
	}
	
	@Test
	@DisplayName("1. ChatWebSocketHandler WebSocket 연결/해제 & 실시간 채팅 메시지 푸시 테스트")
	void testWebSocketConnection() throws Exception {
	   
		// 1. 테스트 사용자 준비: 실제 계정 사용
		String email = "choimeeyoung2@gmail.com";
		User user = userRepository.findByEmail(email).orElseThrow();
		Role role = user.getRole();
		
		// 채팅방 직접 생성
		List<Integer> userIds = Arrays.asList(user.getId());
		ChatRoom chatRoom = chatRoomService.createChatRoom("테스트방", userIds, email);
		int roomId = chatRoom.getId();		
		
		// 2. JWT 토큰 발급
		String accessToken = jwtProvider.createAccess(email, role, 10); // 10분짜리 액세스 토큰 
		
		// 3. WebSocket 클라이언트 준비
	    BlockingQueue<String> receivedMessages = new LinkedBlockingQueue<>();
	    TextWebSocketHandler clientHandler = new TextWebSocketHandler() {
	        @Override
	        public void handleTextMessage(WebSocketSession session, TextMessage message) {
	            receivedMessages.add(message.getPayload());
	        }
	    };

	    // 4. 서버에 WebSocket 연결
	    String wsUri = "ws://localhost:" + port + "/ws/chat?accessToken=" + accessToken;
	    StandardWebSocketClient client = new StandardWebSocketClient();
	    WebSocketSession session = client.doHandshake(clientHandler, wsUri).get();
		
	    // 5. 연결 후 세션이 정상적으로 등록되는지 검증 (핸들러 내부 세션 맵은 직접 접근 불가, 실시간 메시지로 간접 검증)
	    assertTrue(session.isOpen(), "WebSocket 세션이 정상적으로 오픈되어야 합니다.");

	    // 6. 채팅 메시지 전송 및 실시간 푸시 검증
	    String chatContent = "테스트 채팅 메시지입니다!";
	    String chatPayload = "{ \"type\": \"CHAT\", \"roomId\": " + roomId + ", \"content\": \"" + chatContent + "\" }";
	    session.sendMessage(new TextMessage(chatPayload));
	    String chatResponse = receivedMessages.poll(5, TimeUnit.SECONDS);
	    log.info("실시간 채팅 응답: {}" + chatResponse);
	    assertNotNull(chatResponse, "서버로부터 채팅 응답 메시지를 받아야 합니다.");
	    assertTrue(chatResponse.contains(chatContent), "채팅 응답에 메시지 내용이 포함되어야 합니다.");

	    // 7. 연결 해제 테스트
	    session.close(CloseStatus.NORMAL);
	    assertFalse(session.isOpen(), "WebSocket 세션이 정상적으로 닫혀야 합니다.");
	   
	}
	
	
	@Test
	@DisplayName("NotificationWebSocketHandler WebSocket 연결/해제 & 실시간 알림 푸시 테스트")
	void testNotificationWebSocketConnection() throws Exception {
		// 1. 테스트 사용자 준비 : 실제 계정 사용
		String email = "choimeeyoung2@gmail.com";
		User user = userRepository.findByEmail(email).orElseThrow(null);
		Role role = user.getRole();
		
		// 2. JWT 토큰 발급 
		String accessToken = jwtProvider.createAccess(email, role, 10);
		
		// 3. WebSocket 클라이언트 준비
		BlockingQueue<String> receivedMessages = new LinkedBlockingQueue<>();
		TextWebSocketHandler clientHandler = new TextWebSocketHandler() {
			protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
				receivedMessages.add(message.getPayload());
			}
		};
		
		// 4. 서버에 WebSocket 연결
		WebSocketHttpHeaders headers = new WebSocketHttpHeaders();

		String wsUri = "ws://localhost:" + port + "/ws/notification?accessToken=" + accessToken;
		StandardWebSocketClient client = new StandardWebSocketClient();
		WebSocketSession session = client.execute(clientHandler, wsUri, headers).get();
		
		assertTrue(session.isOpen(), "WebSocket 세션이 정상적으로 오픈되어야 합니다.");
		
		// 5. 알림 메시지 전송 및 실시간 푸시 검증
		String notificationPayload =  "{ \"recipientId\": " + user.getId() + ", \"type\": \"EMAIL\", \"message\": \"새 이메일이 왔습니다\" }";
		session.sendMessage(new TextMessage(notificationPayload));
		
		String response = receivedMessages.poll(5, TimeUnit.SECONDS);
		log.info("실시간 알림 응답: {}" + response);
		assertNotNull(response, "서버로부터 알림 응답 메시지를 받아야 합니다.");
	}
	
	
	
	@Test
	@DisplayName("2. 채팅방 생성/초대/참여자 관리")
	void testCreatedChatRoomANdInvite() throws Exception {
		   List<Integer> userIds = Arrays.asList(37,38,39,40,41);

	        String roomName = "testRoom";
	        String roomType = userIds.size() == 1 ? "alone" : "group";
	        Boolean favoriteStatus = false;

	        
	        
	        // 진짜 DB에 저장
	        ChatRoom created = chatRoomService.createChatRoom(roomName, userIds, "choimeeyoung2@gmail.com");

	        assertNotNull(created.getId());
	        assertEquals(roomName, created.getRoomName());
	        // 추가 검증 가능: 참여자 수, roomType 등
	}
	
	
	@Test
	@DisplayName("실제 DB에 채팅방 생성/참여자 저장 테스트")
	void testCreateChatRoomAndInviteRealDb() {
		// 이미 DB에 존재하는 이메일로 User 조회
		//User user1 = userRepository.findByEmail("admin@example.com").orElseThrow();
		User user2 = userRepository.findByEmail("choimeeyoung2@gmail.com").orElseThrow();
		User user3 = userRepository.findByEmail("ehddnras@gmail.com").orElseThrow();
		
	
		List<Integer> userIds = Arrays.asList(user2.getId(), user3.getId());
		
		// 실제 방 생성
		ChatRoom chatRoom = chatRoomService.createChatRoom("testRoom3", userIds, user2.getEmail());
		
		// PK는 자동생성! 직접 setId() 안함
		assertNotNull(chatRoom.getId());
		log.info("생성된 채팅방 PK: " + chatRoom.getId());
		
		// DB에서 직접 조회
		ChatRoom foundRoom = chatRoomService.findById(chatRoom.getId());
		assertEquals("testRoom3", foundRoom.getRoomName());
	}
	
	
	@Test
    void testJPASelectQueryEmail() throws Exception {
        String targetEmail = "ehddnras@gmail.com";
        try (Connection conn = dataSource.getConnection()) {
            // DB 정보 출력
            log.info(">>> 현재 연결된 DB 정보");
            log.info("DB URL: {} " + conn.getMetaData().getURL());
            log.info("DB User: " + conn.getMetaData().getUserName());
            log.info("DB Product: " + conn.getMetaData().getDatabaseProductName());
            log.info("DB Version: " + conn.getMetaData().getDatabaseProductVersion());

            // 현재 DB(스키마) 이름 확인 (MySQL 기준)
            try (PreparedStatement stmt = conn.prepareStatement("SELECT DATABASE()")) {
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) {
                        String dbName = rs.getString(1);
                        System.out.println("현재 DB 스키마 이름: " + dbName);
                    }
                }
            }

            // 실제 쿼리와 결과 확인
            String sql = "SELECT * FROM users WHERE user_email = ?";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, targetEmail);
                try (ResultSet rs = stmt.executeQuery()) {
                    System.out.println("실행한 쿼리: " + sql.replace("?", "'" + targetEmail + "'"));
                    boolean found = false;
                    while (rs.next()) {
                        found = true;
                        int id = rs.getInt("user_id");
                        String email = rs.getString("user_email");
                        String name = rs.getString("user_name");
                        String role = rs.getString("user_role");
                        String status = rs.getString("user_status");
                        System.out.printf("조회 결과 - user_id=%d, user_email=%s, user_name=%s, user_role=%s, user_status=%s\n",
                                id, email, name, role, status);
                    }
                    if (!found) {
                        System.out.println("해당 이메일(" + targetEmail + ")의 유저는 DB에 존재하지 않습니다.");
                    }
                }
            }
        }
    }
	
	
	@Test
	@DisplayName("Service/Repository로 2번방 roomType을 alone으로 변경")
	void testUpdateRoomTypeToAloneWithService() {
		// 1. 기존 1번 방 조회
		ChatRoom room = chatRoomService.findById(2);
		assertNotNull(room, "2번 방이 존재해야 함");
		log.info("변경전 roomType: " + room.getRoomType());
		
		// 2. 방의 roomType을 alone으로 변경
		ChatRoom updatedRoom = chatRoomService.updateRoomType(2, "alone");
		assertEquals("alone", updatedRoom.getRoomType());
		log.info("변경후 roomType: " + updatedRoom.getRoomType());		
	}
	
	@Test
	@DisplayName("3. 메시지 전송/알림 전송/수신자 전달 - 실제 DB 테스트")
	void testSendMessageAndAlarm() {
		// 채팅방과 참여자 준비
		// 1. DB에 저장된 모든 사용자(User) 정보를 전부 가져온다
		List<User> users = userRepository.findAll();

		// 2. 가져온 사용자 중 앞에서 최대 3명까지의 ID만 추린다
		// stream을 쓰면 여러가지 연산 (map, filter, collect등)을 연결해서 한번에 처리할 수 있다
		// ::의미 : 메서드 참조
		List<Integer> userIds = users.subList(0, Math.min(users.size(), 4)).stream().map(User::getId).toList();
	
		// 3. 채팅방을 하나 새로 만든다
		ChatRoom chatRoom = chatRoomService.createChatRoom("testroom4", userIds, "ehddnras@gmail.com");
		
		// 4. 메시지 저장 및 알림 생성
		String messageContent = "어서 오십시오";
		chatRoomService.sendChatMessage(chatRoom.getId(), userIds.get(0), messageContent);
		
		// 파일 메시지 저장 예시 (파일 메시지 테스트)
		MessageFile file = MessageFile.createMessageFile("test2.pdf", 12345.0, "chatfiles/test.pdf", null);
		chatRoomService.sendChatMessage(chatRoom.getId(), userIds.get(0), file);
		
		// 5. 메시지가 저장됐는지 확인
		List<Chat> chats = chatRepository.findByChatRoomId(chatRoom.getId());
		assertFalse(chats.isEmpty(), "메시지가 DB에 저장되어야 함");
		assertTrue(chats.stream().anyMatch(c -> messageContent.equals(c.getMessageContent())));
		 // 6. 실시간 푸시 및 알림 검증은 별도의 WebSocket 핸들러 테스트에서 수행
	}
	
	@Test
	@DisplayName("실제 사용자 JWT로 WebSocket 연결 및 메시지 전송/수신 테스트")
	void testWebSocketRealTimeMessageSend() throws Exception {
		
		
		// 1. 테스트 사용자 준비: DB에 있는 계정 사용
		String email = "109kms@naver.com";
		User user = userRepository.findByEmail(email).orElseThrow();
		Role role = user.getRole();
		
		// 2. JWT 토큰 발급
		String accessToken = jwtProvider.createAccess(email, role, 10); // 10분짜리 액세스 토큰

		// 3. WebSocket 클라이언트 준비
		/**
		 * 테스트에서 서버로부터 오는 WebSocket 메시지를 받을 수 있도록 핸들러를 등록.
		   메시지가 오면 Queue에 저장해서 이후 검증할 수 있게 설계.
		 * 
		 * 
		 * 
		 * */
		BlockingQueue<String> receivedMessages = new LinkedBlockingQueue<>();
		TextWebSocketHandler clientHandler = new TextWebSocketHandler() {
			 @Override
	            public void handleTextMessage(WebSocketSession session, TextMessage message) {
	                receivedMessages.add(message.getPayload());
	            }
		};
		
		// 4. 서버에 WebSocket 연결 (accessToken 쿼리파라미터로 전달)
		/**
		 * 로컬 테스트 서버에 WebSocket으로 직접 연결.
		   accessToken을 쿼리파라미터로 전달해 인증.
           실제 서비스와 동일한 방식으로 채팅/알림 서버에 접속.
		 * */
        String wsUri = "ws://localhost:" + port + "/ws/chat?accessToken=" + accessToken;
        StandardWebSocketClient client = new StandardWebSocketClient();
        WebSocketSession session = client.doHandshake(clientHandler, wsUri).get();

        // 5. WebSocket 메시지 전송
        NotificationType type = NotificationType.EMAIL;
   
        /**
         * SCHEDULE 타입의 알림 메시지를 서버에 전송. content는 포함하지 않음(비즈니스 규칙).
           실제 일정 등록/알림 등과 똑같은 데이터 구조로 메시지 전송.
         * */
        String schedulePayload = String.format(
        		"{ \"type\": \"%s\", \"roomId\": 3 }",
        	    type.name() // "APPROVAL"
        	    
        	);
       
        session.sendMessage(new TextMessage(schedulePayload));

        // 6. 서버에서 발송된 응답/알림 메시지 수신 및 검증 (5초 이내 도착)
        /**
         * 서버가 WebSocket을 통해 클라이언트에게 실시간 메시지를 push하면, 클라이언트가 해당 메시지를 수신.
           메시지가 정상적으로 수신되는지 5초 내에 검증.
         * */
        String response = receivedMessages.poll(5, TimeUnit.SECONDS);
        System.out.println("서버 응답: " + response);

        assertNotNull(response, "서버로부터 응답 메시지를 받아야 합니다.");
        
		
		// 7. DB에서 알림 메시지 검증 (SCHEDULE 타입)
        /**
         * 알림(Notification) 테이블에서 해당 사용자에게 전송된 알림이 제대로 저장됐는지 검증.
           SCHEDULE 타입은 비즈니스 로직대로 알림 메시지가 content 없이 생성됐는지 체크.
         * */
		List<Notification> notifications = notificationRepository.findByUserId(user.getId());
		// SCHEDULE 검증
		boolean foundSchedule = notifications.stream()
			    .filter(n -> n.getNotificationType() != null)
			    .anyMatch(n -> n.getNotificationType() == NotificationType.EMAIL
			        && n.getNotificationMessage() != null
			        && n.getNotificationMessage().contains("이메일이 도착했습니다."));
		assertTrue(foundSchedule, "DB에 APPROVAL 알림 메시지가 올바르게 저장되어야 합니다.");
		
		// 8. CHAT 타입 메시지 전송 및 검증
		/**
		 * CHAT 타입 메시지를 서버에 전송. content에 실제 채팅 메시지가 포함됨.
           서버가 실시간으로 메시지를 push하면 정상적으로 수신되는지 검증.
		 * */
		String chatContent = "안녕하세요 김민석 입니다~~";
		String chatPayload = "{ \"type\": \"CHAT\", \"roomId\": 3, \"content\": \"" + chatContent + "\" }";
		session.sendMessage(new TextMessage(chatPayload));
		
		String chatResponse = receivedMessages.poll(5, TimeUnit.SECONDS);
		System.out.println("채팅 응답: " + chatResponse);
		assertNotNull(chatResponse, "서버로부터 채팅 응답 메시지를 받아야 합니다.");
		
		// 9. DB에서 알림 메시지 검증 (CHAT 타입: content 포함)
		// DB에서 chatContent(사용자 메시지)가 알림 메시지에 제대로 포함되어 있는지 검증.
	    notifications = notificationRepository.findByUserId(user.getId());
	 // Chat 테이블에서 메시지 검증
	    List<Chat> chats = chatRepository.findByChatRoomId(3);
	    boolean foundChat = chats.stream()
	        .anyMatch(c -> c.getMessageContent() != null && c.getMessageContent().contains(chatContent));
	    assertTrue(foundChat, "DB에 채팅 메시지(content)가 저장되어야 합니다.");
	}
	

	@Test
	@DisplayName("전자결재 문서 등록/알림 생성 & 삭제/알림 soft-delete 통합 테스트")
	void testApprovalDocumentWebSocketLifecycle2() throws Exception {
		// 1. 실제 사용자 계정 준비
		User user = userRepository.findAll().get(3); // 첫 번째 계정 사용
		String email = user.getEmail();
		
		// 2. JWT 토큰 발급
		Role role = user.getRole();
		String accessToken = jwtProvider.createAccess(email, role, 10);
		
		// 3. WebSocket 연결/클라이언트 준비
		BlockingQueue<String> receivedMessages = new LinkedBlockingQueue<>();
	    TextWebSocketHandler clientHandler = new TextWebSocketHandler() {
	        @Override
	        public void handleTextMessage(WebSocketSession session, TextMessage message) {
	            receivedMessages.add(message.getPayload());
	        }
	    };
	    String wsUri = "ws://localhost:" + port + "/ws/chat?accessToken=" + accessToken;
	    StandardWebSocketClient client = new StandardWebSocketClient();
	    WebSocketSession session = client.doHandshake(clientHandler, wsUri).get();
		
	    // 4. 전자결재 문서 등록 요청 (WebSocket)
//		String docTitle = "테스트 결재 문서1";
//		String docContent = "결재 문서 내용1";
		
//		// Template 생성
//		Template template = Template.createTemplate("기본 결재 템플릿1", "템플릿 내용1", user);
//		template = templateRepository.save(template);
//		
//		// Document 생성
//		Document document = Document.createDocument(template, user, docTitle, docContent);
//		document.setDocDeletedYn(false);
//		Document savedDocument = documentRepository.save(document);
//		documentRepository.flush();
	    
		// 5. WwbSocket으로 APPROVAL 알림 전송
		String approvalPayload = String.format(
			"{ \"type\": \"APPROVAL\", \"docId\": %d }", 15
		);
		
		session.sendMessage(new TextMessage(approvalPayload));
		
		// 6. 서버에서 수신한 알림 메시지 검증 (실시간 push)
	    String approvalResponse = receivedMessages.poll(5, TimeUnit.SECONDS);
	    System.out.println("전자결재 알림 응답: " + approvalResponse);
	    assertNotNull(approvalResponse, "서버로부터 APPROVAL 알림 메시지를 받아야 합니다.");

	    // 7. DB 알림(Notification) 생성 확인
	    List<Notification> notifications = notificationRepository.findByUserId(user.getId());
	    Notification approvalNotification = notifications.stream()
	        .filter(n -> n.getNotificationType() == NotificationType.APPROVAL
	            && n.getDocument() != null
	            && n.getDocument().getId().equals(15)
	            && n.getNotificationDeletedYn() != Boolean.TRUE)
	        .findFirst()
	        .orElseThrow(() -> new AssertionError("APPROVAL 알림이 DB에 저장되어야 함"));

	    String expectedMessage = user.getName() + "님이 전자결재 문서를 등록했습니다.";
	    assertEquals(expectedMessage, approvalNotification.getNotificationMessage());

	    // 8. 문서 삭제 요청 (서비스 직접 호출)
	    //chatRoomService.deleteDocumentAndNotification(15);

	    // 9. 문서 삭제 상태 검증
	    //Document deletedDoc = documentRepository.findById(15).orElseThrow();
	    //assertTrue(deletedDoc.getDocDeletedYn(), "문서가 삭제 상태여야 함");

	    // 10. 알림 soft-delete 상태 검증 (알림이 비활성화되어야 함)
	   // Notification deletedNotification = notificationRepository.findById(approvalNotification.getId()).orElseThrow();
	    //assertTrue(deletedNotification.getNotificationDeletedYn(), "알림이 soft-delete 상태여야 함");

	}
	
	@Test
	@DisplayName("통합 테스트")
	void testApprovalDocumentWebSocketLifecycle() throws Exception {
	    // 1. 실제 사용자 계정 준비
	    User user = userRepository.findAll().get(2);

	    // 2. 문서/템플릿 저장을 별도 트랜잭션으로 실행
	    TransactionTemplate txTemplate = new TransactionTemplate(transactionManager);
	    Document savedDocument = txTemplate.execute(status -> {
	        Template template = Template.createTemplate("기본 결재 템플릿9", "템플릿 내용9", "기본 결재 템플릿9", user);
	        template = templateRepository.save(template);
	        templateRepository.flush();

	        Document document = Document.createDocument(template, user, "테스트 결재 문서9", "결재 문서 내용9");
	        document.markDeleted(false); 
	        Document savedDoc = documentRepository.save(document);
	        documentRepository.flush();

	        return savedDoc;
	    });

	    // 3. WebSocket 및 검증 (이제 DB에 데이터가 있음)
	    // ... 이하 기존 코드에서 savedDocument.getId() 사용 ...
	}
	
	@Test
	void testDatabaseConnectionInfo() throws Exception {
	    try (Connection conn = dataSource.getConnection()) {
	        String dbUrl = conn.getMetaData().getURL();                    // 실제 접속한 DB의 URL
	        String dbUser = conn.getMetaData().getUserName();              // 접속한 DB의 사용자명
	        String dbProduct = conn.getMetaData().getDatabaseProductName();// DB 종류 (MySQL 등)
	        String dbVersion = conn.getMetaData().getDatabaseProductVersion();// DB 버전

	        System.out.println("DB 연결 성공!");
	        System.out.println("DB URL: " + dbUrl);
	        System.out.println("DB User: " + dbUser);
	        System.out.println("DB Product: " + dbProduct);
	        System.out.println("DB Version: " + dbVersion);

	        assertNotNull(conn);
	        assertNotNull(dbUrl);
	        assertNotNull(dbUser);
	    }
	}
	
	@Test
    void testPrintAllUsers() throws Exception {
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT * FROM users")) {
             System.out.println("----- users 테이블 전체 데이터 -----");
             int count = 0;
             while (rs.next()) {
                // 필요한 컬럼명에 맞게 출력 (예시: user_id, user_email, user_name 등)
                int id = rs.getInt("user_id");
                String email = rs.getString("user_email");
                String name = rs.getString("user_name");
                String role = rs.getString("user_role");
                String status = rs.getString("user_status");
                System.out.printf("user_id=%d, user_email=%s, user_name=%s, user_role=%s, user_status=%s\n",
                        id, email, name, role, status);
                count++;
             }
             System.out.println("총 " + count + "명의 사용자 데이터가 조회되었습니다.");
        }
    }
	
	 @Test
	 @DisplayName("실시간 알림 WebSocket 푸시 테스트")
	 void testNotificationWebSocketPush() throws Exception {
	     BlockingQueue<String> receivedMessages = new LinkedBlockingQueue<>();
	     TextWebSocketHandler clientHandler = new TextWebSocketHandler() {
	         @Override
	         public void handleTextMessage(WebSocketSession session, TextMessage message) {
	             receivedMessages.add(message.getPayload());
	         }
	     };

	     String email = "choimeeyoung2@gmail.com";
	     User user = userRepository.findByEmail(email).orElseThrow();
	     String accessToken = jwtProvider.createAccess(email, user.getRole(), 10);

	     String wsUri = "ws://localhost:" + port + "/ws/notification?accessToken=" + accessToken;
	     StandardWebSocketClient client = new StandardWebSocketClient();
	     WebSocketSession session = client.doHandshake(clientHandler, wsUri).get();

	     // 알림 메시지 전송
	     String notificationPayload = "{ \"recipientId\": " + user.getId() + ", \"type\": \"EMAIL\", \"message\": \"새 이메일이 왔습니다\" }";
	     session.sendMessage(new TextMessage(notificationPayload));

	     // 실시간 푸시 메시지 수신 검증
	     String response = receivedMessages.poll(5, TimeUnit.SECONDS);
	     assertNotNull(response);
	     assertTrue(response.contains("새 이메일이 왔습니다"));
	 }
	 
	 @Test
	 @Transactional
	 @DisplayName("로그인한 사용자가 참여중인 모든 채팅방의 마지막 메시지만 조회")
	 void testFindLatestMessagesByUserId() {
	     String email = "choimeeyoung2@gmail.com";
	     User user = userRepository.findByEmail(email)
	             .orElseThrow(() -> new IllegalArgumentException("사용자 없음:" + email));
	     Role role = user.getRole();

	     String accessToken = jwtProvider.createAccess(email, role, 30);
	     assertNotNull(accessToken);
	     log.info("발급된 JWT Access Token: " + accessToken);

	     // 1. 참여중인 방의 roomId 리스트 얻기
	     List<ChatRoomLatestMessageResponseDTO> roomDTOs = chatRoomService.getChatRoomIdsByUserId(user.getId());
	     assertNotNull(roomDTOs);
	     assertFalse(roomDTOs.isEmpty(), "참여중인 채팅방이 최소 1개 이상 있어야 테스트가 가능");

	     List<Integer> chatRoomIds = roomDTOs.stream()
	         .map(ChatRoomLatestMessageResponseDTO::getRoomId)
	         .collect(Collectors.toList());

	     // 2. 각 채팅방의 마지막 메시지 조회
	     List<Chat> lastMessages = chatRepository.findLatestMessageByChatRoomIds(chatRoomIds);

	     assertNotNull(lastMessages);
	     log.info("채팅방별 마지막 메시지 수: " + lastMessages.size());

	     for (Chat chat : lastMessages) {
	         String senderName = (chat.getSender() != null) ? chat.getSender().getName() : "알 수 없음";
	         log.info("채팅방[{}] 마지막 메시지 [{}] {}: {}", 
	             chat.getChatRoom().getId(), chat.getSendAt(), senderName, chat.getMessageContent());
	     }
	 } 
	 
	 @Test
	 @Transactional
	 @DisplayName("로그인한 사용자가 참여중인 채팅방 목록에서 채팅방을 선택하는 경우 선택한 채팅방의 메시지만 날짜기준 오름차순으로 정렬")
	 void testGetChatRoomMessagesByChatRoomId() {
	     // 1. DB에 실제 존재하는 이메일로 사용자 조회 (로그인)
	     String email = "choimeeyoung2@gmail.com";
	     User user = userRepository.findByEmail(email)
	          .orElseThrow(() -> new IllegalArgumentException("사용자 없음:" + email));
	     Role role = user.getRole();

	     // 2. JWT Access 토큰 발급
	     String accessToken = jwtProvider.createAccess(email, role, 30);
	     assertNotNull(accessToken);
	     log.info("발급된 JWT Access Token: " + accessToken);

	     // 3. 내가 참여중인 채팅방 DTO 리스트 조회
	     List<ChatRoomLatestMessageResponseDTO> chatRoomDTOs = chatRoomService.getChatRoomIdsByUserId(user.getId());
	     assertNotNull(chatRoomDTOs);
	     assertFalse(chatRoomDTOs.isEmpty(), "참여중인 채팅방이 최소 1개 이상 있어야 테스트가 가능");

	     // 4. 테스트용: 첫번째 채팅방 선택
	     ChatRoomLatestMessageResponseDTO selectedRoomDTO = chatRoomDTOs.get(0); // 0번 인덱스(첫방)
	     Integer selectedRoomId = selectedRoomDTO.getRoomId();

	     ChatRoom selectedRoom = chatRoomService.findById(selectedRoomId);
	     assertNotNull(selectedRoom);

	     log.info("선택한 채팅방: [{}] {}", selectedRoom.getId(), selectedRoom.getRoomName());

	     // 5. 선택한 채팅방의 모든 메시지 날짜 오름차순 정렬
	     List<Chat> messages = selectedRoom.getChats();
	     messages.sort(Comparator.comparing(Chat::getSendAt));

	     for (Chat chat : messages) {
	         String senderName = (chat.getSender() != null) ? chat.getSender().getName() : "알 수 없음";
	         String msgType = (chat.getFileYn() != null && chat.getFileYn()) ? "[파일]" : "[텍스트]";
	         String fileInfo = "";

	         if (chat.getFileYn() != null && chat.getFileYn()) {
	             List<MessageFile> files = chat.getMessageFiles();
	             if (files != null && !files.isEmpty()) {
	                 fileInfo = "파일명: " + files.get(0).getFileName();
	             } else {
	                 fileInfo = "파일명 없음";
	             }
	         }
	         log.info("[{}] {} {}: {} {}", chat.getSendAt(), senderName, msgType, chat.getMessageContent(), fileInfo);
	     }

	     // Optional: 메시지의 날짜 오름차순이 맞는지 검증
	     for (int i = 1; i < messages.size(); i++) {
	         assertTrue(messages.get(i - 1).getSendAt().isBefore(messages.get(i).getSendAt()) ||
	                    messages.get(i - 1).getSendAt().isEqual(messages.get(i).getSendAt()),
	                    "메시지가 날짜 오름차순으로 정렬되어야 함");
	     }
	 }
	 
	 @Test
	 @Transactional
	 @DisplayName("선택한 채팅방에서 메시지를 정렬해서 보여줄때 나와 다른 사람을 구분해서 메시지를 날짜기준 오름차순으로 정렬해서 보여주기")
	 void testGetChatRoomMessagesByChatRoomIdWithSenderType() {
	     // 1. 로그인한 사용자 조회
	     String email = "choimeeyoung2@gmail.com";
	     User user = userRepository.findByEmail(email)
	             .orElseThrow(() -> new IllegalArgumentException("사용자 없음: " + email));
	     Role role = user.getRole();

	     // 2. JWT 토큰 발급
	     String accessToken = jwtProvider.createAccess(email, role, 30);
	     assertNotNull(accessToken);
	     log.info("발급된 JWT Access Token: {}", accessToken);

	     // 3. 참여중인 채팅방 DTO 목록 조회
	     List<ChatRoomLatestMessageResponseDTO> chatRooms = chatRoomService.getChatRoomIdsByUserId(user.getId());
	     assertNotNull(chatRooms);
	     assertFalse(chatRooms.isEmpty(), "참여중인 채팅방이 최소 1개 이상 있어야 테스트가 의미 있음");

	     // 4. 테스트용: 첫번째 채팅방 선택 (실제 클릭 상황 가정)
	     ChatRoomLatestMessageResponseDTO selectedRoomDTO = chatRooms.get(0); // 0번 인덱스(첫번째 방)
	     Integer selectedRoomId = selectedRoomDTO.getRoomId();
	     ChatRoom selectedRoom = chatRoomService.findById(selectedRoomId);
	     assertNotNull(selectedRoom);

	     log.info("선택한 채팅방: [{}] {}", selectedRoom.getId(), selectedRoom.getRoomName());

	     // 5. 선택한 채팅방의 모든 메시지 날짜 오름차순 정렬
	     List<Chat> messages = selectedRoom.getChats();
	     messages.sort(Comparator.comparing(Chat::getSendAt));

	     log.info("메시지 개수: {}", messages.size());

	     for (Chat chat : messages) {
	         String senderName = (chat.getSender() != null) ? chat.getSender().getName() : "알 수 없음";
	         boolean isMine = chat.getSender() != null && chat.getSender().getId().equals(user.getId());
	         String senderType = isMine ? "[내 메시지]" : "[다른 사람 메시지]";
	         String msgType = (chat.getFileYn() != null && chat.getFileYn()) ? "[파일]" : "[텍스트]";
	         String fileInfo = "";

	         // 파일 메시지면 파일명 출력 (messageFiles 연관관계 활용)
	         if (chat.getFileYn() != null && chat.getFileYn()) {
	             List<MessageFile> files = chat.getMessageFiles();
	             if (files != null && !files.isEmpty()) {
	                 fileInfo = "파일명: " + files.get(0).getFileName();
	             } else {
	                 fileInfo = "파일명 없음";
	             }
	         }

	         log.info("{} [{}] {} {}: {} {}", senderType, chat.getSendAt(), senderName, msgType, chat.getMessageContent(), fileInfo);

	     }

	     // 날짜 오름차순 검증
	     for (int i = 1; i < messages.size(); i++) {
	         assertTrue(messages.get(i - 1).getSendAt().isBefore(messages.get(i).getSendAt()) ||
	                    messages.get(i - 1).getSendAt().isEqual(messages.get(i).getSendAt()),
	                    "메시지가 날짜 오름차순으로 정렬되어야 함");
	     }
	 }
	 
	 @Test
	 @Transactional
	 @DisplayName("채팅방에서 메시지를 수신받은 사람이 답신 보내기 - 채팅방 참여자가 두명일때")
	 void testReplyToReceivedMessage() {
		 // 1. 두 명의 사용자 조회 (실제 DB에 존재하는 이메일 사용)
		 User sender = userRepository.findByEmail("choimeeyoung2@gmail.com")
				 .orElseThrow(() -> new IllegalArgumentException("송신자 없음"));
		 User receiver = userRepository.findByEmail("ehddnras@gmail.com")
				 .orElseThrow(() -> new IllegalArgumentException("수신자 없음"));
		 
		 // 2. 두 명이 참여하는 채팅방 생성 (이미 있으면 기존 채팅방 사용)
		 List<Integer> userIds = List.of(sender.getId(), receiver.getId());
		 ChatRoom chatRoom = chatRoomService.createChatRoom("테스트채팅방2", userIds, sender.getEmail());
		 
		 assertNotNull(chatRoom, "채팅방 생성 또는 조회 실패");
		 Integer roomId = chatRoom.getId();
		 
		 String messageFromSender = "안녕하세요, 테스트 메시지입니다.";
		 Chat sentChat = chatRoomService.sendChatMessage(roomId, sender.getId(), messageFromSender);
		 

	    assertNotNull(sentChat, "송신자 메시지 전송 실패");
	    assertEquals(messageFromSender, sentChat.getMessageContent());
		 
	    // 4. 수신자가 답신 메시지 전송
	    String replyMessage = "네, 메시지 잘 받았습니다. 답신입니다.";
	    Chat replyChat = chatRoomService.sendChatMessage(roomId, receiver.getId(), replyMessage);

	    assertNotNull(replyChat, "수신자 답신 메시지 전송 실패");
	    assertEquals(replyMessage, replyChat.getMessageContent());

	    // 5. 채팅방에서 메시지 전체 조회 (날짜 오름차순 정렬)
	    ChatRoom refreshedRoom = chatRoomService.findById(roomId);
	    List<Chat> messages = refreshedRoom.getChats();
	    messages.sort(java.util.Comparator.comparing(Chat::getSendAt));

	    // 6. 검증: 송신자 메시지 → 수신자 답신 순서 존재, 내용/발신자 확인
	    messages = chatRepository.findByChatRoomIdOrderBySendAtAsc(roomId);
	    assertTrue(messages.size() >= 2, "메시지 2건 이상이어야 테스트 가능");

	    Chat firstMsg = messages.get(messages.size() - 2);
	    Chat secondMsg = messages.get(messages.size() - 1);

	    assertEquals(sender.getId(), firstMsg.getSender().getId());
	    assertEquals(messageFromSender, firstMsg.getMessageContent());

	    assertEquals(receiver.getId(), secondMsg.getSender().getId());
	    assertEquals(replyMessage, secondMsg.getMessageContent());

	    // 로그 출력 (검증용)
	    for (Chat chat : messages) {
	        String who = (chat.getSender().getId().equals(sender.getId())) ? "[송신자]" : "[수신자]";
	        log.info("{} [{}] {}: {}", who, chat.getSendAt(), chat.getSender().getName(), chat.getMessageContent());
	    }
	    
	    
	    
	 }
	 
	 
	 
	 @Test
	 @Transactional
	 @DisplayName("채팅방 참여자가 3명이상일떄 채팅방에서 메시지를 수신받은 사람이 답신 보내기")
	 void testChatRoomMessageLayout() {
		// 1. 채팅방 ID 지정 (예시: 4번방)
		Integer chatRoomId = 4;
		
		// 2. 로그인 사용자 조회 (예: 39번)
	    User me = userRepository.findById(39).orElseThrow();
		
	    // 3. 채팅방 참여자 조회
	    List<ChatRoomUser> chatRoomUsers = chatRoomUserRepository.findByChatRoomId(chatRoomId);
	    List<Integer> participantIds = chatRoomUsers.stream().map(u -> u.getUser().getId()).toList();
		
	    // 4. 메시지 날짜 오름차순 조회
	    List<Chat> messages = chatRepository.findByChatRoomIdOrderBySendAtAsc(chatRoomId);
	    assertFalse(messages.isEmpty(), "메시지가 1개 이상이어야 테스트가 의미 있음");
		
	    // 5. 메시지 화면 배치 테스트
	    for (Chat msg : messages) {
	        User sender = msg.getSender();
	        boolean isMe = sender != null && sender.getId().equals(me.getId());
	        String display;

	        // 텍스트 메시지
	        if (msg.getMessageContent() != null && !msg.getMessageContent().isBlank()) {
	            if (isMe) {
	                display = String.format("[오른쪽] %s", msg.getMessageContent());
	            } else {
	                display = String.format("[왼쪽] %s: %s", sender.getName(), msg.getMessageContent());
	            }
	        } 
	        // 파일 메시지
	        else if (Boolean.TRUE.equals(msg.getFileYn())) {
	            String fileName = "파일명 없음";
	            List<MessageFile> files = msg.getMessageFiles();
	            if (files != null && !files.isEmpty() && files.get(0).getFileName() != null) {
	                fileName = files.get(0).getFileName();
	            }
	            if (isMe) {
	                display = String.format("[오른쪽] 파일: %s", fileName);
	            } else {
	                display = String.format("[왼쪽] %s: 파일 %s", sender.getName(), fileName);
	            }
	        } 
	        // 빈 메시지
	        else {
	            display = isMe ? "[오른쪽] (빈 메시지)" : String.format("[왼쪽] %s: (빈 메시지)", sender != null ? sender.getName() : "알수없음");
	        }

	        // 날짜와 함께 출력 (오름차순으로 이미 정렬되어 있음)
	        log.info("[{}] {}", msg.getSendAt(), display);
	    }
		
	    // 6. 날짜 오름차순 정렬 검증
	    for (int i = 1; i < messages.size(); i++) {
	        assertTrue(
	            messages.get(i - 1).getSendAt().isBefore(messages.get(i).getSendAt()) ||
	            messages.get(i - 1).getSendAt().isEqual(messages.get(i).getSendAt()),
	            "메시지가 날짜 오름차순으로 정렬되어야 함"
	        );
	    }
	 }
	 
	 @Test
	 @DisplayName("현재 참여중인 채팅방에서 또 다른 사용자 초대하기 - 2명이상 초대하기")
	 void testInviteUsersToChatRoom() {
		    // 1. 채팅방 정보
		    Integer chatRoomId = 4;
		    ChatRoom chatRoom = chatRoomService.findById(chatRoomId);
		    assertNotNull(chatRoom, "채팅방 없음");

		    // 2. 현재 채팅방 참여자 ID 목록 조회
		    List<Integer> participantIds = chatRoomService.getParticipantIds(chatRoomId);

		    // 3. 참여하지 않은 회원 전체 목록 조회
		    List<User> allUsers = userRepository.findAll();
		    List<User> nonParticipants = allUsers.stream()
		            .filter(u -> !participantIds.contains(u.getId()))
		            .collect(Collectors.toList());

		    // 4. 참여하지 않은 회원 이름 목록 출력 (선택 UI 대신 로그로)
		    log.info("채팅방({}) 참여하지 않은 회원 목록:", chatRoom.getRoomName());
		    for (User u : nonParticipants) {
		        log.info("사용자: {} (ID: {})", u.getName(), u.getId());
		    }

		    // 5. 테스트용으로 2명 선택 (실제 UI에서는 체크박스로 선택)
		    List<User> selectedUsers = nonParticipants.stream().limit(2).collect(Collectors.toList());
		    assertFalse(selectedUsers.isEmpty(), "초대할 사용자가 최소 1명 이상 있어야 함");

		    // 6. 초대 알림 발송
		    String inviteMsg = chatRoomId + "번 " + chatRoom.getRoomName() + " 채팅방에 초대 되었습니다";
		    for (User invited : selectedUsers) {
//		        notificationService.sendNotification(
//		            invited.getId(),
//		            NotificationType.NOTICE, // 알림 타입 NOTICE 활용
//		            inviteMsg,
//		            null, null, // chatId, roomId는 null
//		            null,       // senderId는 테스트 코드에서는 null 처리(실제 로그인 유저 ID로)
//		            null        // senderName도 null
//		        );
		        log.info("초대 알림 전송: {} -> {}", invited.getName(), inviteMsg);
		    }

		    // 7. 초대된 사용자가 알림 클릭 후 채팅방에 참여 (테스트에서는 바로 참여 처리)
		    for (User invited : selectedUsers) {
		        // DB에 참여자 추가
		        ChatRoomUser cru = ChatRoomUser.createChatRoomUser(invited, chatRoom);
		        chatRoomUserRepository.save(cru);

		        // 채팅방에 참여 메시지 전송
		        String joinMsg = invited.getName() + "의 사용자가 채팅방에 참여했습니다";
		        Chat joinChat = chatRoomService.sendChatMessage(chatRoomId, invited.getId(), joinMsg);

		        assertNotNull(joinChat, "참여 메시지 저장 실패");
		        log.info("참여 메시지 전송: {}", joinMsg);
		    }

		    // 8. 채팅방 참여자 수 검증
		    List<Integer> updatedParticipantIds = chatRoomService.getParticipantIds(chatRoomId);
		    for (User invited : selectedUsers) {
		        assertTrue(updatedParticipantIds.contains(invited.getId()), "초대한 사용자가 채팅방에 정상적으로 참여해야 함");
		    }
		}
	 
	 
	    @Test
	    @Transactional
	    @DisplayName("채팅방에 파일 또는 이미지 업로드 시 미리보기 기능 테스트")
	    void testFileImageUploadPreviewAndNotification() throws Exception {
	    	// 1. 환경 준비: 채팅방/로그인 사용자(예: 38번) 정보 조회
	        Integer chatRoomId = 4;
	        Integer loginUserId = 38;
	        User loginUser = userRepository.findById(loginUserId).orElseThrow();
	        ChatRoom chatRoom = chatRoomService.findById(chatRoomId);
	        List<Integer> participantIds = chatRoomService.getParticipantIds(chatRoomId);
	        
	        // 2. 이미지 파일 업로드 시나리오
	        // (실제 테스트에서는 MockMultipartFile 사용, 실제 서비스에서는 MultipartFile)
	        MockMultipartFile image = new MockMultipartFile("file", "profile.png", "image/png", new byte[]{/*이미지 바이트*/});
	        String imgKey = s3Service.uploadProfileImage(image, loginUser.getName());
	        String imgUrl = s3Service.getFileUrl(imgKey);
	        
	        // [미리보기] 이미지 선택 시, 프론트엔드에서 이미지 바이트를 바로 미리보기로 보여줌 (생략, 실제 UI)
	        log.info("[미리보기] 이미지 파일명: {}", image.getOriginalFilename());
	        log.info("[미리보기] 이미지 바이트 크기: {}", image.getSize());
	        
	        // [수정] createMessageFile 메서드 파라미터에 맞게 생성
	        MessageFile imgEntity = MessageFile.createMessageFile(
	            image.getOriginalFilename(),
	            (double) image.getSize(),
	            imgKey,
	            null // chat은 sendChatMessage에서 연결됨
	        );

	        // chat과 연결
	        Chat imgChat = chatRoomService.sendChatMessage(chatRoomId, loginUserId, imgEntity);

	        // MessageFile 저장
	        messageFileRepository.save(imgEntity);

	        log.info("[업로드] 이미지 S3 URL: {}", imgUrl);
	        
	        
	        // 4. 채팅방 메시지 오름차순 정렬 및 내/남 메시지 UI 구분
	        List<Chat> messages = chatRepository.findByChatRoomIdOrderBySendAtAsc(chatRoomId);

	        for (Chat msg : messages) {
	            boolean isMe = msg.getSender() != null && msg.getSender().getId().equals(loginUserId);
	            String display = "";

	            // 파일/이미지 메시지
	            if (msg.getFileYn() != null && msg.getFileYn()) {
	                List<MessageFile> files = msg.getMessageFiles();
	                String fileName = (files != null && !files.isEmpty() && files.get(0).getFileName() != null) ? files.get(0).getFileName() : "파일명 없음";
	                String fileUrlMsg = (msg.getFileUrl() != null) ? msg.getFileUrl() : "";
	                if (isMe) {
	                    display = "[오른쪽] 파일/이미지: " + fileName + " (" + fileUrlMsg + ")";
	                } else {
	                    display = "[왼쪽] " + msg.getSender().getName() + ": 파일/이미지 " + fileName + " (" + fileUrlMsg + ")";
	                }
	            }
	            // 텍스트 메시지
	            else if (msg.getMessageContent() != null && !msg.getMessageContent().isBlank()) {
	                if (isMe) {
	                    display = "[오른쪽] " + msg.getMessageContent();
	                } else {
	                    display = "[왼쪽] " + msg.getSender().getName() + ": " + msg.getMessageContent();
	                }
	            }
	            log.info("[{}] {}", msg.getSendAt(), display);
	        }

	        // 5. 업로드/메시지 전송 후, 접속중 아닌 다른 참여자에게 실시간 알림
	       // List<Integer> onlineUserIds = /* WebSocketDeliveryService.getOnlineUserIds() 등으로 현재 접속자 조회 */;
	     // 모든 참여자를 오프라인으로 가정
	        List<Integer> onlineUserIds = new ArrayList<>();
	        List<Integer> offlineUserIds = participantIds.stream()
	            .filter(uid -> !uid.equals(loginUserId) && !onlineUserIds.contains(uid))
	            .toList();
	         offlineUserIds = participantIds.stream()
	            .filter(uid -> !uid.equals(loginUserId) && (onlineUserIds == null || !onlineUserIds.contains(uid)))
	            .toList();
	        for (Integer offlineUid : offlineUserIds) {
	            User offlineUser = userRepository.findById(offlineUid).orElse(null);
	            if (offlineUser != null) {
	                String notificationMsg = loginUser.getName() + "님으로부터 온 새로운 채팅메시지가 있습니다";
//	                notificationService.sendNotification(
//	                    offlineUid,
//	                    NotificationType.NOTICE,
//	                    notificationMsg,
//	                    null, chatRoomId,
//	                    loginUserId,
//	                    loginUser.getName()
//	                );
	                log.info("[알림] {} -> {}", offlineUser.getName(), notificationMsg);
	            }
	        }
	    }
	    
	    @Test
	    @DisplayName("나에게 온 Email, Approval, Notice, Schedule 관련 알림을 가장 최근에 온 알림만 띄우고 옆에 숫자로 나에게 온 알림 게수 표시해주기")
	    void testLatestUnreadNotificationSummary() {
	    	// 1. 로그인 사용자 정보 조회
	        String email = "choimeeyoung2@gmail.com"; // 실제 테스트 계정
	        User user = userRepository.findByEmail(email)
	                .orElseThrow(() -> new IllegalArgumentException("사용자 없음: " + email));

	        Integer userId = user.getId();
	    	

	        // 2. 나에게 온 알림 중 '안읽은' 것만, 타입 필터링 (EMAIL, NOTICE, APPROVAL, SCHEDULE)
	        List<NotificationType> allowedTypes = List.of(
        	    NotificationType.EMAIL,
        	    NotificationType.NOTICE,
        	    NotificationType.APPROVAL,
        	    NotificationType.SCHEDULE
        	);

        	List<Notification> unreadNotifications = notificationRepository.findUnreadByUserIdAndTypes(userId, allowedTypes);

        	List<Notification> filtered = unreadNotifications.stream()
        	    .filter(n -> allowedTypes.contains(n.getNotificationType()))
        	    .sorted(Comparator.comparing(
        	        Notification::getNotificationSentAt,
        	        Comparator.nullsLast(Comparator.naturalOrder()) // << Null-safe 정렬!
        	    ).reversed())
        	    .toList();

	        // 3. 최신순 정렬
        	filtered = unreadNotifications.stream()
        		    .filter(n -> allowedTypes.contains(n.getNotificationType()))
        		    .sorted(Comparator.comparing(
        		        Notification::getNotificationSentAt,
        		        Comparator.nullsLast(Comparator.naturalOrder())
        		    ).reversed())
        		    .toList();

	        int unreadCount = filtered.size();
	    	
	        // 4. 종모양 옆에 개수 표시 검증
	        log.info("안읽은 알림 개수: {}", unreadCount);
	        assertTrue(unreadCount >= 0);

	        // 5. 알림창(토스트)에 가장 최근 알림 한 개만 띄움
	        if (!filtered.isEmpty()) {
	            Notification latest = filtered.get(0);
	            String senderName = latest.getUser() != null ? latest.getUser().getName() : "알수없음";
	            String message = latest.getNotificationMessage();
	            String dateStr = latest.getNotificationSentAt() != null
	                ? latest.getNotificationSentAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd H HH:mm:ss"))
	                : "날짜없음";
	            log.info("알림 토스트: 보낸사람: {}, 내용: {}, 날짜: {}", senderName, message, dateStr);

	            // 실제 UI에서는 이 정보를 Toast 메시지로 출력
	            assertNotNull(message);
	        }

	        // 6. 종모양 클릭 시, 최신순으로 모든 안읽은 알림을 토스트로 표시
	        for (Notification n : filtered) {
	            String senderName = n.getUser() != null ? n.getUser().getName() : "알수없음";
	            String message = n.getNotificationMessage();
	            String dateStr = n.getNotificationSentAt() != null
	                ? n.getNotificationSentAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd H HH:mm:ss"))
	                : "날짜없음";
	            log.info("알림: 보낸사람: {}, 내용: {}, 날짜: {}", senderName, message, dateStr);
	            assertNotNull(message);
	        }
	    }
	    
	    @Test
	    @Transactional
	    @DisplayName("채팅메시지에 온 안읽은 메시지를 토스트 메시지로 표시")
	    void testUnreadChatToastMessage() {
	        // 1. 이메일 로그인 사용자 정보 조회
	        String email = "choimeeyoung2@gmail.com";
	        User user = userRepository.findByEmail(email)
	            .orElseThrow(() -> new IllegalArgumentException("사용자 없음: " + email));
	        Integer userId = user.getId();

	        // 2. 내가 속한 채팅방 목록 조회 (DTO 리스트 반환됨)
	        List<ChatRoomLatestMessageResponseDTO> chatRoomDTOs = chatRoomService.getChatRoomIdsByUserId(userId);

	        // 2-1. roomId 리스트로 변환
	        List<Integer> chatRoomIds = chatRoomDTOs.stream()
	            .map(ChatRoomLatestMessageResponseDTO::getRoomId)
	            .collect(Collectors.toList());

	        // 3. 각 채팅방의 안읽은 메시지 조회 (fetch join으로 sender 미리 로딩)
	        for (Integer roomId : chatRoomIds) {
	            List<Chat> unreadChats = chatRepository.findByChatRoom_IdAndReadYnIsFalseWithSender(roomId);
	            System.out.println("여기 들어옴");
	            System.out.println("unreadChats: " + unreadChats.toString());
	            if (!unreadChats.isEmpty()) {
	                // 3-1. 최신 메시지 한 건
	                Chat latest = unreadChats.stream()
	                    .sorted(Comparator.comparing(Chat::getSendAt, Comparator.nullsLast(Comparator.naturalOrder())).reversed())
	                    .findFirst()
	                    .orElse(null);

	                // 3-2. 안읽은 메시지 개수
	                int unreadCount = unreadChats.size();

	                // 3-3. 토스트 메시지 출력
	                assert latest != null;
	                String senderName = latest.getSender() != null ? latest.getSender().getName() : "알수없음";
	                String content = latest.getMessageContent();
	                String dateStr = latest.getSendAt() != null
	                    ? latest.getSendAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd H HH:mm:ss"))
	                    : "날짜없음";
	                System.out.println("토스트:  " + senderName + " [ " + content + dateStr + " ] " + unreadCount + "개 채팅메시지 알림이 있음");

	                // 4. 토스트 클릭 시, 해당 채팅방의 모든 안읽은 메시지 읽음 처리
	                for (Chat chat : unreadChats) {
	                    chat.markRead();
	                }

	                // 읽음 처리 검증 (fetch join 필요 없음)
	                List<Chat> afterRead = chatRepository.findByChatRoom_IdAndReadYnIsFalseWithSender(roomId);
	                assertTrue(afterRead.isEmpty());
	            }
	        }
	    }
	    
	    

@Test
@DisplayName("사용자가 채팅방을 선택해서 채팅방에 메시지 전송시 다른 사용자들이 접속중이 아닌 경우 안읽은 사람 수 표시해주기")
void testSendChatMessageAndUnreadStatus() {
    // 1. 사용자가 로그인을 한다
    String email = "choimeeyoung2@gmail.com";
    User user = userRepository.findByEmail(email)
        .orElseThrow(() -> new IllegalArgumentException("사용자 없음: " + email));
    Integer userId = user.getId();

    // 2. 내가 참여중인 채팅방 목록을 보여준다
    List<ChatRoomLatestMessageResponseDTO> chatRoomDTOs = chatRoomService.getChatRoomIdsByUserId(userId);
    assertFalse(chatRoomDTOs.isEmpty());

    // 3. 채팅방 하나 선택(첫번째 방)
    Integer roomId = chatRoomDTOs.get(0).getRoomId(); // 첫번째 방의 roomId (예시로 0번째 인덱스)
    ChatRoom chatRoom = chatRoomService.findById(roomId);

    // 4. 메시지 전송
    String message = "테스트 메시지 전송7";
    Chat sentChat = chatRoomService.sendChatMessage(roomId, userId, message);

    // 5. 채팅방의 참여자 목록 조회
    List<Integer> participantIds = chatRoomService.getParticipantIds(roomId);

    // 6. 현재 채팅방에 접속중인 사용자 목록 조회 (WebSocketHandler 활용)
    List<Integer> connectedUserIds = chatWebSocketHandler.getConnectedUserIdsInRoom(roomId);

    // 7. 현재 참여자 중 미접속자(알림 받을 대상) 계산
    List<Integer> notConnectedUserIds = participantIds.stream()
        .filter(pid -> !connectedUserIds.contains(pid))
        .collect(Collectors.toList());

    // 8. 미접속자에게 알림 메시지 전송
    for (Integer pid : notConnectedUserIds) {
        String alertMsg = user.getName() + "님으로부터 채팅메시지가 도착했습니다.";
        log.info("[알림] userId {}, message: {}", pid, alertMsg);
    }

    // 9. 미접속자 수(즉, 읽지 않은 인원) 계산
    int unreadCount = notConnectedUserIds.size();

    // 10. 방금 전송한 채팅 메시지의 readYn이 false(0)이면 미읽음 처리
    assertNotNull(sentChat);
    assertFalse(Boolean.TRUE.equals(sentChat.getReadYn())); // 기본값 false 또는 0

    // 11. 화면 표시: 메시지 옆에 "미읽음 X명" 표시
    log.info("미읽음: {}명", unreadCount);

    // 12. 한 명 읽음 처리 후 미읽음
    if (unreadCount > 0) {
        Integer firstUnreadUserId = notConnectedUserIds.get(0);
        sentChat.markRead();
        chatRepository.save(sentChat);
        int newUnreadCount = unreadCount - 1;
        log.info("한 명 읽음 처리 후 미읽음: {}명", newUnreadCount);
    }

    // 13. 채팅 메시지 정렬 검증
    List<Chat> chats = chatRepository.findByChatRoomIdOrderBySendAtAsc(roomId);
    for (Chat c : chats) {
        String align = c.getSender().getId().equals(userId) ? "오른쪽" : "왼쪽";
        log.info("채팅[{}] - 정렬: {}, 시간: {}", c.getMessageContent(), align, c.getSendAt());
    }
}
	 
	 
}
