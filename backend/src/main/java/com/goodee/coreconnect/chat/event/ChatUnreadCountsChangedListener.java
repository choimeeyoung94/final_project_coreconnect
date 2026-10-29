package com.goodee.coreconnect.chat.event;

import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.goodee.coreconnect.chat.pubsub.ChatPubSubService;
import com.goodee.coreconnect.chat.repository.ChatMessageReadStatusRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 안 읽은 수가 바뀐 메시지마다 방 토픽으로 UNREAD_COUNT_UPDATE 전송
 * - 형식은 읽음 처리(ChatMessageController.markRoomMessagesAsRead)와 같음 → 프론트 처리 코드 그대로 사용
 * - 커밋 뒤에만 보냄: 롤백되면 숫자도 안 바뀌었으므로 보내지 않음
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ChatUnreadCountsChangedListener {

	private final ChatMessageReadStatusRepository chatMessageReadStatusRepository;
	private final ChatPubSubService chatPubSubService;

	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
	public void onUnreadCountsChanged(ChatUnreadCountsChangedEvent event) {
		// 방의 메시지별 안 읽은 수를 한 번에 (메시지마다 세지 않음). 목록에 없는 메시지 = 0
		Map<Integer, Long> unreadByChatId = new HashMap<>();
		for (Object[] row : chatMessageReadStatusRepository.countUnreadByRoomId(event.roomId())) {
			unreadByChatId.put((Integer) row[0], (Long) row[1]);
		}
		for (Integer chatId : event.chatIds()) {
			Map<String, Object> update = new HashMap<>();
			update.put("type", "UNREAD_COUNT_UPDATE");
			update.put("chatId", chatId);
			update.put("unreadCount", unreadByChatId.getOrDefault(chatId, 0L).intValue());
			update.put("roomId", event.roomId());
			chatPubSubService.publish("/topic/chat.room." + event.roomId(), update);
		}
		log.debug("[ChatUnreadCountsChanged] roomId: {}, 바뀐 메시지 수: {}", event.roomId(), event.chatIds().size());
	}
}
