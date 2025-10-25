package com.goodee.coreconnect.chat.entity;

import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
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
@Table(name = "chat_room")
public class ChatRoom {


	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;
	
	@Column(name = "room_name")
	private String roomName;
	
	@Column(name = "room_type")
	private String roomType;
	
	@Column(name = "favorite_status")
	private Boolean favoriteStatus;
	
	// 1:N 관계 매핑 (참여자 리스트 테이블과 매핑)
	@OneToMany(mappedBy = "chatRoom", cascade = CascadeType.ALL)
	private List<ChatRoomUser> chatRoomUsers = new ArrayList<>();
	
	// 1:N 관계 매핑 (채팅메시지 테이블과 매핑)
	@OneToMany(mappedBy = "chatRoom", cascade = CascadeType.ALL)
	private List<Chat> chats = new ArrayList<>();
	
}
