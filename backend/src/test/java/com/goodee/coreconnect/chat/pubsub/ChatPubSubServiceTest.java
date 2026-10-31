package com.goodee.coreconnect.chat.pubsub;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.goodee.coreconnect.config.RedisGuard;

/** 채팅 방송이 DB 커밋 뒤에 나가는지 확인한다 */
class ChatPubSubServiceTest {

  @SuppressWarnings("unchecked")
  private final RedisTemplate<String, Object> redisTemplate = mock(RedisTemplate.class);
  private final SimpMessagingTemplate messagingTemplate = mock(SimpMessagingTemplate.class);
  private final ChatPubSubService service = new ChatPubSubService(redisTemplate, messagingTemplate, new RedisGuard());

  @BeforeEach
  void startTransaction() {
    TransactionSynchronizationManager.initSynchronization();
    TransactionSynchronizationManager.setActualTransactionActive(true);
  }

  @AfterEach
  void endTransaction() {
    TransactionSynchronizationManager.setActualTransactionActive(false);
    TransactionSynchronizationManager.clear();
  }

  @Test
  @DisplayName("트랜잭션 안에서 호출하면 커밋 전에는 방송하지 않고 커밋 뒤에 방송한다")
  void publishInTransaction_waitsForCommit() {
    service.publish("/topic/chat.room.1", "메시지");
    verify(redisTemplate, never()).convertAndSend(any(), any());

    TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);

    verify(redisTemplate).convertAndSend(eq(ChatPubSubService.CHANNEL), any(Object.class));
  }

  @Test
  @DisplayName("롤백되면 방송하지 않는다")
  void publishInTransaction_rollback_sendsNothing() {
    service.publish("/topic/chat.room.1", "메시지");

    TransactionSynchronizationManager.getSynchronizations()
        .forEach(sync -> sync.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));

    verify(redisTemplate, never()).convertAndSend(any(), any());
  }

  @Test
  @DisplayName("Redis 발행이 실패하면 이 서버로 보내고, 다음 방송은 Redis를 호출하지 않는다")
  void redisFailure_sendsLocalAndSkipsRedis() {
    TransactionSynchronizationManager.setActualTransactionActive(false);
    given(redisTemplate.convertAndSend(any(), any())).willThrow(new QueryTimeoutException("timeout"));

    service.publish("/topic/chat.room.1", "첫 메시지");
    service.publish("/topic/chat.room.1", "둘째 메시지");

    verify(redisTemplate, times(1)).convertAndSend(any(), any());
    verify(messagingTemplate).convertAndSend("/topic/chat.room.1", (Object) "첫 메시지");
    verify(messagingTemplate).convertAndSend("/topic/chat.room.1", (Object) "둘째 메시지");
  }

  @Test
  @DisplayName("트랜잭션 밖에서 호출하면 바로 방송한다")
  void publishOutsideTransaction_sendsNow() {
    TransactionSynchronizationManager.setActualTransactionActive(false);

    service.publish("/topic/chat.room.1", "메시지");

    verify(redisTemplate).convertAndSend(eq(ChatPubSubService.CHANNEL), any(Object.class));
  }
}
