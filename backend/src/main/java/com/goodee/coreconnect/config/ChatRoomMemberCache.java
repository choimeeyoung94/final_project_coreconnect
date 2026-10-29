package com.goodee.coreconnect.config;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.goodee.coreconnect.chat.event.ChatRoomMembersChangedEvent;
import com.goodee.coreconnect.chat.repository.ChatRoomUserRepository;

import lombok.RequiredArgsConstructor;

/**
 * 방 → 참여자 id 목록 짧은 캐시 (서버 메모리, 방마다 TTL_MILLIS 동안 유지)
 *
 * - ChatRoomOutboundInterceptor가 메시지를 연결마다 내보낼 때 쓰는 참여자 확인용
 *   캐시가 없으면 받는 연결 수만큼 DB 조회가 생김(참여자 50명 방 → 메시지 1건당 50번)
 * - 방 만들기·초대·나가기가 커밋되면 ChatRoomMembersChangedEvent로 그 방 캐시를 바로 비움
 *   → 같은 서버에서는 나간 즉시 막힘
 * - 캐시 목록에 없는 사람은 DB를 한 번 더 확인함 → 다른 서버에서 초대된 새 참여자는 바로 받음 (메시지 유실 없음)
 * - 한계: 서버가 여러 대면 다른 서버에서 나간 사람은 그 서버 캐시가 끝날 때(TTL_MILLIS)까지 계속 받을 수 있음
 */
@Component
@RequiredArgsConstructor
public class ChatRoomMemberCache {

  static final long TTL_MILLIS = 5_000;

  private record Entry(Set<Integer> memberIds, long expiresAt) {}

  private final ChatRoomUserRepository chatRoomUserRepository;
  private final Map<Integer, Entry> entries = new ConcurrentHashMap<>();

  public boolean isMember(Integer roomId, Integer userId) {
    if (roomId == null || userId == null) {
      return false;
    }
    long now = System.currentTimeMillis();
    Entry entry = entries.compute(roomId, (id, cached) -> (cached != null && cached.expiresAt() > now)
        ? cached
        : new Entry(Set.copyOf(chatRoomUserRepository.findUserIdsByChatRoomId(id)), now + TTL_MILLIS));
    if (entry.memberIds().contains(userId)) {
      return true;
    }
    // 캐시에 없으면 DB를 한 번 더 봄: 다른 서버에서 방금 초대된 사람이 캐시가 끝날 때까지 메시지를 놓치지 않게
    // (이 서버는 초대 이벤트를 못 받아 캐시가 이전 목록일 수 있음). 평소 참여자는 위에서 끝나므로 DB 조회 없음
    boolean member = chatRoomUserRepository.existsByChatRoomIdAndUserId(roomId, userId);
    if (member) {
      evict(roomId); // 다음 메시지부터 새 목록을 읽음
    }
    return member;
  }

  public void evict(Integer roomId) {
    if (roomId != null) {
      entries.remove(roomId);
    }
  }

  /** 참여자 변경이 커밋된 뒤에만 비움 (커밋 전에 비우면 다른 요청이 이전 목록을 다시 읽어 넣을 수 있음) */
  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
  public void onMembersChanged(ChatRoomMembersChangedEvent event) {
    evict(event.roomId());
  }
}
