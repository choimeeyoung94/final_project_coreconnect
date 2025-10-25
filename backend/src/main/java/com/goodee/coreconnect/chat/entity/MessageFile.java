package com.goodee.coreconnect.chat.entity;

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
@Table(name = "message_file")
public class MessageFile {
	
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Integer id;
	
	@Column(name = "file_name")
	private String fileName;
	
	@Column(name = "file_url")
	private String fileUrl;
	
	@Column(name = "file_extension")
	private String fileExtenstion;
	
	@Column(name ="file_size")
	private Double fileSize;
	
	@Column(name = "s3_object_key")
	private String S3ObjectKey;
	
	// N : 1 관계 (채팅메시지 테이블과 매핑)
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "chat_message_id")
	private Chat chat;
	
	
	
	
	
	
}
