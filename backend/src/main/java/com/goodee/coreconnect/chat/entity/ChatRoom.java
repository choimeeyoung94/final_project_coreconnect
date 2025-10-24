package com.goodee.coreconnect.chat.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
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
	
	
	
}
