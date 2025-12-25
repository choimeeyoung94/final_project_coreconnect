package com.goodee.coreconnect.chat.entity;

import java.util.ArrayList;
import java.util.List;

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
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Entity
@Table(
    name = "chat_room",
    indexes = {
        // ⭐ 개설자별 채팅방 조회 최적화
        @Index(name = "idx_chat_room_user", columnList = "user_id"),
        
        // ⭐ 채팅방 타입별 조회 최적화
        @Index(name = "idx_chat_room_type", columnList = "room_type"),
        
        // ⭐ 즐겨찾기 채팅방 조회 최적화
        @Index(name = "idx_favorite_status", columnList = "favorite_status")
    }
)
public class ChatRoom {


	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Integer id;
	
	@Column(name = "room_name")
	private String roomName;
	
	@Column(name = "room_type")
	private String roomType;
	
	@Column(name = "favorite_status")
	private Boolean favoriteStatus;
	
	// 개설자(drafter)와의 단방향 다대일 관계 매핑
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "user_id")
	private User drafter;
	
	// 1:N 관계 매핑 (참여자 리스트 테이블과 매핑)
	@OneToMany(mappedBy = "chatRoom", cascade = CascadeType.ALL)
	private List<ChatRoomUser> chatRoomUsers = new ArrayList<>();
	
	// 1:N 관계 매핑 (채팅메시지 테이블과 매핑)
	@OneToMany(mappedBy = "chatRoom", cascade = CascadeType.ALL)
	private List<Chat> chats = new ArrayList<>();
	
	protected ChatRoom() {}
	
	public static ChatRoom createChatRoom(String roomName, String roomType, Boolean favoriteStatus, User user) {
		 ChatRoom chatRoom = new ChatRoom();
         chatRoom.roomName = roomName;
         chatRoom.roomType = roomType;
         chatRoom.favoriteStatus = favoriteStatus;
         chatRoom.chatRoomUsers = new ArrayList<>();
         chatRoom.chats = new ArrayList<>();
         chatRoom.drafter = user;
         return chatRoom;
	}
	
	// roomType 변경 메서드 추가
	public void changeRoomType(String roomType) {
		this.roomType = roomType;
	}
	
}
