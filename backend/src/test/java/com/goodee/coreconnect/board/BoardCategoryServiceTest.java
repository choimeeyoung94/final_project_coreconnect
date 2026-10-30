package com.goodee.coreconnect.board;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.goodee.coreconnect.board.dto.request.BoardCategoryRequestDTO;
import com.goodee.coreconnect.board.dto.response.BoardCategoryResponseDTO;
import com.goodee.coreconnect.board.entity.BoardCategory;
import com.goodee.coreconnect.board.repository.BoardCategoryRepository;
import com.goodee.coreconnect.board.repository.BoardRepository;
import com.goodee.coreconnect.board.service.BoardCategoryServiceImpl;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

import org.springframework.security.access.AccessDeniedException;

@ExtendWith(MockitoExtension.class)
@DisplayName("BoardCategoryService 단위 테스트 (실제 User 객체 사용)")
class BoardCategoryServiceTest {

    @Mock
    private BoardCategoryRepository categoryRepository;

    @Mock
    private BoardRepository boardRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private BoardCategoryServiceImpl categoryService;

    private User adminUser;
    private User normalUser;
    private BoardCategory testCategory;

    @BeforeEach
    void setup() {
        // 실제 관리자 객체
        adminUser = User.createUser(
                "password123",
                "관리자",
                Role.ADMIN,
                "admin@test.com",
                "010-1111-2222",
                 null,
                 null,
                 null
        );

        // 실제 일반 사용자 객체
        normalUser = User.createUser(
                "password456",
                "일반유저",
                Role.USER,
                "user@test.com",
                "010-3333-4444",
                null,
                null,
                null
        );

        // 테스트용 카테고리 엔티티
        testCategory = BoardCategory.createCategory("공지사항", 1);
    }

    @Test
    @DisplayName("관리자가 카테고리 등록 성공")
    void testCreateCategory_Success() {
        BoardCategoryRequestDTO dto = new BoardCategoryRequestDTO("공지사항", 1);

        when(userRepository.findByEmail("admin@test.com")).thenReturn(Optional.of(adminUser));
        when(categoryRepository.existsByNameAndDeletedYnFalse("공지사항")).thenReturn(false);
        when(categoryRepository.save(any(BoardCategory.class))).thenReturn(testCategory);

        BoardCategoryResponseDTO result = categoryService.createCategory(dto, "admin@test.com");

        assertThat(result).isNotNull();
        assertThat(result.getName()).isEqualTo("공지사항");
        verify(categoryRepository, times(1)).save(any(BoardCategory.class));
    }

    @Test
    @DisplayName("일반 사용자는 카테고리 등록 실패 (권한 없음)")
    void testCreateCategory_FailByRole() {
        BoardCategoryRequestDTO dto = new BoardCategoryRequestDTO("부서게시판", 2);

        when(userRepository.findByEmail("user@test.com")).thenReturn(Optional.of(normalUser));

        assertThrows(AccessDeniedException.class, () ->
                categoryService.createCategory(dto, "user@test.com")
        );
    }

    @Test
    @DisplayName("관리자가 카테고리 수정 성공")
    void testUpdateCategory_Success() {
        BoardCategoryRequestDTO dto = new BoardCategoryRequestDTO("수정된공지", 5);

        when(userRepository.findByEmail("admin@test.com")).thenReturn(Optional.of(adminUser));
        when(categoryRepository.findByIdAndDeletedYnFalse(1)).thenReturn(Optional.of(testCategory));

        BoardCategoryResponseDTO result = categoryService.updateCategory(1, dto, "admin@test.com");

        assertThat(result.getName()).isEqualTo("수정된공지");
        verify(categoryRepository, times(1)).findByIdAndDeletedYnFalse(1);
    }

    @Test
    @DisplayName("관리자가 카테고리 삭제 성공 (Soft Delete)")
    void testDeleteCategory_Success() {
        when(userRepository.findByEmail("admin@test.com")).thenReturn(Optional.of(adminUser));
        when(categoryRepository.findByIdAndDeletedYnFalse(1)).thenReturn(Optional.of(testCategory));

        categoryService.deleteCategory(1, "admin@test.com");

        assertThat(testCategory.getDeletedYn()).isTrue();  // Soft Delete 확인
        verify(categoryRepository, times(1)).findByIdAndDeletedYnFalse(1);
    }

    @Test
    @DisplayName("전체 카테고리 목록 조회 성공")
    void testGetAllCategories() {
        when(categoryRepository.findByDeletedYnFalseOrderByOrderNoAsc())
                .thenReturn(List.of(testCategory));

        List<BoardCategoryResponseDTO> list = categoryService.getAllCategories();

        assertThat(list).hasSize(1);
        assertThat(list.get(0).getName()).isEqualTo("공지사항");
        verify(categoryRepository, times(1)).findByDeletedYnFalseOrderByOrderNoAsc();
    }

    @Test
    @DisplayName("카테고리명 중복 여부 확인")
    void testIsCategoryNameExists() {
        when(categoryRepository.existsByNameAndDeletedYnFalse("공지사항")).thenReturn(true);

        boolean result = categoryService.isCategoryNameExists("공지사항");

        assertThat(result).isTrue();
        verify(categoryRepository, times(1)).existsByNameAndDeletedYnFalse("공지사항");
    }
}