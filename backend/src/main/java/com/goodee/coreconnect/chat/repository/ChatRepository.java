package com.goodee.coreconnect.chat.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.goodee.coreconnect.chat.entity.Chat;


public interface ChatRepository extends JpaRepository<Chat, Integer> {

    // 1. 채팅방의 모든 메시지 (N+1 해결: sender와 chatRoom Fetch Join)
    @EntityGraph(attributePaths = {"sender", "chatRoom"})
    @Query("SELECT c FROM Chat c WHERE c.chatRoom.id = :roomId ORDER BY c.sendAt ASC")
    List<Chat> findByChatRoomId(@Param("roomId") Integer roomId);

    // 2. 여러 채팅방의 모든 메시지 (sender도 함께 로드)
    @EntityGraph(attributePaths = {"sender", "chatRoom"})
    @Query("SELECT c FROM Chat c WHERE c.chatRoom.id IN :roomIds")
    List<Chat> findByChatRoomIds(@Param("roomIds") List<Integer> roomIds);

    // 3. 채팅방의 모든 메시지(오름차순)
    @EntityGraph(attributePaths = {"sender", "chatRoom"})
    List<Chat> findByChatRoomIdOrderBySendAtAsc(Integer roomId);

    // 채팅방의 안읽은 메시지(모든 참여자 기준)
    //List<Chat> findByChatRoom_IdAndReadYnIsFalse(Integer chatRoomId);

    // JPQL로 직접 작성 (추천)
    //@Query("SELECT c FROM Chat c WHERE c.chatRoom.id = :roomId AND c.readYn = false")
    //List<Chat> findUnreadChatsByRoomId(@Param("roomId") Integer roomId);

    //List<Chat> findByChatRoom_IdAndReadYnIsFalse(Integer chatRoomId);
    
    // 4. 특정 채팅방에서 아직 읽지 않은 채팅 메시지 들을 메시지의 발신자 정보까지 즉시로딩해서 리스트로 반환
    @Query("SELECT c FROM Chat c JOIN FETCH c.sender WHERE c.chatRoom.id = :roomId AND c.readYn = false")
    List<Chat> findByChatRoom_IdAndReadYnIsFalseWithSender(@Param("roomId") Integer chatRoomId);
    
    // 5. 내가 참여중인 채팅방들의 마지막 메시지만 조회
    // ⭐ N+1 문제 해결: sender와 chatRoom을 함께 Fetch Join
    @Query("SELECT c FROM Chat c " +
           "LEFT JOIN FETCH c.sender " +
           "LEFT JOIN FETCH c.chatRoom " +
           "WHERE c.chatRoom.id IN :roomIds " +
           "AND c.sendAt = (SELECT MAX(c2.sendAt) FROM Chat c2 WHERE c2.chatRoom.id = c.chatRoom.id)")
    List<Chat> findLatestMessageByChatRoomIds(@Param("roomIds") List<Integer> roomIds);

    // 6. 채팅방 내에서 특정 메시지의 미읽은 인원 조회 (ChatMessageReadStatus 활용)
    // ⭐ 복합키 사용으로 COUNT(r) 대신 COUNT(1) 사용
    @Query("SELECT r.chat.id, COUNT(1) FROM ChatMessageReadStatus r WHERE r.chat.chatRoom.id = :roomId AND r.readYn = false GROUP BY r.chat.id")
    List<Object[]> countUnreadByRoomId(@Param("roomId") Integer roomId);
    
    // 7. 각 채팅방의 가장 마지막(최신) 메시지
    // ⭐ N+1 문제 해결: sender와 chatRoom을 함께 Fetch Join
    @Query("SELECT c FROM Chat c " +
           "LEFT JOIN FETCH c.sender " +
           "LEFT JOIN FETCH c.chatRoom " +
           "WHERE c.chatRoom.id IN :roomIds " +
           "AND c.sendAt = (SELECT MAX(c2.sendAt) FROM Chat c2 WHERE c2.chatRoom.id = c.chatRoom.id)")
    List<Chat> findLatestMessagesByRoomIds(@Param("roomIds") List<Integer> roomIds);

    /**
     * 채팅방 목록 조회 시 최신 메시지만 페이징으로 가져오기 (Top-N)
     * - 페이로드/쿼리 부하를 줄이기 위해 Pageable(limit/offset) 적용
     * - 기존 전체 조회 대비 DB/네트워크 비용 감소
     *
     * 주의: fetch join + pagination 조합은 JPA 구현체에 따라 경고가 날 수 있으므로,
     *      부하가 크거나 정밀한 튜닝이 필요하면 Projection + 별도 쿼리로 분리 검토.
     */
    @EntityGraph(attributePaths = {"sender", "chatRoom"})
    @Query("SELECT c FROM Chat c " +
           "WHERE c.chatRoom.id IN :roomIds " +
           "AND c.sendAt = (SELECT MAX(c2.sendAt) FROM Chat c2 WHERE c2.chatRoom.id = c.chatRoom.id)")
    Page<Chat> findLatestMessagesByRoomIdsPaged(@Param("roomIds") List<Integer> roomIds, Pageable pageable);
    
    
    // 8. 채팅방에서 메시지를 불러올때 파일이 있는 경우 파일들도 함께 조회
    @Query("SELECT DISTINCT c FROM Chat c " + 
    	   "LEFT JOIN FETCH c.messageFiles " + 
    	   "LEFT JOIN FETCH c.sender " +
    		"WHERE c.chatRoom.id = :roomId " + 
    	   "ORDER BY c.sendAt ASC")
    List<Chat> findAllChatsWithFilesByRoomId(@Param("roomId") Integer roomId);
    
