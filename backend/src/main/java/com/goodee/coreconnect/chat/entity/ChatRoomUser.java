package com.goodee.coreconnect.chat.entity;

import com.goodee.coreconnect.user.entity.User;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
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
@Table(name = "chat_room_user")
public class ChatRoomUser {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;
	
	// N : 1 관계 매핑 (user테이블과 매핑)
	// 객체를 처음 select 할떄는 연관된 엔티티를 조회해오지 않는다
	// 연관 엔티티의 값이 실제로 필요해지는 시점에 DB 조회가 일어난다
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "user_id")
	private User user;

	//N : 1 관계 매핑 (chat_room테이블과 매핑)
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "chat_room_id")
	private ChatRoom chatRoom;
	
	
}
