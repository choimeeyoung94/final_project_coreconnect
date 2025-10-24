package com.goodee.coreconnect.chat.entity;

import java.time.LocalDateTime;

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
@Table(name = "alarm")
public class Alarm {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;
	
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
	
	
	
	
	
	
}
