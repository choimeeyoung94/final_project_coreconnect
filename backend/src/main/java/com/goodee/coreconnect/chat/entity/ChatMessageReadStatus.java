package com.goodee.coreconnect.chat.entity;

import java.time.LocalDateTime;

import com.goodee.coreconnect.user.entity.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * 채팅 메시지 읽음 상태 엔티티
 * 복합키: (chat_id, user_id)
 * - 하나의 메시지(chat)에 대해 각 참여자(user)별로 읽음 상태를 관리
 * - 동일한 메시지에 대해 여러 참여자가 각각의 읽음 상태를 가질 수 있음
 */
@Entity
@Table(
    name = "chat_message_read_status",
    indexes = {
        // ⭐ 사용자별 읽지 않은 메시지 조회 최적화
        @Index(name = "idx_user_read_yn", columnList = "user_id, chat_message_read_status_read_yn"),
        
        // ⭐ 메시지별 읽음 상태 조회 최적화
        @Index(name = "idx_chat_user", columnList = "chat_message_id, user_id"),
        
        // ⭐ 사용자별 읽은 시간 기준 조회 최적화
        @Index(name = "idx_user_read_at", columnList = "user_id, chat_message_read_status_read_at DESC")
    }
)
@IdClass(ChatMessageReadStatusId.class)
public class ChatMessageReadStatus {
	// ⭐ 복합키: chat_id와 user_id의 조합이 PK
	@Id
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "chat_message_id", nullable = false)
	private Chat chat;
	
	@Id
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	// 읽음 여부
	@Column(name = "chat_message_read_status_read_yn")
	private Boolean readYn = false; // 기본값: 안읽음
	
	// 읽은 시간
	@Column(name = "chat_message_read_status_read_at")
	private LocalDateTime readAt;
	
	// ⭐ chat과 user는 위의 @Id로 이미 정의됨 (복합키)
	
	protected ChatMessageReadStatus() {}
	
	public static ChatMessageReadStatus create(Chat chat, User user) {
		ChatMessageReadStatus status = new ChatMessageReadStatus();
		status.chat = chat;
		status.user = user;
		status.readYn = false;
		status.readAt = null;
		return status;
	}
	
	// 읽음처리
	public void markRead() {
		this.readYn = true;
		this.readAt = LocalDateTime.now();
	}
	
	// ⭐ 읽음 상태 초기화 (새 메시지 생성 시 사용)
	public void resetReadStatus() {
		this.readYn = false;
		this.readAt = null;
	}
	
	// ⭐ setter 추가 (필요시 사용)
	public void setReadYn(Boolean readYn) {
		this.readYn = readYn;
	}
	
	public void setReadAt(LocalDateTime readAt) {
		this.readAt = readAt;
	}
	
	public Chat getChat() {
        return chat;
    }
    public User getUser() {
        return user;
    }
    public Boolean getReadYn() {
        return readYn;
    }
    public LocalDateTime getReadAt() {
        return readAt;
    }
    // ⭐ 복합키 사용으로 id 필드 제거됨
	
    public boolean isConsistentReadStatus() {
	  return (readAt == null && Boolean.FALSE.equals(readYn)) ||
	         (readAt != null && Boolean.TRUE.equals(readYn));
	}
}
