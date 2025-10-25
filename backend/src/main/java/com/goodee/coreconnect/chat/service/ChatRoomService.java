package com.goodee.coreconnect.chat.service;

import java.util.List;

public interface ChatRoomService {

	// 채팅방 참여자 user_id 리스트 반환
	List<Integer> getParticipantIds(Integer roomId);
	
	// 메시지 저장 및 알림 생성
	void saveMessageAndAlarm(Integer roomId, Integer senderId, String chatContent);
	
	// 채팅방의 참여자 email 리스트 반환
	List<String> getParticipantEmail(Integer roomId);
}
