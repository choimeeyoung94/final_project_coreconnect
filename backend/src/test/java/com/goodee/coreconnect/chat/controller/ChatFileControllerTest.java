package com.goodee.coreconnect.chat.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import com.goodee.coreconnect.chat.entity.Chat;
import com.goodee.coreconnect.chat.entity.MessageFile;
import com.goodee.coreconnect.chat.repository.MessageFileRepository;
import com.goodee.coreconnect.chat.service.ChatRoomService;
import com.goodee.coreconnect.common.service.S3Service;
import com.goodee.coreconnect.security.userdetails.CustomUserDetails;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.JobGrade;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

/**
 * ChatFileController 테스트
 */
class ChatFileControllerTest {

    @Mock
    private ChatRoomService chatRoomService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private MessageFileRepository messageFileRepository;

    @Mock
    private S3Service s3Service;

    @Mock
    private CustomUserDetails customUserDetails;

    @InjectMocks
    private ChatFileController chatFileController;

    private User testUser;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        
        // 테스트 사용자 모킹
        testUser = mock(User.class);
        when(testUser.getId()).thenReturn(1);
        when(testUser.getEmail()).thenReturn("test@example.com");
        when(testUser.getName()).thenReturn("테스트 사용자");
        when(testUser.getJobGrade()).thenReturn(JobGrade.STAFF);
        when(testUser.getProfileImageKey()).thenReturn("profile/test/image.jpg");
        when(testUser.getDepartment()).thenReturn(null);
    }

    @Test
    @DisplayName("다중 이미지 파일 업로드 성공 테스트")
    void testUploadMultipleFiles_Success() throws Exception {
        // Given
        Integer roomId = 1;
        String email = "test@example.com";
        
        MockMultipartFile file1 = new MockMultipartFile(
            "files",
            "image1.jpg",
            "image/jpeg",
            "test image 1".getBytes()
        );
        
        MockMultipartFile file2 = new MockMultipartFile(
            "files",
            "image2.png",
            "image/png",
            "test image 2".getBytes()
        );
        
        MultipartFile[] files = new MultipartFile[]{file1, file2};
        
        // Mock 설정
        when(customUserDetails.getEmail()).thenReturn(email);
        when(userRepository.findByEmailWithDepartment(email)).thenReturn(Optional.of(testUser));
        
        String s3Key1 = "chat/1/uuid1_image1.jpg";
        String s3Key2 = "chat/1/uuid2_image2.png";
        when(s3Service.uploadChatImage(any(MultipartFile.class), anyInt())).thenReturn(s3Key1, s3Key2);
        
        String fileUrl1 = "https://s3.amazonaws.com/" + s3Key1;
        String fileUrl2 = "https://s3.amazonaws.com/" + s3Key2;
        when(s3Service.getFileUrl(anyString()))
            .thenReturn("https://s3.amazonaws.com/profile/test/image.jpg")
            .thenReturn(fileUrl1)
            .thenReturn(fileUrl2);
        
        Chat chat1 = mock(Chat.class);
        Chat chat2 = mock(Chat.class);
        when(chat1.getId()).thenReturn(1);
        when(chat2.getId()).thenReturn(2);
        when(chat1.getUnreadCount()).thenReturn(0);
        when(chat2.getUnreadCount()).thenReturn(0);
        
        when(chatRoomService.sendChatMessage(anyInt(), anyInt(), any(MessageFile.class)))
            .thenReturn(chat1, chat2);
        
        // When
        ResponseEntity<?> response = chatFileController.uploadMultipleFiles(roomId, files, customUserDetails);
        
        // Then
        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        verify(s3Service, times(2)).uploadChatImage(any(MultipartFile.class), anyInt());
        verify(chatRoomService, times(2)).sendChatMessage(anyInt(), anyInt(), any(MessageFile.class));
        verify(messageFileRepository, times(2)).save(any(MessageFile.class));
    }

    @Test
    @DisplayName("파일이 없을 때 400 에러 반환")
    void testUploadMultipleFiles_NoFiles() {
        // Given
        Integer roomId = 1;
        MultipartFile[] files = new MultipartFile[0];
        
        when(customUserDetails.getEmail()).thenReturn("test@example.com");
        when(userRepository.findByEmailWithDepartment("test@example.com")).thenReturn(Optional.of(testUser));
        
        // When
        ResponseEntity<?> response = chatFileController.uploadMultipleFiles(roomId, files, customUserDetails);
        
        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    @Test
    @DisplayName("총 파일 크기가 50MB를 초과할 때 413 에러 반환")
    void testUploadMultipleFiles_ExceedMaxSize() {
        // Given
        Integer roomId = 1;
        
        // 51MB 파일 생성 (50MB 제한 초과)
        byte[] largeContent = new byte[51 * 1024 * 1024];
        MockMultipartFile largeFile = new MockMultipartFile(
            "files",
            "large.jpg",
            "image/jpeg",
            largeContent
        );
        
        MultipartFile[] files = new MultipartFile[]{largeFile};
        
        when(customUserDetails.getEmail()).thenReturn("test@example.com");
        when(userRepository.findByEmailWithDepartment("test@example.com")).thenReturn(Optional.of(testUser));
        
        // When
        ResponseEntity<?> response = chatFileController.uploadMultipleFiles(roomId, files, customUserDetails);
        
        // Then
        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, response.getStatusCode());
    }

    @Test
    @DisplayName("이미지가 아닌 파일 업로드 시 415 에러 반환")
    void testUploadMultipleFiles_UnsupportedMediaType() {
        // Given
        Integer roomId = 1;
        
        MockMultipartFile pdfFile = new MockMultipartFile(
            "files",
            "document.pdf",
            "application/pdf",
            "test pdf content".getBytes()
        );
        
        MultipartFile[] files = new MultipartFile[]{pdfFile};
        
        when(customUserDetails.getEmail()).thenReturn("test@example.com");
        when(userRepository.findByEmailWithDepartment("test@example.com")).thenReturn(Optional.of(testUser));
        
        // When
        ResponseEntity<?> response = chatFileController.uploadMultipleFiles(roomId, files, customUserDetails);
        
        // Then
        assertEquals(HttpStatus.UNSUPPORTED_MEDIA_TYPE, response.getStatusCode());
    }

    @Test
    @DisplayName("파일 다운로드 성공 테스트")
    void testDownloadFile_Success() throws Exception {
        // Given
        Integer fileId = 1;
        String s3Key = "chat/1/test.jpg";
        String fileName = "test.jpg";
        
        MessageFile messageFile = MessageFile.createMessageFile(
            fileName,
            1024.0,
            s3Key,
            null
        );
        
        when(messageFileRepository.findById(fileId)).thenReturn(Optional.of(messageFile));
        
        // Mock S3 response
        software.amazon.awssdk.services.s3.model.GetObjectResponse mockResponse = 
            software.amazon.awssdk.services.s3.model.GetObjectResponse.builder()
                .contentType("image/jpeg")
                .build();
        software.amazon.awssdk.core.ResponseInputStream<software.amazon.awssdk.services.s3.model.GetObjectResponse> mockStream = 
            new software.amazon.awssdk.core.ResponseInputStream<>(
                mockResponse,
                new java.io.ByteArrayInputStream("test".getBytes())
            );
        
        when(s3Service.getObjectStream(s3Key)).thenReturn(mockStream);
        
        // When
        ResponseEntity<?> response = chatFileController.downloadFile(fileId);
        
        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(s3Service, times(1)).getObjectStream(s3Key);
    }

    @Test
    @DisplayName("존재하지 않는 파일 다운로드 시 404 에러 반환")
    void testDownloadFile_NotFound() {
        // Given
        Integer fileId = 999;
        
        when(messageFileRepository.findById(fileId)).thenReturn(Optional.empty());
        
        // When
        ResponseEntity<?> response = chatFileController.downloadFile(fileId);
        
        // Then
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }
}
