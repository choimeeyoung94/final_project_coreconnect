package com.goodee.coreconnect.chat.entity;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import com.goodee.coreconnect.common.entity.Notification;
import com.goodee.coreconnect.user.entity.User;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Builder.Default;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(
    name = "chat_message",
    indexes = {
        // ⭐ 채팅방별 메시지 조회 최적화 (가장 많이 사용되는 조회 패턴)
        @Index(name = "idx_chat_room_sent_at", columnList = "chat_room_id, sent_at DESC"),
        
        // ⭐ 발신자별 메시지 조회 최적화
        @Index(name = "idx_sender_sent_at", columnList = "sender_id, sent_at DESC"),
        
        // ⭐ 읽지 않은 메시지 조회 최적화
        @Index(name = "idx_chat_room_read_yn", columnList = "chat_room_id, read_yn, sent_at DESC"),
        
        // ⭐ 전체 메시지 시간순 조회 최적화
        @Index(name = "idx_sent_at", columnList = "sent_at DESC")
    }
)
public class Chat {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Integer id;

	@Column(name = "message_content")
	private String messageContent;
	
	@Column(name = "sent_at")
	private LocalDateTime sendAt;
	
	@Column(name = "file_yn")
	private Boolean fileYn;
	
	@Column(name = "file_url")
	private String fileUrl;
	
	// N : 1 관계 매핑 (채팅방 테이블과 매핑)
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "chat_room_id")
	private ChatRoom chatRoom;
	
	@Column(name = "read_yn")
	private Boolean readYn;
	
	@Column(name = "unread_count")
	@Builder.Default
    private Integer unreadCount = 0; // 기본값 0
	
	// 1 : N 관계 (채팅메시지파일 테이블과 매핑)
	// 파일은 Chat에 종속된 데잋터여서 Chat이 없으면 의미가 없어서 고아 데이터가 되는 것을 
	// 방지하기 위해 cascadeType.ALL을 쓴다
	@OneToMany(mappedBy = "chat", cascade = CascadeType.ALL)
	@Builder.Default
	private List<MessageFile> messageFiles = new ArrayList<>();
	
	// 1 : N 관계 (알람 테이블과 매핑)
	// 알람은 Chat에 종속된 데이터여서 Chat이 없으면 의미가 없어서 고아 데이터가 된느 것을 방지하기 위해 cascadeType.ALL을 쓴다
	@OneToMany(mappedBy = "chat", cascade = CascadeType.ALL)
	@Builder.Default
	private List<Notification> alarms = new ArrayList<>();
	
	// N : 1 관계 (user 테이블과 매핑, 메시지의 발신자)
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "sender_id")
	private User sender;
	
	// ⭐ 정적 팩토리 메서드 (기존 호환성 유지)
	public static Chat createChat(ChatRoom chatRoom, User sender, String messageContent, Boolean fileYn, String fileUrl, LocalDateTime sendAt) {
		return Chat.builder()
			.chatRoom(chatRoom)
			.sender(sender)
			.messageContent(messageContent)
			.fileYn(fileYn)
			.fileUrl(fileUrl)
			.sendAt(sendAt)
			.unreadCount(0)
			.readYn(false)
			.messageFiles(new ArrayList<>())
			.alarms(new ArrayList<>())
			.build();
	}
	
	// ⭐ 읽음 상태 변경 도메인 메서드
    public void markRead() {
        this.readYn = true;
    }
    
    // ⭐ unreadCount 업데이트 도메인 메서드
    public void updateUnreadCount(Integer unreadCount) {
        this.unreadCount = unreadCount;
    }
    
    // ⭐ 파일 정보 업데이트 도메인 메서드
    public void updateFileInfo(Boolean fileYn, String fileUrl) {
        this.fileYn = fileYn;
        this.fileUrl = fileUrl;
    }
    
    // ⭐ 파일 정보 업데이트 도메인 메서드 (fileYn만)
    public void updateFileYn(Boolean fileYn) {
        this.fileYn = fileYn;
    }
    
    // ⭐ 파일 URL 업데이트 도메인 메서드
    public void updateFileUrl(String fileUrl) {
        this.fileUrl = fileUrl;
    }
    
    // ⭐ 메시지 내용 업데이트 도메인 메서드 (초대 메시지를 입장 메시지로 변경용)
    public void updateMessageContent(String messageContent) {
        this.messageContent = messageContent;
    }
}
