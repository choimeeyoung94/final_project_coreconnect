package com.goodee.coreconnect.chat.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.goodee.coreconnect.chat.entity.ChatRoomUser;

public interface ChatRoomUserRepository extends JpaRepository<ChatRoomUser, Integer> {
	List<ChatRoomUser> findByChatRoomId(Integer chatRoomId);
}