    // 8-1. 메시지 목록 1단계: 최신 메시지 id (첫 화면, 최신순). 컬렉션 fetch join이 없어서 SQL에 LIMIT이 붙음
    // 같은 시각 메시지는 id로 순서를 고정 → 커서로 넘겨도 중복·빠짐 없음
    // 인덱스 idx_chat_room_sent_at_id (chat_room_id, sent_at, id)를 거꾸로 읽다가 LIMIT에서 멈춤
    @Query("SELECT c.id FROM Chat c " +
           "WHERE c.chatRoom.id = :roomId " +
           "AND (:joinedAt IS NULL OR c.sendAt >= :joinedAt) " +
           "ORDER BY c.sendAt DESC, c.id DESC")
    List<Integer> findLatestMessageIds(@Param("roomId") Integer roomId, @Param("joinedAt") LocalDateTime joinedAt, Pageable pageable);

    // 8-2. 커서 before: (sentAt, id) 메시지보다 이전 메시지 id (최신순). 몇 번째 페이지든 인덱스에서 그 위치부터 읽음
    @Query("SELECT c.id FROM Chat c " +
           "WHERE c.chatRoom.id = :roomId " +
           "AND (:joinedAt IS NULL OR c.sendAt >= :joinedAt) " +
           "AND (c.sendAt < :sentAt OR (c.sendAt = :sentAt AND c.id < :id)) " +
           "ORDER BY c.sendAt DESC, c.id DESC")
    List<Integer> findMessageIdsBefore(@Param("roomId") Integer roomId, @Param("joinedAt") LocalDateTime joinedAt,
                                       @Param("sentAt") LocalDateTime sentAt, @Param("id") Integer id, Pageable pageable);

    // 8-3. 커서 after: (sentAt, id) 메시지보다 뒤 메시지 id (오래된 순). 연결이 끊긴 동안 놓친 메시지 받아 오기
    @Query("SELECT c.id FROM Chat c " +
           "WHERE c.chatRoom.id = :roomId " +
           "AND (:joinedAt IS NULL OR c.sendAt >= :joinedAt) " +
           "AND (c.sendAt > :sentAt OR (c.sendAt = :sentAt AND c.id > :id)) " +
           "ORDER BY c.sendAt ASC, c.id ASC")
    List<Integer> findMessageIdsAfter(@Param("roomId") Integer roomId, @Param("joinedAt") LocalDateTime joinedAt,
                                      @Param("sentAt") LocalDateTime sentAt, @Param("id") Integer id, Pageable pageable);

    // 8-4. 커서로 받은 메시지의 보낸 시각 (이 방 메시지일 때만)
    @Query("SELECT c.sendAt FROM Chat c WHERE c.id = :id AND c.chatRoom.id = :roomId")
    java.util.Optional<LocalDateTime> findSendAtInRoom(@Param("id") Integer id, @Param("roomId") Integer roomId);

    // 8-5. 메시지 목록 2단계: 1단계 id들의 본문을 방·파일·보낸 사람·부서·프로필까지 한 번에 (순서는 호출한 쪽에서 맞춤)
    // 프로필(User.userDetailProfile)은 mappedBy @OneToOne이라 지연 로딩이 안 되고, 같이 가져오지 않으면 메시지 행마다 따로 조회됨
    // 방(chatRoom)은 DTO가 방 이름을 읽어서 같이 가져옴 (운영은 open-in-view=false라 트랜잭션 밖에서 지연 로딩 불가)
    @Query("SELECT DISTINCT c FROM Chat c " +
           "LEFT JOIN FETCH c.chatRoom " +
           "LEFT JOIN FETCH c.messageFiles " +
           "LEFT JOIN FETCH c.sender s " +
           "LEFT JOIN FETCH s.department " +
           "LEFT JOIN FETCH s.userDetailProfile " +
           "WHERE c.id IN :ids")
    List<Chat> findWithFilesAndSenderByIdIn(@Param("ids") List<Integer> ids);


    /** 
     * 특정 채팅방에서 가장 최근(최신) 1개의 메시지를 반환
     * 최근 메시지가 없다면 null을 리턴합니다.
     */
    @Query("SELECT c FROM Chat c WHERE c.chatRoom.id = :roomId ORDER BY c.sendAt DESC")
    List<Chat> findTopByChatRoomIdOrderBySendAtDesc(@Param("roomId") Integer roomId);

    /**  
     * 단건 반환을 원할 경우 default 메서드 추가 (최신 메시지 1개)
     */
    default Chat findLatestMessageByRoomId(Integer roomId) {
        List<Chat> result = this.findTopByChatRoomIdOrderBySendAtDesc(roomId);
        return (result != null && !result.isEmpty()) ? result.get(0) : null;
    }
    
    
    // 10. 채팅방 목록 불러올 때 unreadcount 필드 채워서 DTO로 변환
    // ⭐ 복합키 사용으로 COUNT(c) 대신 COUNT(1) 사용
    @Query("SELECT c.chat.chatRoom.id AS roomId, COUNT(1) AS unreadCount FROM ChatMessageReadStatus c WHERE c.user.id = :userId AND c.readYn = false GROUP BY c.chat.chatRoom.id")
    List<Object[]> countUnreadMessagesByUserId(@Param("userId") Integer userId);
    
    // 11. 특정 Chat ID로 messageFiles와 sender를 함께 조회
    @Query("SELECT DISTINCT c FROM Chat c " +
           "LEFT JOIN FETCH c.messageFiles " +
           "LEFT JOIN FETCH c.sender " +
           "WHERE c.id = :chatId")
    Chat findByIdWithMessageFiles(@Param("chatId") Integer chatId);
}