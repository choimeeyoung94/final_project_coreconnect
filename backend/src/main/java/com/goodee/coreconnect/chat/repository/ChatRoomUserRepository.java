package com.goodee.coreconnect.chat.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.goodee.coreconnect.chat.entity.ChatRoomUser;

@Repository
public interface ChatRoomUserRepository extends JpaRepository<ChatRoomUser, Integer> {
	
	// ⭐ N+1 문제 해결: User와 Department를 함께 Fetch Join
	@EntityGraph(attributePaths = {"user", "user.department"})
	@Query("SELECT cru FROM ChatRoomUser cru WHERE cru.chatRoom.id = :chatRoomId")
	List<ChatRoomUser> findByChatRoomId(@Param("chatRoomId") Integer chatRoomId);

	// ⭐ 채팅방과 함께 즉시 로딩
	@EntityGraph(attributePaths = {"chatRoom"})
	List<ChatRoomUser> findByUserId(Integer userId);
	
	/**
	 * ⭐ 특정 채팅방에 특정 사용자가 참여하고 있는지 조회
	 * - 채팅방 퇴장 및 중복 초대 방지에 사용
	 */
	Optional<ChatRoomUser> findByChatRoomIdAndUserId(Integer chatRoomId, Integer userId);

	/** 채팅방 참여 여부 (권한 확인용, 엔티티를 읽지 않고 존재만 확인) */
	boolean existsByChatRoomIdAndUserId(Integer chatRoomId, Integer userId);

	/** 참여 행 하나 (유니크 제약이 없어 중복 행이 있어도 오류 없이 가장 최근 행) */
	Optional<ChatRoomUser> findFirstByChatRoomIdAndUserIdOrderByIdDesc(Integer chatRoomId, Integer userId);

	/** 방 참여자 id 목록 (ChatRoomMemberCache가 방 단위로 한 번에 읽어 캐시) */
	@Query("SELECT cru.user.id FROM ChatRoomUser cru WHERE cru.chatRoom.id = :chatRoomId")
	List<Integer> findUserIdsByChatRoomId(@Param("chatRoomId") Integer chatRoomId);

	/** 여러 방의 (방 id, 참여자 id) 목록. 나간 사람 표시("알 수 없음")를 방 목록에서 한 번에 판단할 때 사용 */
	@Query("SELECT cru.chatRoom.id, cru.user.id FROM ChatRoomUser cru WHERE cru.chatRoom.id IN :chatRoomIds")
	List<Object[]> findRoomIdAndUserIdByChatRoomIds(@Param("chatRoomIds") List<Integer> chatRoomIds);

	/**
	 * ⭐ 여러 채팅방의 참여자 수를 한 번에 조회
	 * - N+1 문제 해결
	 * - COUNT 최적화
	 */
	@Query("SELECT cru.chatRoom.id, COUNT(cru) FROM ChatRoomUser cru " +
	       "WHERE cru.chatRoom.id IN :roomIds " +
	       "GROUP BY cru.chatRoom.id")
	List<Object[]> countMembersByRoomIds(@Param("roomIds") List<Integer> roomIds);
}
