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
