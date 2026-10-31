package com.goodee.coreconnect.chat.service;

import java.util.List;

import com.goodee.coreconnect.approval.entity.Document;
import com.goodee.coreconnect.chat.dto.response.ChatResponseDTO;
import com.goodee.coreconnect.chat.dto.response.ChatRoomLatestMessageDTO;
import com.goodee.coreconnect.chat.dto.response.ChatRoomLatestMessageResponseDTO;
import com.goodee.coreconnect.chat.dto.response.ChatRoomListDTO;
import com.goodee.coreconnect.chat.dto.response.ChatRoomSummaryResponseDTO;
import com.goodee.coreconnect.chat.dto.response.UnreadNotificationListDTO;
import com.goodee.coreconnect.chat.entity.Chat;
import com.goodee.coreconnect.chat.entity.ChatRoom;
import com.goodee.coreconnect.chat.entity.ChatRoomUser;
import com.goodee.coreconnect.common.dto.request.NotificationRequestDTO;
import com.goodee.coreconnect.common.entity.Notification;
import com.goodee.coreconnect.common.notification.enums.NotificationType;
import com.goodee.coreconnect.user.entity.User;

public interface ChatRoomService {

	// 채팅방 참여자 user_id 리스트 반환
	List<Integer> getParticipantIds(Integer roomId);
	
	// 메시지 저장 및 알림 생성
	//void saveMessageAndAlarm(Integer roomId, Integer senderId, String chatContent, NotificationType notificationType);
	
	// 채팅방의 참여자 email 리스트 반환
	List<String> getParticipantEmail(Integer roomId);

	ChatRoom createChatRoom(String string, List<Integer> userIds, String email);

	ChatRoom findById(Integer id);

	/** 방 참여자가 아니면 AccessDeniedException(403) - 방 id로 접근하는 API와 메시지 저장 전에 호출 */
	void assertMember(Integer roomId, Integer userId);

	/** 참여자면 들어온 시각(없으면 null = 전부 보임)을 돌려주고, 아니면 AccessDeniedException */
	java.time.LocalDateTime joinedAtOfMember(Integer roomId, Integer userId);

	/** 방 id → 지금 참여자 id 집합 (쿼리 1번) */
	java.util.Map<Integer, java.util.Set<Integer>> memberIdsByRoom(List<Integer> roomIds);

	/** 방 참여자인지 (STOMP 구독 검사처럼 예외 대신 true/false가 필요한 곳에서 사용) */
	boolean isMember(Integer roomId, Integer userId);

	ChatRoom updateRoomType(int i, String string);
	
	int countUnreadByChatId(Integer chatId);

	// 알림 저장 (EMAIL, NOTICE, APPROVAL, SCHEDULE만 처리)
	List<Notification> saveNotification(
		    Integer roomId, Integer senderId, String chatContent, NotificationType notificationType, Document document);
	
	// 채팅방 참열를 위한 주소록 조회
	List<ChatRoomUser> getChatRoomUsers(Integer roomId);
	
	// 사용자가 참여중인 채팅방 조회
	List<ChatRoomLatestMessageResponseDTO> getChatRoomIdsByUserId(Integer userId);

	void sendNotification(NotificationRequestDTO dto);
	
	/**
	 * 전자결재 문서 삭제시 알림 삭제
	 * */
	void deleteDocumentAndNotification(Integer documentId);
	
	// 채팅 메시지 저장 및 반환 (채팅 알림과 분리)
	Chat sendChatMessage(Integer roomId, Integer senderId, Object contentOrFile);
	
    List<Integer> getLatestMessagesByUserId(Integer userId);
   
    List<Notification> getNotificationsByUserId(Integer userId);
    
    List<Object[]> countUnreadByRoomId(Integer roomId);
    
    List<ChatRoomSummaryResponseDTO> getChatRoomSummariesByUserId(Integer userId);

    // ⭐ 읽음 처리된 메시지 ID 리스트 반환 (WebSocket 알림용)
    List<Integer> markMessagesAsRead(Integer roomId, Integer userId);

    /** upToChatId까지만 읽음 처리한다. 화면이 받지 못한 메시지가 읽음이 되지 않도록 화면이 받은 마지막 번호를 받는다 */
    List<Integer> markMessagesAsRead(Integer roomId, Integer userId, Integer upToChatId);

    /** 채팅방에서 현재 접속 중인 인원 id 리스트 반환 */
    List<Integer> getConnectedUserIdsInRoom(Integer roomId);

    /** 각 메시지별 안읽은 인원 수 DB 업데이트(필요시 사용) */
    void updateUnreadCountForMessages(Integer roomId);
    
    List<UnreadNotificationListDTO> getUnreadNotificationsExceptLatest(Integer userId, List<NotificationType> allowedTypes);
    
    ChatResponseDTO saveChatAndReturnDTO(Integer roomId, Integer senderId, String content, int unreadCount);

    String getUnreadToadMsgForUser(Integer offlineUserId);

    // 채팅 메시지에 파일이 있는 경우 파일을 조회
    List<Chat> getChatsWithFilesByRoomId(Integer roomId);
    
    // 채팅 메시지 목록 한 페이지 (파일·보낸 사람 포함). 최신 / before(이전) / after(이후), 전체 개수는 세지 않음
    org.springframework.data.domain.Slice<Chat> getMessages(Integer roomId, java.time.LocalDateTime joinedAt, int size, Integer before, Integer after);
    
    boolean existsRoom(Integer roomId);
    
    // user 참여 chatRoom 목록 가져오기
    List<ChatRoomListDTO> getChatRoomListWithUnreadCount(Integer userId);

	boolean existsByRoomId(Integer roomId);

	// 채팅방 나가기
	void leaveChatRoom(Integer roomId, String userEmail);

	/**
	 * Top-N 페이징: 최신 메시지 기준으로 채팅방을 페이징 조회 (슬림 DTO)
	 */
    org.springframework.data.domain.Page<ChatRoomLatestMessageDTO> getLatestMessagesPaged(Integer userId, org.springframework.data.domain.Pageable pageable);

}
