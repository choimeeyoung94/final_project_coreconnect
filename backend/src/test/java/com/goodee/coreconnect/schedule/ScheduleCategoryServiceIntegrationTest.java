package com.goodee.coreconnect.schedule;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import com.goodee.coreconnect.schedule.dto.request.RequestScheduleCategoryDTO;
import com.goodee.coreconnect.schedule.dto.response.ResponseScheduleCategoryDTO;
import com.goodee.coreconnect.schedule.entity.ScheduleCategory;
import com.goodee.coreconnect.schedule.repository.ScheduleCategoryRepository;
import com.goodee.coreconnect.schedule.service.ScheduleCategoryService;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.repository.UserRepository;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@SpringBootTest
@Transactional
public class ScheduleCategoryServiceIntegrationTest {

  @Autowired
  private ScheduleCategoryService categoryService;

  @Autowired
  private ScheduleCategoryRepository categoryRepository;

  @Autowired
  private UserRepository userRepository;

  private User testUser;

  @BeforeEach
  void setUp() {
    testUser = userRepository.findById(10)
            .orElseThrow(() -> new IllegalStateException("user_id=10 유저가 없습니다."));
  }

  @Test
  @DisplayName("1️⃣카테고리 생성 테스트 (이메일 기반)")
  void testCreateCategory() {
    RequestScheduleCategoryDTO dto = RequestScheduleCategoryDTO.builder()
            .name("개인 일정")
            .defaultYn(false)
            .build();

    ResponseScheduleCategoryDTO response = categoryService.createCategory(dto, testUser.getEmail());

    assertThat(response).isNotNull();
    assertThat(response.getName()).isEqualTo("개인 일정");
    log.info("카테고리 생성 성공: " + response);
  }

  @Test
  @DisplayName("2️⃣카테고리 수정 테스트")
  void testUpdateCategory() {
    ScheduleCategory saved = categoryRepository.save(
            ScheduleCategory.createScheduleCategory(testUser, "업무 일정", false));

    RequestScheduleCategoryDTO dto = RequestScheduleCategoryDTO.builder()
            .name("변경된 일정")
            .defaultYn(true)
            .build();

    ResponseScheduleCategoryDTO response = categoryService.updateCategory(saved.getId(), dto, testUser.getEmail());

    assertThat(response.getName()).isEqualTo("변경된 일정");
    assertThat(response.isDefaultYn()).isTrue();
    log.info("수정 성공: " + response);
  }

  @Test
  @DisplayName("3️⃣특정 유저의 카테고리 목록 조회 테스트 (이메일 기반)")  
  void testGetUserCategories() {
    categoryRepository.save(ScheduleCategory.createScheduleCategory(testUser, "테스트1", false));
    categoryRepository.save(ScheduleCategory.createScheduleCategory(testUser, "테스트2", true));


    List<ResponseScheduleCategoryDTO> list = categoryService.getUserCategories(testUser.getEmail());

    assertThat(list).isNotEmpty();
    log.info("유저 카테고리 목록 조회 성공: " + list.size() + "건");
  }

  @Test
  @DisplayName("4️⃣카테고리 삭제 테스트 (Soft Delete)")
  void testDeleteCategory() {
    ScheduleCategory saved = categoryRepository.save(
            ScheduleCategory.createScheduleCategory(testUser, "삭제할 카테고리", false));

    categoryService.deleteCategory(saved.getId(), testUser.getEmail());

    ScheduleCategory deleted = categoryRepository.findById(saved.getId()).orElseThrow();
    assertThat(deleted.getDeletedYn()).isTrue();
    log.info("삭제 성공 (Soft Delete): ID=" + deleted.getId());
  }
}
