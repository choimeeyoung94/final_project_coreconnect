package com.goodee.coreconnect.common.service;

import java.io.IOException;
import java.net.URL;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetUrlRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

/*
 * S3 업로드용 Service 파일
 */

@Slf4j
@Service
@RequiredArgsConstructor
public class S3Service {

    private final S3Client s3Client;

    @Value("${cloud.aws.s3.bucket}")
    private String bucket;

    /** 프로필 이미지 업로드 */
    public String uploadProfileImage(MultipartFile file, String username) throws IOException {
        String key = "profile/" + username + "/" + file.getOriginalFilename();

        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(file.getContentType())
                .build();

        s3Client.putObject(request, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
        return key; 
    }

    /** 공용: 업로드된 S3 객체의 key를 받아, 해당 파일에 접근할 수 있는 전체 URL을 생성하여 반환 */
    public String getFileUrl(String key) {
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException("S3 key는 null이거나 빈 문자열일 수 없습니다.");
        }
        
        GetUrlRequest request = GetUrlRequest.builder()
                .bucket(bucket)
                .key(key)
                .build();

        URL url = s3Client.utilities().getUrl(request);
        String urlString = url.toString();
        
        // 디버깅: S3 URL 생성 로그 (프로필 이미지 문제 추적용)
        // 생성된 URL이 완전한 URL인지 확인 (https://로 시작해야 함)
        log.info("[S3Service] getFileUrl 호출 - key: {}, bucket: {}, 생성된URL: {}", key, bucket, urlString);
        
        // URL 형식 검증: https:// 또는 http://로 시작해야 함
        if (!urlString.startsWith("http://") && !urlString.startsWith("https://")) {
            log.error("[S3Service] ⚠️ 경고: 생성된 URL이 완전한 URL 형식이 아닙니다! key: {}, url: {}", key, urlString);
        } else {
            log.debug("[S3Service] ✅ 완전한 URL 생성 성공: {}", urlString);
        }
        
        return urlString;
    }
    
    /**
     * 결재 첨부파일 업로드
     * @param file 업로드할 파일
     * @return DB에 저장할 '전체 URL'
     */
    public String uploadApprovalFile(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            return null;
        }

        // 1. 고유한 키 생성 (경로: approval/UUID_파일명)
        String originalFileName = file.getOriginalFilename();
        String uniqueFileName = UUID.randomUUID().toString() + "_" + originalFileName;
        String key = "approval/" + uniqueFileName; // 결재파일은 'approval' 폴더에 저장

        // 2. S3 업로드 요청 생성
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(file.getContentType())
                .build();

        // 3. 파일 업로드
        s3Client.putObject(request, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));

        // 4. DB에 저장할 'URL'을 반환 (File 엔티티가 fileUrl을 필요로 하므로)
        return getFileUrl(key);
    }
    
    /**
     * 채팅 파일 업로드
     * @param file 업로드할 파일
     * @param username 사용자 이름
     * @return S3 객체 키 (key)
     */
    public String uploadChatFile(MultipartFile file, String username) throws IOException {
        if (file == null || file.isEmpty()) {
            return null;
        }

        // 1. 고유한 키 생성 (경로: chat/username/UUID_파일명)
        String originalFileName = file.getOriginalFilename();
        String uniqueFileName = UUID.randomUUID().toString() + "_" + originalFileName;
        String key = "chat/" + username + "/" + uniqueFileName;

        // 2. S3 업로드 요청 생성
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(file.getContentType())
                .build();

        // 3. 파일 업로드
        s3Client.putObject(request, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));

        // 4. S3 key 반환
        return key;
    }
}
