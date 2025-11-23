package com.goodee.coreconnect.email.dto.response;

import java.time.LocalDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.goodee.coreconnect.email.entity.EmailRecipient;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
public class EmailResponseDTO {
	private Integer emailId;                  // 메일 기본키
    private String emailTitle;                // 제목
    private String emailContent;              // 본문
    private Integer senderId;                 // 발신자 ID
    private String senderEmail; // [수정] 이메일로 발신자 표시
    private String senderDept;  // [수정] 발신자 부서 (부서명이 User에 연관)
    private LocalDateTime sentTime;           // 발송 시각
    private String emailStatus;               // 메일 상태 (SENT/FAILED/BOUNCE 등)
    private String senderName;                // ★ 발신자명 추가!
    private Boolean emailReadYn;                // 읽음 여부 (받은메일함용)
    private List<String> recipientAddresses;  // To 수신자 리스트
    
    private List<String> ccAddresses;         // CC 목록
    private List<String> bccAddresses;        // BCC 목록
    private List<Integer> fileIds;            // 첨부 파일 ID 목록
    private String replyToEmailId;            // 답장 대상 메일 ID
    private String emailbounceReason;         // 반송 사유
    private List<EmailRecipient> toRecipients;   // [수정] 엔티티 자체 사용
    private List<EmailRecipient> ccRecipients;   // [수정] 엔티티 자체 사용
    private List<EmailRecipient> bccRecipients;  // [수정] 본인만 전달, 엔티티
		
    private List<AttachmentDTO> attachments;
    
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime reservedAt; // 예약시간
    
    private Boolean favoriteStatus; // 중요 메일 표시 여부
    
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor
    public static class AttachmentDTO {
        private Integer fileId;
        private String fileName;
        private Long fileSize;
    }
}
