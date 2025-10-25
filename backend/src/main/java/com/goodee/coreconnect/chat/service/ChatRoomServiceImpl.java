package com.goodee.coreconnect.chat.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.goodee.coreconnect.chat.entity.Alarm;
import com.goodee.coreconnect.chat.entity.Chat;
import com.goodee.coreconnect.chat.entity.ChatRoom;
import com.goodee.coreconnect.chat.entity.ChatRoomUser;
import com.goodee.coreconnect.chat.repository.AlarmRepository;
import com.goodee.coreconnect.chat.repository.ChatRepository;
import com.goodee.coreconnect.chat.repository.ChatRoomRepository;
import com.goodee.coreconnect.chat.repository.ChatRoomUserRepository;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ChatRoomServiceImpl implements ChatRoomService {

	private final ChatRoomUserRepository chatRommUserRepository;
	private final ChatRoomRepository chatRoomRepository;
	private final ChatRepository chatRepository;
	private final AlarmRepository alarmRepository;
	private final UserRepository userRepository;

	// 채팅방의 참여자 user_id 리스트 조회
	@Override
	public List<Integer> getParticipantIds(Integer roomId) {
		List<ChatRoomUser> users = chatRommUserRepository.findByChatRoomId(roomId);
		return users.stream()
				.map(chatRoomUser -> chatRoomUser.getUser().getId())
				.collect(Collectors.toList());
	}

	// 메시지 저장 및 알람 생성
	@Override
	public void saveMessageAndAlarm(Integer roomId, Integer senderId, String chatContent) {
		ChatRoom chatRoom = chatRoomRepository.findById(roomId)
				           .orElseThrow(() -> new IllegalArgumentException("채팅방 없음: " + roomId));
		User sender = userRepository.findById(senderId)
	                  .orElseThrow(() -> new IllegalArgumentException("사용자 없음: " + senderId)); 	 
		
	    // 메시지 저장
		Chat chat = new Chat();
		chat.setChatRoom(chatRoom);
		chat.setMessageContent(chatContent);
		chat.setSendAt(LocalDateTime.now());
		chat.setFileYn(false);
		// 메시지 발신자 정보 저장
	    chat.setSender(sender);
		chatRepository.save(chat);
		
		// 참여자 목록 조회 및 알람 생성
		List<ChatRoomUser> participants = chatRommUserRepository.findByChatRoomId(roomId);
		for (ChatRoomUser participant: participants) {
			User receiver = participant.getUser();
			Alarm alarm = new Alarm();
			alarm.setChat(chat);
			alarm.setAlarmType("1:1");
			alarm.setAlarmSentYn(false);
			alarm.setAlarmReadYn(false);
			alarm.setAlarmSentAt(LocalDateTime.now());
			alarm.setAlarmReadAt(null);
			// 메시지 수신자 정보 저장
			alarm.setUser(receiver);
			alarmRepository.save(alarm);
		}
	}

	// 채팅방의 참여자 email 리스트 조회
	@Override
	public List<String> getParticipantEmail(Integer roomId) {
		List<ChatRoomUser> users = chatRommUserRepository.findByChatRoomId(roomId);
		return users.stream()
				.map(chatRoomUser -> chatRoomUser.getUser().getEmail())
				.collect(Collectors.toList());
	}

	
}
