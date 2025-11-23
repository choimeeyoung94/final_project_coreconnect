package com.goodee.coreconnect.email.dto.request;

import java.time.LocalDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class EmailSendRequestDTO {
	private Integer emailId;
	private String emailTitle;
	private String emailContent;
	private Integer senderId;
	private String senderAddress;          // 발신자 이메일
	private List<String> recipientAddress; // 발신자 ID
	private List<String> ccAddresses;      // 참조 CC
	private List<String> bccAddresses;      // 숨은참조 BCC
	private List<Integer> fileIds;         // 첨부파일 ID
	private List<Integer> existingAttachmentIds; // 기존 첨부파일 ID (임시저장 업데이트 시 사용)
	private String replyToEmailId;         // 답신 원본
	private LocalDateTime reservedAt; // 예약발송 시각(yyyy-MM-ddTHH:mm:ss)
	
    // 첨부파일(Attachment) 필드 추가! (예시: String형)
    private List<EmailAttachmentRequestDTO> attachments;
    // ★ emailType 필드 추가!
    private String emailType;               // 이메일 유형/코드 등
    
}
