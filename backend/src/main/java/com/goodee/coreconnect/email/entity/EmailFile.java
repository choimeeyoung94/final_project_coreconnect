package com.goodee.coreconnect.email.entity;

import java.time.LocalDateTime;
import java.util.List;

import com.goodee.coreconnect.email.enums.EmailStatusEnum;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Builder.Default;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "email_file")
@Getter
@NoArgsConstructor(access = lombok.AccessLevel.PROTECTED) // 기본 생성자 protected
@AllArgsConstructor
@Builder
public class EmailFile {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Integer emailFileId;
	
	private String emailFileName;
	private Long emailFileSize;
	
	@Column(name = "email_files3object_key", columnDefinition = "TEXT")
	private String emailFileS3ObjectKey;
	@Builder.Default
	private Boolean emailFielDeletedYn = false;
	
	@ManyToOne
	@JoinColumn(name = "email_id")
	private Email email;
	
}
