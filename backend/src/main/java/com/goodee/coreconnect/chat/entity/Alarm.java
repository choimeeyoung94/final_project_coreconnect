package com.goodee.coreconnect.chat.entity;

import java.time.LocalDateTime;

import com.goodee.coreconnect.user.entity.User;

import jakarta.persistence.Column;
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
@Table(name = "alarm")
public class Alarm {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Integer id;
	
	@Column(name = "alarm_read_yn")
	private Boolean alarmReadYn;
	
	@Column(name = "alarm_type")
	private String alarmType;
	
	@Column(name = "alarm_read_at")
	private LocalDateTime alarmReadAt;
	
	@Column(name = "alarm_sent_at")
	private LocalDateTime alarmSentAt;
	
	@Column(name = "alarm_sent_yn")
	private Boolean alarmSentYn;
	
	
	// N : 1 관계 (채팅메시지 테이블과 매핑)
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "chat_message_id")
	private Chat chat;
	
	// N : 1 관계 (user 테이블과 매핑)
	// 알림 수신자
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "user_id")
	private User user; 
	
	
}
