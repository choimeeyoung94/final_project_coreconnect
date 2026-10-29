package com.goodee.coreconnect.schedule.service;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.goodee.coreconnect.schedule.dto.request.RequestScheduleCategoryDTO;
import com.goodee.coreconnect.schedule.dto.response.ResponseScheduleCategoryDTO;
import com.goodee.coreconnect.schedule.entity.ScheduleCategory;
import com.goodee.coreconnect.schedule.repository.ScheduleCategoryRepository;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class ScheduleCategoryServiceImpl implements ScheduleCategoryService {

  private final ScheduleCategoryRepository scheduleCategoryRepository;
  private final UserRepository userRepository;

  /** 카테고리 생성 */
  @Override
  public ResponseScheduleCategoryDTO createCategory(RequestScheduleCategoryDTO dto, String email) {
    
    User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new IllegalArgumentException("유저가 존재하지 않습니다."));

    ScheduleCategory category = dto.toEntity(user);
    ScheduleCategory saved = scheduleCategoryRepository.save(category);
    return ResponseScheduleCategoryDTO.toDTO(saved);
  }

  /** 카테고리 수정 (이름, 기본 여부 변경) */
  @Override
  public ResponseScheduleCategoryDTO updateCategory(Integer id, RequestScheduleCategoryDTO dto, String email) {

    ScheduleCategory category = scheduleCategoryRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("카테고리를 찾을 수 없습니다."));
    assertOwner(category, email);

    category.rename(dto.getName());
    category.changeDefault(dto.isDefaultYn());

    return ResponseScheduleCategoryDTO.toDTO(category);
  }

  /** 카테고리 삭제 (Soft Delete) */
  @Override
  public void deleteCategory(Integer id, String email) {

    ScheduleCategory category = scheduleCategoryRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("카테고리를 찾을 수 없습니다."));
    assertOwner(category, email);

    // 기본 카테고리(defaultYn = true)면 삭제 불가
    if (Boolean.TRUE.equals(category.getDefaultYn())) {
        throw new IllegalStateException("기본 카테고리는 삭제할 수 없습니다.");
    }

    // 엔티티의 delete() 메서드 호출
    category.deleteWithSchedules();
  }
  

  /** 특정 유저의 카테고리 목록 조회 (삭제 제외) */
  @Override
  @Transactional(readOnly = true)
  public List<ResponseScheduleCategoryDTO> getUserCategories(String email) {
    
    User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new IllegalArgumentException("유저가 존재하지 않습니다."));

    return scheduleCategoryRepository.findAvailableCategories(user)
                                      .stream()
                                      .filter(category -> !category.getDeletedYn()) // 삭제되지 않은 항목만
                                      .map(ResponseScheduleCategoryDTO::toDTO)
                                      .collect(Collectors.toList());
  }
  

  /** 카테고리를 만든 사용자인지 확인 */
  private void assertOwner(ScheduleCategory category, String email) {
    if (category.getUser() == null || !category.getUser().getEmail().equals(email)) {
      throw new SecurityException("본인이 만든 카테고리만 변경할 수 있습니다.");
    }
  }
}

