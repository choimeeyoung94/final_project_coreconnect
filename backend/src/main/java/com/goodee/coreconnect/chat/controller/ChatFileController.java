package com.goodee.coreconnect.chat.controller;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.goodee.coreconnect.chat.dto.response.ChatResponseDTO;
import com.goodee.coreconnect.chat.entity.Chat;
import com.goodee.coreconnect.chat.entity.MessageFile;
import com.goodee.coreconnect.chat.repository.MessageFileRepository;
import com.goodee.coreconnect.chat.service.ChatRoomService;
import com.goodee.coreconnect.common.dto.response.ResponseDTO;
import com.goodee.coreconnect.common.service.S3Service;
import com.goodee.coreconnect.security.userdetails.CustomUserDetails;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.repository.UserRepository;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;

/**
 * 채팅 파일 업로드 및 다운로드 컨트롤러
 * - 다중 파일(이미지) 업로드 지원
 * - 총 50MB 제한
 * - 이미지 파일만 허용
 */
@Tag(name = "Chat File API", description = "채팅 파일 업로드/다운로드 API")
@Slf4j
@RequiredArgsConstructor
@RequestMapping("/api/v1/chat")
@RestController
@SecurityRequirement(name = "bearerAuth")
public class ChatFileController {

    private final ChatRoomService chatRoomService;
    private final UserRepository userRepository;
    private final MessageFileRepository messageFileRepository;
    private final S3Service s3Service;
    private final S3Client s3Client;

    @Value("${cloud.aws.s3.bucket}")
    private String bucket;

    // 50MB in bytes
    private static final long MAX_TOTAL_SIZE = 50 * 1024 * 1024;
    
    // Allowed image content types
    private static final List<String> ALLOWED_CONTENT_TYPES = List.of(
        "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/bmp"
    );

    /**
     * 다중 파일(이미지) 업로드
     * @param roomId 채팅방 ID
     * @param files 업로드할 파일 배열
     * @param user 인증된 사용자
     * @return 생성된 채팅 메시지 DTO 리스트
     */
    @Operation(summary = "다중 이미지 업로드", description = "채팅방에 여러 이미지 파일을 업로드합니다 (최대 50MB)")
    @PostMapping("/{roomId}/messages/files")
    public ResponseEntity<ResponseDTO<List<ChatResponseDTO>>> uploadMultipleFiles(
            @PathVariable("roomId") Integer roomId,
            @RequestParam("files") MultipartFile[] files,
            @AuthenticationPrincipal CustomUserDetails user) {
        
        log.info("[ChatFileController] 다중 파일 업로드 요청 - roomId: {}, fileCount: {}", roomId, files.length);
        
        // 1. 파일 배열 검증
        if (files == null || files.length == 0) {
            return ResponseEntity.badRequest()
                .body(ResponseDTO.badRequest("업로드할 파일이 없습니다."));
        }
        
        // 2. 총 파일 크기 검증
        long totalSize = 0;
        for (MultipartFile file : files) {
            totalSize += file.getSize();
            
            // 개별 파일 content-type 검증
            String contentType = file.getContentType();
            if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
                log.warn("[ChatFileController] 허용되지 않은 파일 타입: {}", contentType);
                return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                    .body(ResponseDTO.unsupportedMediaType("이미지 파일만 업로드 가능합니다. (JPEG, PNG, GIF, WEBP, BMP)"));
            }
        }
        
        if (totalSize > MAX_TOTAL_SIZE) {
            log.warn("[ChatFileController] 총 파일 크기 초과: {}MB", totalSize / 1024 / 1024);
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(ResponseDTO.payloadTooLarge("총 파일 크기는 50MB를 초과할 수 없습니다."));
        }
        
        // 3. 사용자 조회
        String email = user.getEmail();
        User sender = userRepository.findByEmailWithDepartment(email).orElseThrow(
            () -> new RuntimeException("사용자를 찾을 수 없습니다.")
        );
        
        // 4. 각 파일 업로드 및 메시지 생성
        List<ChatResponseDTO> responses = new ArrayList<>();
        
