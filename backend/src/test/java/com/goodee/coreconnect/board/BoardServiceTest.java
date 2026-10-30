package com.goodee.coreconnect.board;

import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.transaction.annotation.Transactional;

import com.goodee.coreconnect.support.AbstractIntegrationTest;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;

import com.goodee.coreconnect.board.dto.request.BoardRequestDTO;
import com.goodee.coreconnect.board.dto.response.BoardResponseDTO;
import com.goodee.coreconnect.board.entity.Board;
import com.goodee.coreconnect.board.entity.BoardCategory;
import com.goodee.coreconnect.board.repository.BoardCategoryRepository;
import com.goodee.coreconnect.board.repository.BoardRepository;
import com.goodee.coreconnect.board.service.BoardService;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Transactional
@WithMockUser(username = "admin@example.com", roles = "ADMIN")
class BoardServiceTest extends AbstractIntegrationTest {

    @Autowired
    private BoardService boardService;
    @Autowired
    private BoardRepository boardRepository;
    @Autowired
    private BoardCategoryRepository categoryRepository;
    @Autowired
    private UserRepository userRepository;

    private User user;
    private BoardCategory category;

    @BeforeEach
    void setUp() {
        // 테스트용 사용자 준비 (빈 DB에서도 돌도록 없으면 만듦)
        user = userRepository.findByEmail("admin@example.com")
                .orElseGet(() -> userRepository.saveAndFlush(User.createUser("pw123", "게시판관리자", Role.ADMIN,
                        "admin@example.com", "010-0000-0000", null, null, null)));
        log.info("테스트 유저 로드 완료: {}", user.getName());

        // 테스트용 카테고리 확인 및 생성
        category = categoryRepository.findByDeletedYnFalseOrderByOrderNoAsc()
                .stream()
                .findFirst()
                .orElseGet(() -> {
                    // createCategory() 내부에서도 deletedYn=false 세팅되지만 명시적으로 한 번 더 안전장치
                    BoardCategory newCategory = BoardCategory.createCategory("테스트카테고리", 1);
                    newCategory.delete(); // 이건 삭제가 아니라 확인용이라 사용하지 않음
                    newCategory = BoardCategory.createCategory("테스트카테고리", 1);
                    return categoryRepository.saveAndFlush(newCategory);
                });

        log.info("테스트 카테고리 사용: {}", category.getName());
    }

    @Test
    @DisplayName("게시글 등록")
    void testCreateBoard() {
        BoardRequestDTO dto = BoardRequestDTO.builder()
                                             .categoryId(category.getId())
                                             .title("첫 게시글")
                                             .content("내용입니다.")
                                             .noticeYn(false)
                                             .privateYn(false)
                                             .build();

        BoardResponseDTO response = boardService.createBoard(dto, user.getEmail());

        assertThat(response).isNotNull();
        assertThat(response.getId()).isNotNull();
        assertThat(response.getTitle()).isEqualTo("첫 게시글");
        assertThat(response.getWriterName()).isEqualTo(user.getName());
        log.info("등록 테스트 통과: {}", response);
    }

    @Test
    @DisplayName("게시글 수정")
    void testUpdateBoard() {
        BoardRequestDTO dto = BoardRequestDTO.builder()
                                             .categoryId(category.getId())
                                             .title("수정 전 제목")
                                             .content("수정 전 내용")
                                             .build();

        BoardResponseDTO created = boardService.createBoard(dto, user.getEmail());

        BoardRequestDTO updateDto = BoardRequestDTO.builder()
                .title("수정된 제목")
                .content("수정된 내용")
                .build();

        BoardResponseDTO updated = boardService.updateBoard(created.getId(), updateDto);

        assertThat(updated.getTitle()).isEqualTo("수정된 제목");
        assertThat(updated.getContent()).isEqualTo("수정된 내용");
        log.info("수정 테스트 통과: {}", updated);
    }

    @Test
    @DisplayName("게시글 Soft Delete")
    void testSoftDeleteBoard() {
        BoardRequestDTO dto = BoardRequestDTO.builder()
                .categoryId(category.getId())
                .title("삭제 테스트")
                .content("삭제 내용")
                .build();

        BoardResponseDTO created = boardService.createBoard(dto, user.getEmail());

        boardService.softDeleteBoard(created.getId());

        Board deleted = boardRepository.findById(created.getId())
                .orElseThrow(() -> new IllegalStateException("게시글이 존재하지 않음"));
        assertThat(deleted.getDeletedYn()).isTrue();
        log.info("삭제 테스트 통과: {}", deleted.getTitle());
    }

//    @Test
//    @DisplayName("게시글 상세 조회 (조회수 증가 포함)")
//    void testGetBoardById() {
//        BoardRequestDTO dto = BoardRequestDTO.builder()
//                                             .categoryId(category.getId())
//                                             .title("조회 테스트")
//                                             .content("내용입니다.")
//                                             .build();
//
//        BoardResponseDTO created = boardService.createBoard(dto, user.getEmail());
//
//        BoardResponseDTO found = boardService.getBoardById(created.getId());
//
//        assertThat(found.getId()).isEqualTo(created.getId());
//        assertThat(found.getViewCount()).isEqualTo(1);
//        log.info("상세조회 테스트 통과: {}", found.getTitle());
//    }

