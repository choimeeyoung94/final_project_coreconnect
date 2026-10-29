package com.goodee.coreconnect.chat.dto.response;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import com.goodee.coreconnect.chat.entity.Chat;
import com.goodee.coreconnect.chat.entity.MessageFile;
import com.goodee.coreconnect.common.service.S3Service;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Getter
@Setter
@ToString
public class ChatMessageResponseDTO {

	/** 방을 나간 사람이 보낸 메시지의 보낸 사람 이름 */
	public static final String UNKNOWN_SENDER_NAME = "알 수 없음";
	
	private Integer id;
	private String messageContent;
	private LocalDateTime sendAt;
    private Boolean fileYn;
    private String fileUrl;
    private List<String> fileUrls; // 여러 파일 URL 목록
	private Integer roomId;
	private Integer senderId;
	private String senderName;
	private String senderEmail;
	private String senderProfileImageUrl;
	private com.goodee.coreconnect.user.enums.JobGrade senderJobGrade; //  발신자 직급
	private String senderDeptName; //  발신자 부서명
	private Integer unreadCount;
	private String roomName;
	private Boolean readYn;

	/** 보낸 사람이 지금 그 방 참여자가 아닐 때: 내용은 두고 이름은 "알 수 없음", 누군지 알 수 있는 정보(이메일·사진·직급·부서)는 비움 */
	public void hideSender() {
		this.senderName = UNKNOWN_SENDER_NAME;
		this.senderEmail = null;
		this.senderProfileImageUrl = null;
		this.senderJobGrade = null;
		this.senderDeptName = null;
	}
	
	// ✨ 2. readYn 파라미터를 받도록 메서드 시그니처 변경 (S3Service 포함 버전 - 권장)
    public static ChatMessageResponseDTO fromEntity(Chat chat, Boolean readYn, S3Service s3Service) {
        if (chat == null) return null;

        // ⭐ 여러 파일 URL 목록 생성 (S3 키를 URL로 변환)
        List<String> fileUrls = new ArrayList<>();
        if (chat.getMessageFiles() != null && !chat.getMessageFiles().isEmpty()) {
            fileUrls = chat.getMessageFiles().stream()
                .map(file -> {
                    String s3Key = file.getS3ObjectKey();
                    if (s3Key != null && !s3Key.isEmpty() && s3Service != null) {
                        // ⚠️ 중요: 이미 URL 형식인지 확인 (옛날 데이터는 이미 URL로 저장되어 있을 수 있음)
                        if (s3Key.startsWith("http://") || s3Key.startsWith("https://")) {
                            return s3Key; // 이미 URL이면 그대로 사용
                        } else {
                            return s3Service.getFileUrl(s3Key); // S3 키면 URL로 변환
                        }
                    }
                    return s3Key; // S3Service가 없으면 키 그대로 반환
                })
                .filter(url -> url != null && !url.isEmpty())
                .collect(Collectors.toList());
        }
        
        // ⭐ 첫 번째 파일 URL (하위 호환성) - S3 URL로 변환
        String fileUrl = null;
        if (chat.getMessageFiles() != null && !chat.getMessageFiles().isEmpty()) {
            String s3Key = chat.getMessageFiles().get(0).getS3ObjectKey();
            if (s3Key != null && !s3Key.isEmpty() && s3Service != null) {
                // ⚠️ 중요: 이미 URL 형식인지 확인
                if (s3Key.startsWith("http://") || s3Key.startsWith("https://")) {
                    fileUrl = s3Key; // 이미 URL이면 그대로 사용
                } else {
                    fileUrl = s3Service.getFileUrl(s3Key); // S3 키면 URL로 변환
                }
            } else {
                fileUrl = s3Key;
            }
        } else {
            fileUrl = chat.getFileUrl();
            if (fileUrl != null && !fileUrl.isEmpty() && s3Service != null) {
                // ⚠️ 중요: 이미 URL 형식인지 확인 (옛날 데이터는 이미 URL로 저장되어 있을 수 있음)
                if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
                    // 이미 URL 형식이면 그대로 사용
                    fileUrl = fileUrl;
                } else {
                    // S3 키 형식이면 URL로 변환
                    try {
                        fileUrl = s3Service.getFileUrl(fileUrl);
                    } catch (Exception e) {
                        // 변환 실패 시 원래 값 사용 (로그 출력)
                        log.warn("[ChatMessageResponseDTO] S3 URL 변환 실패 - fileUrl: {}, error: {}", fileUrl, e.getMessage());
                    }
                }
            }
        }
        
        // fileUrls가 있으면 첫 번째 URL도 설정
        if (fileUrl == null && !fileUrls.isEmpty()) {
            fileUrl = fileUrls.get(0);
        }
        
        return ChatMessageResponseDTO.builder()
                .id(chat.getId())
                .messageContent(chat.getMessageContent())
                .sendAt(chat.getSendAt())
                .fileYn(chat.getFileYn())
                .fileUrl(fileUrl)
                .fileUrls(fileUrls) // ⭐ 여러 파일 URL 목록
                .roomId(chat.getChatRoom() != null ? chat.getChatRoom().getId() : null)
                .roomName(chat.getChatRoom() != null ? chat.getChatRoom().getRoomName() : null)
                .senderId(chat.getSender() != null ? chat.getSender().getId() : null)
                .senderName(chat.getSender() != null ? chat.getSender().getName() : null)
                .senderEmail(chat.getSender() != null ? chat.getSender().getEmail() : null)
                .senderProfileImageUrl(null) // Controller에서 S3Service로 변환하여 설정
                .unreadCount(chat.getUnreadCount() != null ? chat.getUnreadCount() : 0)
                .readYn(readYn) // ✨ 3. DTO에 포함!
                .build();
    }
    
    // ✨ 2. readYn 파라미터를 받도록 메서드 시그니처 변경 (하위 호환성용 - S3Service 없이)
    @Deprecated // ⚠️ S3Service를 포함한 버전 사용 권장
    public static ChatMessageResponseDTO fromEntity(Chat chat, Boolean readYn) {
        return fromEntity(chat, readYn, null);
    }
}