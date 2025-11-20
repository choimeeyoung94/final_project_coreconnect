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
import software.amazon.awssdk.services.s3.model.GetObjectResponse;

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
    
    private static final long MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB
    
    /**
     * 다중 이미지 파일 업로드
     * POST /api/v1/chat/{roomId}/messages/files
     */
    @Operation(summary = "다중 이미지 파일 업로드", description = "채팅방에 여러 이미지 파일을 업로드합니다. 최대 50MB까지 업로드 가능")
    @PostMapping("/{roomId}/messages/files")
    public ResponseEntity<?> uploadMultipleFiles(
            @PathVariable("roomId") Integer roomId,
            @RequestParam("files") MultipartFile[] files,
            @AuthenticationPrincipal CustomUserDetails customUserDetails
    ) {
        try {
            log.info("[uploadMultipleFiles] 요청 수신 - roomId: {}, 파일 개수: {}", roomId, files != null ? files.length : 0);
            
            // 1. 사용자 인증 확인
            String email = customUserDetails.getEmail();
            User sender = userRepository.findByEmailWithDepartment(email)
                    .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다: " + email));
            
            // 2. 파일 배열 검증
            if (files == null || files.length == 0) {
                log.warn("[uploadMultipleFiles] 파일이 없습니다");
                return ResponseEntity.badRequest().body("파일이 없습니다");
            }
            
            // 3. 총 파일 크기 검증 (50MB 제한)
            long totalSize = 0;
            for (MultipartFile file : files) {
                totalSize += file.getSize();
            }
            
            if (totalSize > MAX_TOTAL_SIZE) {
                log.warn("[uploadMultipleFiles] 총 파일 크기 초과 - totalSize: {} bytes, limit: {} bytes", 
                        totalSize, MAX_TOTAL_SIZE);
                return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                        .body("총 파일 크기가 50MB를 초과합니다");
            }
            
            log.info("[uploadMultipleFiles] 총 파일 크기 검증 통과 - totalSize: {} bytes", totalSize);
            
            // 4. 각 파일 처리
            List<ChatResponseDTO> responseDTOs = new ArrayList<>();
            
            for (MultipartFile file : files) {
                // 4-1. MIME 타입 검증 (image/* 만 허용)
                String contentType = file.getContentType();
                if (contentType == null || !contentType.startsWith("image/")) {
                    log.warn("[uploadMultipleFiles] 지원하지 않는 MIME 타입 - contentType: {}, fileName: {}", 
                            contentType, file.getOriginalFilename());
                    return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                            .body("이미지 파일만 업로드 가능합니다. 지원하지 않는 파일 형식: " + file.getOriginalFilename());
                }
                
                log.info("[uploadMultipleFiles] 파일 처리 시작 - fileName: {}, size: {}, contentType: {}", 
                        file.getOriginalFilename(), file.getSize(), contentType);
                
                // 4-2. S3에 파일 업로드
                String s3Key = s3Service.uploadChatImage(file, roomId);
                log.info("[uploadMultipleFiles] S3 업로드 완료 - s3Key: {}", s3Key);
                
                // 4-3. MessageFile 엔티티 생성
                MessageFile messageFile = MessageFile.createMessageFile(
                        file.getOriginalFilename(),
                        (double) file.getSize(),
                        s3Key,
                        null // chat은 sendChatMessage에서 연결됨
                );
                
                // 4-4. Chat 메시지 생성 및 저장
                Chat chat = chatRoomService.sendChatMessage(roomId, sender.getId(), messageFile);
                
                if (chat == null) {
                    log.error("[uploadMultipleFiles] 메시지 저장 실패 - fileName: {}", file.getOriginalFilename());
                    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .body("파일 메시지 저장 실패: " + file.getOriginalFilename());
                }
                
                log.info("[uploadMultipleFiles] Chat 메시지 생성 완료 - chatId: {}, fileName: {}", 
                        chat.getId(), file.getOriginalFilename());
                
                // 4-5. MessageFile 저장 (chat과 연결 후)
                messageFileRepository.save(messageFile);
                
                // 4-6. DTO 변환 및 추가 정보 설정
                ChatResponseDTO dto = ChatResponseDTO.fromEntity(chat);
                
                // unreadCount 설정
                int realUnreadCount = chat.getUnreadCount() != null ? chat.getUnreadCount() : 0;
                dto.setUnreadCount(realUnreadCount);
                
                // sender 정보 설정
                dto.setSenderEmail(sender.getEmail());
                
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
                
                // 파일 URL 설정
                String fileUrl = s3Service.getFileUrl(s3Key);
                dto.setFileUrl(fileUrl);
                
                log.info("[uploadMultipleFiles] DTO 생성 완료 - chatId: {}, fileUrl: {}", chat.getId(), fileUrl);
                
                responseDTOs.add(dto);
            }
            
            log.info("[uploadMultipleFiles] 모든 파일 처리 완료 - 총 {} 개 파일", responseDTOs.size());
            
            // 5. 응답 반환
            return ResponseEntity.status(HttpStatus.CREATED).body(responseDTOs);
            
        } catch (IOException e) {
            log.error("[uploadMultipleFiles] 파일 업로드 중 IOException 발생: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("파일 업로드 중 오류 발생: " + e.getMessage());
        } catch (Exception e) {
            log.error("[uploadMultipleFiles] 예외 발생: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("파일 업로드 중 오류 발생: " + e.getMessage());
        }
    }
    
    /**
     * 파일 다운로드
     * GET /api/v1/chat/files/{fileId}/download
     */
    @Operation(summary = "파일 다운로드", description = "채팅 파일을 다운로드합니다")
    @GetMapping("/files/{fileId}/download")
    public ResponseEntity<?> downloadFile(@PathVariable("fileId") Integer fileId) {
        try {
            log.info("[downloadFile] 요청 수신 - fileId: {}", fileId);
            
            // 1. MessageFile 조회
            MessageFile messageFile = messageFileRepository.findById(fileId)
                    .orElseThrow(() -> new IllegalArgumentException("파일을 찾을 수 없습니다: " + fileId));
            
            log.info("[downloadFile] MessageFile 조회 완료 - fileId: {}, fileName: {}, s3Key: {}", 
                    fileId, messageFile.getFileName(), messageFile.getS3ObjectKey());
            
            // 2. S3에서 파일 스트림 가져오기
            ResponseInputStream<GetObjectResponse> s3Object = s3Service.getObjectStream(messageFile.getS3ObjectKey());
            
            // 3. 응답 헤더 설정
            GetObjectResponse objectResponse = s3Object.response();
            String contentType = objectResponse.contentType();
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(contentType != null ? contentType : "application/octet-stream"));
            headers.setContentDispositionFormData("attachment", messageFile.getFileName());
            
            log.info("[downloadFile] 파일 다운로드 응답 준비 완료 - fileId: {}, fileName: {}, contentType: {}", 
                    fileId, messageFile.getFileName(), contentType);
            
            // 4. 스트림 응답 반환
            return ResponseEntity.ok()
                    .headers(headers)
                    .body(new InputStreamResource(s3Object));
            
        } catch (IllegalArgumentException e) {
            log.error("[downloadFile] 파일을 찾을 수 없음 - fileId: {}, error: {}", fileId, e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body("파일을 찾을 수 없습니다: " + e.getMessage());
        } catch (Exception e) {
            log.error("[downloadFile] 예외 발생 - fileId: {}, error: {}", fileId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("파일 다운로드 중 오류 발생: " + e.getMessage());
        }
    }
}
