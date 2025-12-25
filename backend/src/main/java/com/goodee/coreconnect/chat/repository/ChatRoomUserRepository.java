package com.goodee.coreconnect.chat.repository;

import java.util.List;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.goodee.coreconnect.chat.entity.ChatRoomUser;


public interface ChatRoomUserRepository extends JpaRepository<ChatRoomUser, Integer> {
	// ⭐ N+1 해결: user와 chatRoom을 함께 Fetch Join
	@Query("SELECT cru FROM ChatRoomUser cru JOIN FETCH cru.user LEFT JOIN FETCH cru.user.department JOIN FETCH cru.chatRoom WHERE cru.chatRoom.id = :roomId")
	List<ChatRoomUser> findByChatRoomId(@Param("roomId") Integer roomId);
	
	// ⭐ 중복 메서드 제거 (위의 findByChatRoomId와 동일하게 통합)
	// @Query("SELECT cru FROM ChatRoomUser cru JOIN FETCH cru.user LEFT JOIN FETCH cru.user.department WHERE cru.chatRoom.id = :roomId")
	// List<ChatRoomUser> findByChatRoomIdWithUser(@Param("roomId") Integer roomId);
	
	// ⭐ 내가 참여한 모든 채팅방 (N+1 해결: chatRoom, user, department 함께 조회)
	/**
	 * ChatRoomUser 엔티티의 chatRoom이 LAZY 로딩으로 설정되어 있어서, 
	 * 조회 후 getChatRoom()을 호출할 때마다 N+1 문제가 발생합니다. 
	 * JOIN FETCH를 사용하면 한 번의 쿼리로 ChatRoomUser와 ChatRoom을 함께 조회해서 추가 쿼리를 방지할 수 있습니다.
	 */
	@Query("SELECT cru FROM ChatRoomUser cru JOIN FETCH cru.chatRoom JOIN FETCH cru.user LEFT JOIN FETCH cru.user.department WHERE cru.user.id = :userId")
	List<ChatRoomUser> findByUserId(@Param("userId") Integer userId);
	
	// ⭐ 특정 채팅방의 특정 사용자 조회 (N+1 해결: user와 chatRoom Fetch Join)
	@Query("SELECT cru FROM ChatRoomUser cru JOIN FETCH cru.user LEFT JOIN FETCH cru.user.department JOIN FETCH cru.chatRoom WHERE cru.chatRoom.id = :roomId AND cru.user.id = :userId")
	Optional<ChatRoomUser> findByChatRoomIdAndUserId(@Param("roomId") Integer roomId, @Param("userId") Integer userId);
}