        for (MultipartFile file : files) {
            try {
                // S3 업로드
                String s3Key = s3Service.uploadProfileImage(file, sender.getName());
                String fileUrl = s3Service.getFileUrl(s3Key);
                
                log.debug("[ChatFileController] S3 업로드 완료 - key: {}, url: {}", s3Key, fileUrl);
                
                // MessageFile 엔티티 생성
                MessageFile fileEntity = MessageFile.createMessageFile(
                    file.getOriginalFilename(),
                    (double) file.getSize(),
                    fileUrl,
                    null // chat은 sendChatMessage에서 연결됨
                );
                
                // 채팅 메시지 저장
                Chat chat = chatRoomService.sendChatMessage(roomId, sender.getId(), fileEntity);
                if (chat == null) {
                    log.error("[ChatFileController] 파일 메시지 저장 실패");
                    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(ResponseDTO.internalError("파일 메시지 저장 실패"));
                }
                
                // MessageFile 저장
                messageFileRepository.save(fileEntity);
                
                // DTO 생성
                ChatResponseDTO dto = ChatResponseDTO.fromEntity(chat);
                
                // unreadCount 설정
                int realUnreadCount = chat.getUnreadCount() != null ? chat.getUnreadCount() : 0;
                dto.setUnreadCount(realUnreadCount);
                
                // sender 정보 설정
                dto.setSenderEmail(sender.getEmail());
                dto.setFileUrl(fileUrl);
                
                // 프로필 이미지 URL 설정
                if (sender.getProfileImageKey() != null && !sender.getProfileImageKey().isBlank()) {
                    String profileImageUrl = s3Service.getFileUrl(sender.getProfileImageKey());
                    dto.setSenderProfileImageUrl(profileImageUrl);
                } else {
                    dto.setSenderProfileImageUrl("");
                }
                
                // 직급 및 부서 설정
                dto.setSenderJobGrade(sender.getJobGrade());
                if (sender.getDepartment() != null) {
                    dto.setSenderDeptName(sender.getDepartment().getDeptName());
                }
                
                responses.add(dto);
                log.info("[ChatFileController] 파일 업로드 성공 - fileName: {}, chatId: {}", file.getOriginalFilename(), chat.getId());
                
            } catch (IOException e) {
                log.error("[ChatFileController] S3 업로드 실패: {}", e.getMessage(), e);
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ResponseDTO.internalError("파일 업로드 실패: " + e.getMessage()));
            } catch (Exception e) {
                log.error("[ChatFileController] 파일 처리 중 오류 발생: {}", e.getMessage(), e);
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ResponseDTO.internalError("파일 처리 실패: " + e.getMessage()));
            }
        }
        
        log.info("[ChatFileController] 다중 파일 업로드 완료 - 총 {}개 파일", responses.size());
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ResponseDTO.created(responses));
    }

    /**
     * 파일 다운로드
     * @param fileId 파일 ID
     * @param user 인증된 사용자
     * @return 파일 스트림
     */
    @Operation(summary = "파일 다운로드", description = "채팅 파일을 다운로드합니다")
    @GetMapping("/files/{fileId}/download")
    public ResponseEntity<?> downloadFile(
            @PathVariable("fileId") Integer fileId,
            @AuthenticationPrincipal CustomUserDetails user) {
        
        log.info("[ChatFileController] 파일 다운로드 요청 - fileId: {}, user: {}", fileId, user.getEmail());
        
        try {
            // 1. MessageFile 조회
            MessageFile messageFile = messageFileRepository.findById(fileId)
                .orElseThrow(() -> new RuntimeException("파일을 찾을 수 없습니다."));
            
            // 2. 접근 권한 검증 (채팅방 참여자인지 확인)
            Chat chat = messageFile.getChat();
            if (chat == null || chat.getChatRoom() == null) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ResponseDTO.forbidden("파일에 접근할 수 없습니다."));
            }
            
            Integer roomId = chat.getChatRoom().getId();
            User currentUser = userRepository.findByEmail(user.getEmail())
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
            
            // 채팅방 참여자 확인
            List<Integer> participantIds = chatRoomService.getParticipantIds(roomId);
            if (!participantIds.contains(currentUser.getId())) {
                log.warn("[ChatFileController] 권한 없음 - userId: {}, roomId: {}", currentUser.getId(), roomId);
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ResponseDTO.forbidden("이 파일에 접근할 권한이 없습니다."));
            }
            
            // 3. S3에서 파일 가져오기
            String s3Key = messageFile.getS3ObjectKey();
            
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(bucket)
                .key(s3Key)
                .build();
            
            ResponseInputStream<GetObjectResponse> s3Object = s3Client.getObject(getObjectRequest);
            
            // 4. 파일 스트림 반환
            byte[] content = s3Object.readAllBytes();
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            headers.setContentDispositionFormData("attachment", messageFile.getFileName());
            headers.setContentLength(content.length);
            
            log.info("[ChatFileController] 파일 다운로드 완료 - fileId: {}, fileName: {}", fileId, messageFile.getFileName());
            
            return ResponseEntity.ok()
                .headers(headers)
                .body(content);
                
        } catch (Exception e) {
            log.error("[ChatFileController] 파일 다운로드 실패: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ResponseDTO.internalError("파일 다운로드 실패: " + e.getMessage()));
        }
    }
}
