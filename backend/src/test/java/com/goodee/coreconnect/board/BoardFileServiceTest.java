package com.goodee.coreconnect.board;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.net.URL;
import java.lang.reflect.Field;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import com.goodee.coreconnect.board.dto.response.BoardFileResponseDTO;
import com.goodee.coreconnect.board.entity.Board;
import com.goodee.coreconnect.board.entity.BoardFile;
import com.goodee.coreconnect.board.repository.BoardFileRepository;
import com.goodee.coreconnect.board.repository.BoardRepository;
import com.goodee.coreconnect.board.service.BoardFileServiceImpl;
import com.goodee.coreconnect.common.service.S3Service;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

import jakarta.persistence.EntityNotFoundException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectResponse;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

@DisplayName("BoardFileService 단위 테스트")
class BoardFileServiceTest {

    @Mock
    private BoardFileRepository fileRepository;

    @Mock
    private BoardRepository boardRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private S3Service s3Service;

    @Mock
    private S3Client s3Client; // 실제 putObject() 호출 방지

    @Mock
    private S3Presigner presigner;

    @InjectMocks
    private BoardFileServiceImpl boardFileService;

    private User testUser;
    private Board testBoard;
    private BoardFile testFile;

    @BeforeEach
    void setUp() throws Exception {
        MockitoAnnotations.openMocks(this);

        // User 생성
        testUser = User.createUser(
                "password123",
                "테스트유저",
                Role.USER,
                "test@example.com",
                "010-1234-5678",
                null,
                null,
                null
        );

        // 리플렉션으로 ID 설정
        Field idField = User.class.getDeclaredField("id");
        idField.setAccessible(true);
        idField.set(testUser, 1);

        // 인증 정보 세팅
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(testUser.getEmail(), null, List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));

        testBoard = mock(Board.class);
        when(testBoard.getUser()).thenReturn(testUser);

        testFile = mock(BoardFile.class);

        // 올바른 방식 (리턴값이 있는 메서드 → doReturn)
        PutObjectResponse mockResponse = PutObjectResponse.builder().build();
        doReturn(mockResponse)
                .when(s3Client)
                .putObject(any(PutObjectRequest.class), any(RequestBody.class));

        // URL 반환 Mock
        when(s3Service.getFileUrl(any())).thenReturn("https://mock-s3/test.txt");

        // 다운로드 주소는 presigner가 만듦
        PresignedGetObjectRequest presigned = mock(PresignedGetObjectRequest.class);
        when(presigned.url()).thenReturn(new URL("https://mock-s3/presigned"));
        when(presigner.presignGetObject(any(GetObjectPresignRequest.class))).thenReturn(presigned);
    }

    @Test
    @DisplayName("파일 업로드 성공")
    void testUploadFiles() throws IOException {
        MockMultipartFile file = new MockMultipartFile(
                "files", "test.txt", "text/plain", "hello".getBytes());

        when(boardRepository.findById(anyInt())).thenReturn(Optional.of(testBoard));
        when(fileRepository.save(any(BoardFile.class)))
                .thenAnswer(invocation -> {
                    BoardFile bf = invocation.getArgument(0);
                    Field idField = BoardFile.class.getDeclaredField("id");
                    idField.setAccessible(true);
                    idField.set(bf, 1);
                    return bf;
                });

        List<BoardFileResponseDTO> result = boardFileService.uploadFiles(1, List.of(file));

        assertThat(result).isNotEmpty();
        assertThat(result.get(0).getFileName()).isEqualTo("test.txt");
        verify(fileRepository, times(1)).save(any(BoardFile.class));
    }

    @Test
    @DisplayName("파일 단건 조회 성공")
    void testGetFile() {
        when(fileRepository.findByIdAndDeletedYnFalse(anyInt())).thenReturn(Optional.of(testFile));
        when(testFile.getId()).thenReturn(1);
        when(testFile.getFileName()).thenReturn("sample.txt");
        when(testFile.getFileSize()).thenReturn(1024L);
        when(testFile.getS3ObjectKey()).thenReturn("key/sample.txt");
        when(testFile.getDeletedYn()).thenReturn(false);

        BoardFileResponseDTO dto = boardFileService.getFile(1);

        assertThat(dto.getFileName()).isEqualTo("sample.txt");
        assertThat(dto.getDeletedYn()).isFalse();
        verify(fileRepository, times(1)).findByIdAndDeletedYnFalse(1);
    }

    @Test
    @DisplayName("파일 목록 조회 성공")
    void testGetFilesByBoard() {
        when(fileRepository.findByBoardIdAndDeletedYnFalse(anyInt())).thenReturn(List.of(testFile));
        when(testFile.getId()).thenReturn(1);
        when(testFile.getFileName()).thenReturn("list.txt");
        when(testFile.getDeletedYn()).thenReturn(false);

        List<BoardFileResponseDTO> list = boardFileService.getFilesByBoard(1);

        assertThat(list).isNotEmpty();
        assertThat(list.get(0).getFileName()).isEqualTo("list.txt");
        verify(fileRepository, times(1)).findByBoardIdAndDeletedYnFalse(1);
    }

    @Test
    @DisplayName("파일 삭제 실패 - 인증 안됨")
    void testDeleteFileWithoutAuth() {
        when(fileRepository.findByIdAndDeletedYnFalse(anyInt())).thenReturn(Optional.of(testFile));
        when(testFile.getBoard()).thenReturn(testBoard);
        when(testBoard.getUser()).thenReturn(testUser);
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());

        org.junit.jupiter.api.Assertions.assertThrows(
                AccessDeniedException.class,
                () -> boardFileService.deleteFile(1)
        );
    }

    @Test
    @DisplayName("파일 조회 실패 - 존재하지 않음")
    void testGetFileNotFound() {
        when(fileRepository.findByIdAndDeletedYnFalse(anyInt())).thenReturn(Optional.empty());

        org.junit.jupiter.api.Assertions.assertThrows(
                EntityNotFoundException.class,
                () -> boardFileService.getFile(999)
        );
    }
}