package com.goodee.coreconnect.chat.service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 채팅방 관련 카운트를 Redis에 캐싱하여 성능 최적화
 * - 안읽은 메시지 개수
 * - 참여자 수
 * - COUNT 쿼리 최소화
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatRoomCacheService {

    private final RedisTemplate<String, Object> redisTemplate;
    
    // Redis Key 패턴
    private static final String UNREAD_COUNT_KEY = "chat:unread:%d:%d";      // userId:roomId
    private static final String MEMBER_COUNT_KEY = "chat:members:%d";         // roomId
    private static final String USER_UNREAD_ALL_KEY = "chat:unread:user:%d"; // userId의 모든 방 unread
    
    // TTL 설정
    private static final long UNREAD_TTL_MINUTES = 10;   // 10분
    private static final long MEMBER_TTL_MINUTES = 30;   // 30분

    // ================================================================
    // 1. 안읽은 메시지 개수 캐싱
    // ================================================================

    /**
     * 특정 사용자의 특정 채팅방 안읽은 메시지 개수 조회
     * - Cache Hit: Redis에서 즉시 반환 (~1ms)
     * - Cache Miss: null 반환 (Service에서 DB 조회 후 캐시)
     */
    public Integer getUnreadCount(Integer userId, Integer roomId) {
        String key = String.format(UNREAD_COUNT_KEY, userId, roomId);
        Object value = redisTemplate.opsForValue().get(key);
        
        if (value != null) {
            log.debug("📦 [Cache Hit] UnreadCount - userId: {}, roomId: {}, count: {}", 
                userId, roomId, value);
            return (Integer) value;
        }
        
        log.debug("❌ [Cache Miss] UnreadCount - userId: {}, roomId: {}", userId, roomId);
        return null;
    }

    /**
     * 안읽은 메시지 개수 캐시 저장
     */
    public void setUnreadCount(Integer userId, Integer roomId, Integer count) {
        String key = String.format(UNREAD_COUNT_KEY, userId, roomId);
        redisTemplate.opsForValue().set(key, count, UNREAD_TTL_MINUTES, TimeUnit.MINUTES);
        log.debug("💾 [Cache Set] UnreadCount - userId: {}, roomId: {}, count: {}", 
            userId, roomId, count);
    }

    /**
     * 안읽은 메시지 개수 증가 (메시지 전송 시)
     */
    public void incrementUnreadCount(Integer userId, Integer roomId) {
        String key = String.format(UNREAD_COUNT_KEY, userId, roomId);
        
        // 기존 값이 있으면 증가, 없으면 1로 설정
        Integer currentCount = (Integer) redisTemplate.opsForValue().get(key);
        if (currentCount != null) {
            redisTemplate.opsForValue().increment(key);
            redisTemplate.expire(key, UNREAD_TTL_MINUTES, TimeUnit.MINUTES);
            log.debug("➕ [Cache Increment] UnreadCount - userId: {}, roomId: {}, newCount: {}", 
                userId, roomId, currentCount + 1);
        } else {
            // 캐시가 없으면 1로 초기화
            setUnreadCount(userId, roomId, 1);
        }
    }

    /**
     * 안읽은 메시지 개수 초기화 (메시지 읽음 처리 시)
     */
    public void resetUnreadCount(Integer userId, Integer roomId) {
        String key = String.format(UNREAD_COUNT_KEY, userId, roomId);
        redisTemplate.delete(key);
        log.debug("🗑️  [Cache Delete] UnreadCount - userId: {}, roomId: {}", userId, roomId);
    }

    /**
     * 사용자의 모든 채팅방 안읽은 메시지 개수 조회
     * - 각 방별로 캐시 조회
     * - Cache Miss인 방은 null로 반환 (Service에서 DB 조회)
     */
    public Map<Integer, Integer> getAllUnreadCounts(Integer userId, List<Integer> roomIds) {
        Map<Integer, Integer> result = new HashMap<>();
        
        for (Integer roomId : roomIds) {
            Integer count = getUnreadCount(userId, roomId);
            result.put(roomId, count);  // null이면 null로 저장
        }
        
        long cacheHits = result.values().stream().filter(v -> v != null).count();
        long cacheMisses = result.values().stream().filter(v -> v == null).count();
        
        log.debug("📊 [Cache Stats] UnreadCount All - userId: {}, hits: {}, misses: {}", 
            userId, cacheHits, cacheMisses);
        
        return result;
    }

    /**
     * 여러 방의 안읽은 메시지 개수 일괄 저장
     */
    public void setAllUnreadCounts(Integer userId, Map<Integer, Integer> counts) {
        counts.forEach((roomId, count) -> setUnreadCount(userId, roomId, count));
        log.debug("💾 [Cache Bulk Set] UnreadCount - userId: {}, rooms: {}", 
            userId, counts.size());
    }

    // ================================================================
    // 2. 참여자 수 캐싱
    // ================================================================

    /**
     * 채팅방 참여자 수 조회
     */
    public Integer getMemberCount(Integer roomId) {
        String key = String.format(MEMBER_COUNT_KEY, roomId);
        Object value = redisTemplate.opsForValue().get(key);
        
        if (value != null) {
            log.debug("📦 [Cache Hit] MemberCount - roomId: {}, count: {}", roomId, value);
            return (Integer) value;
        }
        
        log.debug("❌ [Cache Miss] MemberCount - roomId: {}", roomId);
        return null;
    }

    /**
     * 채팅방 참여자 수 저장
     */
    public void setMemberCount(Integer roomId, Integer count) {
        String key = String.format(MEMBER_COUNT_KEY, roomId);
        redisTemplate.opsForValue().set(key, count, MEMBER_TTL_MINUTES, TimeUnit.MINUTES);
        log.debug("💾 [Cache Set] MemberCount - roomId: {}, count: {}", roomId, count);
    }

    /**
     * 여러 방의 참여자 수 조회
     */
    public Map<Integer, Integer> getAllMemberCounts(List<Integer> roomIds) {
        Map<Integer, Integer> result = new HashMap<>();
        
        for (Integer roomId : roomIds) {
            Integer count = getMemberCount(roomId);
            result.put(roomId, count);
        }
        
        return result;
    }

    /**
     * 여러 방의 참여자 수 일괄 저장
     */
    public void setAllMemberCounts(Map<Integer, Integer> counts) {
        counts.forEach(this::setMemberCount);
        log.debug("💾 [Cache Bulk Set] MemberCount - rooms: {}", counts.size());
    }

    /**
     * 참여자 수 증가 (사용자 추가 시)
     */
    public void incrementMemberCount(Integer roomId) {
        String key = String.format(MEMBER_COUNT_KEY, roomId);
        
        Integer currentCount = (Integer) redisTemplate.opsForValue().get(key);
        if (currentCount != null) {
            redisTemplate.opsForValue().increment(key);
            redisTemplate.expire(key, MEMBER_TTL_MINUTES, TimeUnit.MINUTES);
            log.debug("➕ [Cache Increment] MemberCount - roomId: {}, newCount: {}", 
                roomId, currentCount + 1);
        }
    }

    /**
     * 참여자 수 감소 (사용자 퇴장 시)
     */
    public void decrementMemberCount(Integer roomId) {
        String key = String.format(MEMBER_COUNT_KEY, roomId);
        
        Integer currentCount = (Integer) redisTemplate.opsForValue().get(key);
        if (currentCount != null && currentCount > 0) {
            redisTemplate.opsForValue().decrement(key);
            redisTemplate.expire(key, MEMBER_TTL_MINUTES, TimeUnit.MINUTES);
            log.debug("➖ [Cache Decrement] MemberCount - roomId: {}, newCount: {}", 
                roomId, currentCount - 1);
        }
    }

    /**
     * 참여자 수 캐시 무효화
     */
    public void invalidateMemberCount(Integer roomId) {
        String key = String.format(MEMBER_COUNT_KEY, roomId);
        redisTemplate.delete(key);
        log.debug("🗑️  [Cache Delete] MemberCount - roomId: {}", roomId);
    }

    // ================================================================
    // 3. 캐시 관리
    // ================================================================

    /**
     * 특정 채팅방의 모든 캐시 무효화
     */
    public void invalidateRoom(Integer roomId) {
        // 참여자 수 캐시 삭제
        invalidateMemberCount(roomId);
        
        // 해당 방의 모든 unreadCount 캐시 삭제는 패턴 매칭 필요
        // (선택사항: 모든 사용자의 unreadCount를 지우는 것은 비효율적)
        log.debug("🗑️  [Cache Invalidate] Room - roomId: {}", roomId);
    }

    /**
     * 특정 사용자의 모든 캐시 무효화
     */
    public void invalidateUser(Integer userId) {
        // 패턴 매칭으로 해당 사용자의 모든 unreadCount 캐시 삭제
        String pattern = String.format("chat:unread:%d:*", userId);
        
        redisTemplate.keys(pattern).forEach(key -> {
            redisTemplate.delete(key);
            log.debug("🗑️  [Cache Delete] Key: {}", key);
        });
        
        log.debug("🗑️  [Cache Invalidate] User - userId: {}", userId);
    }
}




