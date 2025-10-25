package com.goodee.coreconnect.chat.entity;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "chat_message")
public class Chat {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

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
	
	// 1 : N 관계 (채팅메시지파일 테이블과 매핑)
	@OneToMany(mappedBy = "chat", cascade = CascadeType.ALL)
	private List<MessageFile> messageFiles = new ArrayList<>();
	
	// 1 : N 관계 (알람 테이블과 매핑)
	@OneToMany(mappedBy = "chat", cascade = CascadeType.ALL)
	private List<Alarm> alarms = new ArrayList<>();
	
		
}
