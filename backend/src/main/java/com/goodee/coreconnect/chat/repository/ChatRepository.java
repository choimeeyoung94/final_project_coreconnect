package com.goodee.coreconnect.chat.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.goodee.coreconnect.chat.entity.Chat;

public interface ChatRepository extends JpaRepository<Chat, Integer> {

}
