package com.goodee.coreconnect.chat.controller;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

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
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;

@Tag(name = "Chat File API", description = "채팅 파일 업로드/다운로드 관련 API")
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
    
    private static final long MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB in bytes
    private static final String ALLOWED_CONTENT_TYPE_PREFIX = "image/";
    
    /**
     * 여러 이미지 파일을 한번에 업로드
     * @param roomId 채팅방 ID
     * @param files 업로드할 파일 배열
     * @param customUserDetails 인증된 사용자 정보
     * @return 업로드된 각 파일에 대한 ChatResponseDTO 리스트
     */
    @Operation(
        summary = "채팅방에 여러 이미지 파일 업로드",
        description = "채팅방에 여러 이미지 파일을 업로드합니다. 총 용량은 50MB를 초과할 수 없으며, image/* 타입만 허용됩니다."
    )
    @PostMapping("/{roomId}/messages/files")
    public ResponseEntity<?> uploadMultipleFiles(
            @PathVariable("roomId") Integer roomId,
            @RequestParam("files") MultipartFile[] files,
            @AuthenticationPrincipal CustomUserDetails customUserDetails
    ) {
        try {
            log.info("[uploadMultipleFiles] 파일 업로드 시작 - roomId: {}, files count: {}", roomId, files.length);
            
            // 1. 사용자 인증 확인
            String email = customUserDetails.getEmail();
            User sender = userRepository.findByEmailWithDepartment(email)
                    .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
            
            // 2. 파일 존재 여부 확인
            if (files == null || files.length == 0) {
                log.warn("[uploadMultipleFiles] 업로드할 파일이 없습니다.");
                return ResponseEntity.badRequest().body("업로드할 파일이 없습니다.");
            }
            
            // 3. 총 파일 크기 검증
            long totalSize = 0;
            for (MultipartFile file : files) {
                totalSize += file.getSize();
            }
            
            if (totalSize > MAX_TOTAL_SIZE) {
                log.warn("[uploadMultipleFiles] 파일 크기 초과 - totalSize: {} bytes, max: {} bytes", 
                        totalSize, MAX_TOTAL_SIZE);
                return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                        .body("총 파일 크기가 50MB를 초과합니다. (현재: " + (totalSize / 1024 / 1024) + "MB)");
            }
            
            // 4. 컨텐츠 타입 검증 (image/* 만 허용)
            for (MultipartFile file : files) {
                String contentType = file.getContentType();
                if (contentType == null || !contentType.startsWith(ALLOWED_CONTENT_TYPE_PREFIX)) {
                    log.warn("[uploadMultipleFiles] 지원하지 않는 파일 타입 - fileName: {}, contentType: {}", 
                            file.getOriginalFilename(), contentType);
                    return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                            .body("이미지 파일만 업로드 가능합니다. (파일: " + file.getOriginalFilename() + ")");
                }
            }
            
            // 5. 각 파일을 S3에 업로드하고 채팅 메시지로 저장
            List<ChatResponseDTO> responses = new ArrayList<>();
            
            for (MultipartFile file : files) {
                try {
                    log.info("[uploadMultipleFiles] 파일 업로드 처리 - fileName: {}, size: {} bytes", 
                            file.getOriginalFilename(), file.getSize());
                    
                    // S3에 업로드 (uploadChatFile 메서드 사용)
                    String s3Key = uploadChatFile(file, sender.getName());
                    String fileUrl = s3Service.getFileUrl(s3Key);
                    
                    log.info("[uploadMultipleFiles] S3 업로드 완료 - s3Key: {}, fileUrl: {}", s3Key, fileUrl);
                    
                    // MessageFile 엔티티 생성
                    MessageFile messageFile = MessageFile.createMessageFile(
                            file.getOriginalFilename(),
                            (double) file.getSize(),
                            s3Key,  // S3ObjectKey에 s3Key 저장
                            null    // chat은 sendChatMessage에서 연결됨
                    );
                    
                    // 채팅 메시지로 저장 (chatRoomService에서 처리)
                    Chat chat = chatRoomService.sendChatMessage(roomId, sender.getId(), messageFile);
                    
                    if (chat == null) {
                        log.error("[uploadMultipleFiles] 채팅 메시지 저장 실패 - fileName: {}", file.getOriginalFilename());
                        continue;
                    }
                    
                    // MessageFile을 DB에 저장
                    messageFileRepository.save(messageFile);
                    
                    // ChatResponseDTO 생성
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
                    
                    // 직급 설정
                    dto.setSenderJobGrade(sender.getJobGrade());
                    
                    // 부서명 설정
                    if (sender.getDepartment() != null) {
                        dto.setSenderDeptName(sender.getDepartment().getDeptName());
                    } else {
                        dto.setSenderDeptName("");
                    }
                    
                    responses.add(dto);
                    
                    log.info("[uploadMultipleFiles] 파일 업로드 및 메시지 저장 완료 - chatId: {}, fileName: {}", 
                            chat.getId(), file.getOriginalFilename());
                    
                } catch (Exception e) {
                    log.error("[uploadMultipleFiles] 개별 파일 업로드 실패 - fileName: {}, error: {}", 
                            file.getOriginalFilename(), e.getMessage(), e);
                    // 개별 파일 실패는 계속 진행
                }
            }
            
            if (responses.isEmpty()) {
                log.error("[uploadMultipleFiles] 모든 파일 업로드 실패");
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body("파일 업로드에 실패했습니다.");
            }
            
            log.info("[uploadMultipleFiles] 파일 업로드 완료 - 성공: {} / 전체: {}", responses.size(), files.length);
            return ResponseEntity.status(HttpStatus.CREATED).body(responses);
            
        } catch (Exception e) {
            log.error("[uploadMultipleFiles] 파일 업로드 중 예외 발생 - error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("파일 업로드 중 오류가 발생했습니다: " + e.getMessage());
        }
    }
    
    /**
     * 파일 다운로드
     * @param fileId 파일 ID
     * @return 파일 스트림
     */
    @Operation(
        summary = "채팅 파일 다운로드",
        description = "채팅방에 업로드된 파일을 다운로드합니다."
    )
    @GetMapping("/files/{fileId}/download")
    public ResponseEntity<?> downloadFile(@PathVariable("fileId") Integer fileId) {
        try {
            log.info("[downloadFile] 파일 다운로드 시작 - fileId: {}", fileId);
            
            // 1. MessageFile 조회
            Optional<MessageFile> fileOpt = messageFileRepository.findById(fileId);
            if (fileOpt.isEmpty()) {
                log.warn("[downloadFile] 파일을 찾을 수 없습니다 - fileId: {}", fileId);
                return ResponseEntity.notFound().build();
            }
            
            MessageFile messageFile = fileOpt.get();
            String s3Key = messageFile.getS3ObjectKey();
            String fileName = messageFile.getFileName();
            
            log.info("[downloadFile] S3에서 파일 가져오기 - s3Key: {}, fileName: {}", s3Key, fileName);
            
            // 2. S3에서 파일 스트림 가져오기
            String bucket = getBucketName();
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(bucket)
                    .key(s3Key)
                    .build();
            
            ResponseInputStream<GetObjectResponse> s3Object = s3Client.getObject(getObjectRequest);
            
            // 3. Content-Disposition 헤더 설정
            HttpHeaders headers = new HttpHeaders();
            headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"");
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            
            log.info("[downloadFile] 파일 다운로드 완료 - fileId: {}, fileName: {}", fileId, fileName);
            
            return ResponseEntity.ok()
                    .headers(headers)
                    .body(new InputStreamResource(s3Object));
            
        } catch (Exception e) {
            log.error("[downloadFile] 파일 다운로드 중 예외 발생 - fileId: {}, error: {}", fileId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("파일 다운로드 중 오류가 발생했습니다: " + e.getMessage());
        }
    }
    
    /**
     * 채팅 파일을 S3에 업로드 (S3Service에 추가할 메서드를 임시로 여기에 구현)
     * @param file 업로드할 파일
     * @param username 업로드하는 사용자 이름
     * @return S3 객체 키
     * @throws IOException
     */
    private String uploadChatFile(MultipartFile file, String username) throws IOException {
        String key = "chat/" + username + "/" + System.currentTimeMillis() + "_" + file.getOriginalFilename();
        
        software.amazon.awssdk.services.s3.model.PutObjectRequest request = 
                software.amazon.awssdk.services.s3.model.PutObjectRequest.builder()
                .bucket(getBucketName())
                .key(key)
                .contentType(file.getContentType())
                .build();
        
        s3Client.putObject(request, 
                software.amazon.awssdk.core.sync.RequestBody.fromInputStream(
                        file.getInputStream(), file.getSize()));
        
        log.info("[uploadChatFile] S3 업로드 완료 - key: {}", key);
        return key;
    }
    
    /**
     * S3 버킷 이름 가져오기 (S3Service와 동일한 방식으로 주입받아야 하지만 임시로 하드코딩)
     * 실제로는 @Value로 주입받아야 함
     */
    private String getBucketName() {
        // TODO: @Value로 주입받도록 수정 필요
        // 임시로 리플렉션으로 S3Service의 bucket 필드 접근
        try {
            java.lang.reflect.Field field = s3Service.getClass().getDeclaredField("bucket");
            field.setAccessible(true);
            return (String) field.get(s3Service);
        } catch (Exception e) {
            log.error("[getBucketName] bucket 이름 가져오기 실패", e);
            return "coreconnect-bucket"; // fallback
        }
    }
}
