package com.goodee.coreconnect.chat.service;

import java.util.List;

import com.goodee.coreconnect.approval.entity.Document;
import com.goodee.coreconnect.chat.dto.response.ChatResponseDTO;
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

    /** 채팅방에서 현재 접속 중인 인원 id 리스트 반환 */
    List<Integer> getConnectedUserIdsInRoom(Integer roomId);

    /** 각 메시지별 안읽은 인원 수 DB 업데이트(필요시 사용) */
    void updateUnreadCountForMessages(Integer roomId);
    
    List<UnreadNotificationListDTO> getUnreadNotificationsExceptLatest(Integer userId, List<NotificationType> allowedTypes);
    
    ChatResponseDTO saveChatAndReturnDTO(Integer roomId, Integer senderId, String content, int unreadCount);

    String getUnreadToadMsgForUser(Integer offlineUserId);

    // 채팅 메시지에 파일이 있는 경우 파일을 조회
    List<Chat> getChatsWithFilesByRoomId(Integer roomId);
    
    // 채팅 메시지를 페이징으로 조회 (파일 포함)
    org.springframework.data.domain.Page<Chat> getChatsWithFilesByRoomIdPaged(Integer roomId, org.springframework.data.domain.Pageable pageable);
    
    boolean existsRoom(Integer roomId);
    
    // user 참여 chatRoom 목록 가져오기
    List<ChatRoomListDTO> getChatRoomListWithUnreadCount(Integer userId);

	boolean existsByRoomId(Integer roomId);

	// 채팅방 나가기
	void leaveChatRoom(Integer roomId, String userEmail);

}
