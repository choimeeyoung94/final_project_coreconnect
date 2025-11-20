package com.goodee.coreconnect.chat.controller;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

import org.springframework.core.io.InputStreamResource;
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
import org.springframework.beans.factory.annotation.Value;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;

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
    
    private static final long MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB
    
    /**
     * 다중 이미지 파일 업로드
     * POST /api/v1/chat/{roomId}/messages/files
     */
    @Operation(summary = "다중 이미지 파일 업로드", description = "채팅방에 여러 이미지 파일을 업로드합니다 (최대 50MB)")
    @PostMapping("/{roomId}/messages/files")
    public ResponseEntity<?> uploadMultipleFiles(
            @PathVariable("roomId") Integer roomId,
            @RequestParam("files") MultipartFile[] files,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        
        try {
            // 1. 사용자 인증 확인
            String email = userDetails.getEmail();
            User sender = userRepository.findByEmailWithDepartment(email)
                    .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다"));
            
            // 2. 파일 검증
            if (files == null || files.length == 0) {
                return ResponseEntity.badRequest()
                        .body(ResponseDTO.badRequest("업로드할 파일이 없습니다"));
            }
            
            // 3. 총 파일 크기 검증
            long totalSize = 0;
            for (MultipartFile file : files) {
                totalSize += file.getSize();
            }
            
            if (totalSize > MAX_TOTAL_SIZE) {
                return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                        .body(ResponseDTO.badRequest("총 파일 크기가 50MB를 초과합니다"));
            }
            
            // 4. 이미지 타입 검증
            for (MultipartFile file : files) {
                String contentType = file.getContentType();
                if (contentType == null || !contentType.startsWith("image/")) {
                    return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                            .body(ResponseDTO.badRequest("이미지 파일만 업로드 가능합니다: " + file.getOriginalFilename()));
                }
            }
            
            // 5. 각 파일 업로드 및 메시지 생성
            List<ChatResponseDTO> responseDTOs = new ArrayList<>();
            
            for (MultipartFile file : files) {
                try {
                    // S3에 업로드
                    String s3Key = s3Service.uploadProfileImage(file, sender.getName());
                    String fileUrl = s3Service.getFileUrl(s3Key);
                    
                    // MessageFile 엔티티 생성
                    MessageFile fileEntity = MessageFile.createMessageFile(
                            file.getOriginalFilename(),
                            (double) file.getSize(),
                            s3Key,
                            null // chat은 sendChatMessage에서 연결됨
                    );
                    
                    // 채팅 메시지 저장
                    Chat chat = chatRoomService.sendChatMessage(roomId, sender.getId(), fileEntity);
                    if (chat == null) {
                        log.error("[uploadMultipleFiles] 채팅 메시지 저장 실패 - file: {}", file.getOriginalFilename());
                        continue;
                    }
                    
                    // MessageFile 저장
                    messageFileRepository.save(fileEntity);
                    
                    // DTO 생성
                    ChatResponseDTO dto = ChatResponseDTO.fromEntity(chat);
                    dto.setFileUrl(fileUrl);
                    dto.setSenderEmail(sender.getEmail());
                    
                    // unreadCount 설정
                    int realUnreadCount = chat.getUnreadCount() != null ? chat.getUnreadCount() : 0;
                    dto.setUnreadCount(realUnreadCount);
                    
                    // 프로필 이미지 URL 설정
                    if (sender.getProfileImageKey() != null && !sender.getProfileImageKey().isBlank()) {
                        String profileImageUrl = s3Service.getFileUrl(sender.getProfileImageKey());
                        dto.setSenderProfileImageUrl(profileImageUrl);
                    } else {
                        dto.setSenderProfileImageUrl("");
                    }
                    
                    // 직급 및 부서명 설정
                    dto.setSenderJobGrade(sender.getJobGrade());
                    if (sender.getDepartment() != null) {
                        dto.setSenderDeptName(sender.getDepartment().getDeptName());
                    } else {
                        dto.setSenderDeptName("");
                    }
                    
                    responseDTOs.add(dto);
                    
                } catch (IOException e) {
                    log.error("[uploadMultipleFiles] 파일 업로드 실패 - file: {}, error: {}", 
                            file.getOriginalFilename(), e.getMessage());
                    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .body(ResponseDTO.internalError("파일 업로드 실패: " + file.getOriginalFilename()));
                }
            }
            
            log.info("[uploadMultipleFiles] 파일 업로드 성공 - roomId: {}, count: {}", roomId, responseDTOs.size());
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(ResponseDTO.success(responseDTOs, "파일 업로드 성공"));
            
        } catch (Exception e) {
            log.error("[uploadMultipleFiles] 예외 발생 - error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ResponseDTO.internalError("파일 업로드 중 오류가 발생했습니다"));
        }
    }
    
    /**
     * 파일 다운로드
     * GET /api/v1/chat/files/{fileId}/download
     */
    @Operation(summary = "파일 다운로드", description = "파일을 다운로드합니다")
    @GetMapping("/files/{fileId}/download")
    public ResponseEntity<?> downloadFile(@PathVariable("fileId") Integer fileId) {
        try {
            // 1. MessageFile 조회
            MessageFile messageFile = messageFileRepository.findById(fileId)
                    .orElseThrow(() -> new IllegalArgumentException("파일을 찾을 수 없습니다"));
            
            // 2. S3에서 파일 스트림 가져오기
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(bucket)
                    .key(messageFile.getS3ObjectKey())
                    .build();
            
            InputStream inputStream = s3Client.getObject(getObjectRequest);
            
            // 3. 파일 다운로드 응답 생성
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            headers.setContentDispositionFormData("attachment", messageFile.getFileName());
            
            return ResponseEntity.ok()
                    .headers(headers)
                    .body(new InputStreamResource(inputStream));
            
        } catch (IllegalArgumentException e) {
            log.error("[downloadFile] 파일을 찾을 수 없음 - fileId: {}", fileId);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ResponseDTO.badRequest("파일을 찾을 수 없습니다"));
        } catch (Exception e) {
            log.error("[downloadFile] 파일 다운로드 실패 - fileId: {}, error: {}", fileId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ResponseDTO.internalError("파일 다운로드 중 오류가 발생했습니다"));
        }
    }
}
