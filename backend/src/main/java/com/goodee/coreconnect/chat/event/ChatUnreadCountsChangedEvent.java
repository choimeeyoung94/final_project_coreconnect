package com.goodee.coreconnect.chat.event;

import java.util.List;

/**
 * 메시지들의 "안 읽은 수"가 바뀜 (예: 안 읽고 방을 나간 사람의 읽음 상태 삭제)
 * - 커밋 뒤 ChatUnreadCountsChangedListener가 방에 UNREAD_COUNT_UPDATE를 보냄
 */
public record ChatUnreadCountsChangedEvent(Integer roomId, List<Integer> chatIds) {
}