    @Test
    @DisplayName("카테고리별 게시글 목록 조회")
    void testGetBoardsByCategory() {
        for (int i = 1; i <= 3; i++) {
            BoardRequestDTO dto = BoardRequestDTO.builder()
                                                 .categoryId(category.getId())
                                                 .title("카테고리 게시글 " + i)
                                                 .content("내용 " + i)
                                                 .build();
            boardService.createBoard(dto, user.getEmail());
        }

        var page = boardService.getBoardsByCategory(category.getId(), PageRequest.of(0, 10));

        assertThat(page.getContent()).hasSize(3);
        assertThat(page.getContent().get(0).getCategoryName()).isEqualTo(category.getName());
        log.info("카테고리별 조회 테스트 통과: {}개 게시글", page.getContent().size());
    }

    @Test
    @DisplayName("사용자 이메일 기반 게시글 목록 조회")
    void testGetBoardsByUser() {
        for (int i = 1; i <= 2; i++) {
            BoardRequestDTO dto = BoardRequestDTO.builder()
                                                 .categoryId(category.getId())
                                                 .title("유저 게시글 " + i)
                                                 .content("유저 내용 " + i)
                                                 .build();
            boardService.createBoard(dto, user.getEmail());
        }

        var page = boardService.getBoardsByUser(user.getEmail(), PageRequest.of(0, 10));

        assertThat(page.getContent()).hasSize(2);
        assertThat(page.getContent().get(0).getWriterName()).isEqualTo(user.getName());
        log.info("사용자별 조회 테스트 통과: {}개 게시글", page.getContent().size());
    }

    @Test
    @DisplayName("공지글 목록 조회")
    void testGetNoticeBoards() {
        BoardRequestDTO noticeDto = BoardRequestDTO.builder()
                                                   .categoryId(category.getId())
                                                   .title("공지사항 게시글")
                                                   .content("공지 내용입니다.")
                                                   .noticeYn(true)
                                                   .build();
        boardService.createBoard(noticeDto, user.getEmail());

        List<BoardResponseDTO> notices = boardService.getNoticeBoards();

        assertThat(notices).isNotEmpty();
        assertThat(notices.get(0).getNoticeYn()).isTrue();
        log.info("공지글 조회 테스트 통과: {}", notices.get(0).getTitle());
    }
    
//    @Test
//    @DisplayName("상단고정 → 공지 → 최신순 정렬 목록 조회")
//    void testGetBoardsOrdered() {
//        // 일반 게시글
//        BoardRequestDTO dto1 = BoardRequestDTO.builder()
//                .categoryId(category.getId())
//                .title("일반글")
//                .content("일반 내용")
//                .noticeYn(false)
//                .privateYn(false)
//                .pinned(false)
//                .build();
//
//        // 공지글
//        BoardRequestDTO dto2 = BoardRequestDTO.builder()
//                .categoryId(category.getId())
//                .title("공지글")
//                .content("공지 내용")
//                .noticeYn(true)
//                .privateYn(false)
//                .pinned(false)
//                .build();
//
//        // 상단고정 게시글
//        BoardRequestDTO dto3 = BoardRequestDTO.builder()
//                .categoryId(category.getId())
//                .title("상단고정글")
//                .content("고정 내용")
//                .noticeYn(false)
//                .privateYn(false)
//                .pinned(true)
//                .build();
//
//        boardService.createBoard(dto1, user.getEmail());
//        boardService.createBoard(dto2, user.getEmail());
//        boardService.createBoard(dto3, user.getEmail());
//
//        var page = boardService.getBoardsOrdered(PageRequest.of(0, 10));
//
//        assertThat(page.getContent()).hasSize(3);
//
//        // 순서 검증: pinned → notice → 일반 순서
//        String first = page.getContent().get(0).getTitle();
//        String second = page.getContent().get(1).getTitle();
//        String third = page.getContent().get(2).getTitle();
//
//        log.info("정렬 결과: 1️⃣ {} / 2️⃣ {} / 3️⃣ {}", first, second, third);
//
//        assertThat(first).isEqualTo("상단고정글");
//        assertThat(second).isEqualTo("공지글");
//        assertThat(third).isEqualTo("일반글");
//
//        log.info("상단고정 → 공지 → 일반 정렬 테스트 통과 ✅");
//    }

    @Test
    @DisplayName("검색 기능 (제목, 내용, 작성자명) 테스트")
    void testSearchBoards() {
        boardService.createBoard(BoardRequestDTO.builder()
                                                .categoryId(category.getId())
                                                .title("검색용 제목 테스트")
                                                .content("본문 내용입니다.")
                                                .build(), user.getEmail());

        var titleResult = boardService.searchBoards("title", "제목", PageRequest.of(0, 10));
        var contentResult = boardService.searchBoards("content", "본문", PageRequest.of(0, 10));
        var authorResult = boardService.searchBoards("author", user.getName(), PageRequest.of(0, 10));

        assertThat(titleResult.getContent()).isNotEmpty();
        assertThat(contentResult.getContent()).isNotEmpty();
        assertThat(authorResult.getContent()).isNotEmpty();

        log.info("검색 테스트 통과: 제목={}, 내용={}, 작성자={}",
                titleResult.getTotalElements(), contentResult.getTotalElements(), authorResult.getTotalElements());
    }
}