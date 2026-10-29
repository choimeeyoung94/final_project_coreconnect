package com.goodee.coreconnect.chat.entity;

import java.time.LocalDateTime;

import com.goodee.coreconnect.user.entity.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Entity
@Table(
    name = "chat_room_user",
    indexes = {
        // ⭐ 사용자별 참여 채팅방 조회 최적화
        @Index(name = "idx_user_chat_room", columnList = "user_id, chat_room_id"),
        
        // ⭐ 채팅방별 참여자 조회 최적화
        @Index(name = "idx_chat_room_user", columnList = "chat_room_id, user_id")
    }
)
public class ChatRoomUser {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Integer id;
	
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

	// 방에 들어온 시각 (만들기·초대·다시 초대). 이 시각 이후 메시지만 보여 줌
	// 컬럼 추가 전부터 있던 참여자는 NULL → 메시지를 전부 보여 줌. 초 단위라 들어온 그 1초 안의 직전 메시지는 보일 수 있음
	@Column(name = "joined_at")
	private LocalDateTime joinedAt;
	
	protected ChatRoomUser() {}
	
	public static ChatRoomUser createChatRoomUser(User user, ChatRoom chatRoom) {
		ChatRoomUser chatRoomUser = new ChatRoomUser();
		chatRoomUser.user = user;
		chatRoomUser.chatRoom = chatRoom;
		// 초 단위로 자름: 운영 sent_at 컬럼 정밀도(초/마이크로초)와 상관없이 "들어온 직후 메시지(초대 안내 등)"가 joined_at보다 앞서 보이지 않게
		chatRoomUser.joinedAt = LocalDateTime.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
		return chatRoomUser;
	}
}
