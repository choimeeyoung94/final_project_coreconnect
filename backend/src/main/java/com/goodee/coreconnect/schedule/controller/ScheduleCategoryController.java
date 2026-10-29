package com.goodee.coreconnect.schedule.controller;

import java.util.List;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.goodee.coreconnect.schedule.dto.request.RequestScheduleCategoryDTO;
import com.goodee.coreconnect.schedule.dto.response.ResponseScheduleCategoryDTO;
import com.goodee.coreconnect.schedule.service.ScheduleCategoryService;
import com.goodee.coreconnect.security.userdetails.CustomUserDetails;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@Tag(name = "ScheduleCategory API", description = "일정 카테고리 API")
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/scheduleCategories")
@SecurityRequirement(name = "bearerAuth")
public class ScheduleCategoryController {

  private final ScheduleCategoryService scheduleCategoryService;

  /** 카테고리 생성 */
  @Operation(summary = "카테고리 생성", description = "새로운 카테고리를 생성합니다.")
  @PostMapping
  public ResponseScheduleCategoryDTO create(@Valid @RequestBody RequestScheduleCategoryDTO dto, @AuthenticationPrincipal CustomUserDetails user) {
    String email = user.getEmail();
    return scheduleCategoryService.createCategory(dto, email);
  }

  /** 카테고리 수정 */
  @Operation(summary = "카테고리 수정", description = "기존의 카테고리를 수정합니다.")
  @PutMapping("/{id}")
  public ResponseScheduleCategoryDTO update(@PathVariable("id") Integer id,
                                            @Valid @RequestBody RequestScheduleCategoryDTO dto,
                                            @AuthenticationPrincipal CustomUserDetails user) {
    return scheduleCategoryService.updateCategory(id, dto, user.getEmail());
  }

  /** 카테고리 삭제 */
  @Operation(summary = "카테고리 삭제", description = "기존의 카테고리를 수정합니다.")
  @DeleteMapping("/{id}")
  public void delete(@PathVariable("id") Integer id, @AuthenticationPrincipal CustomUserDetails user) {
    scheduleCategoryService.deleteCategory(id, user.getEmail());
  }

  /** 특정 유저의 카테고리 목록 조회 */
  @GetMapping
  public List<ResponseScheduleCategoryDTO> getUserCategories(@AuthenticationPrincipal CustomUserDetails user) {
    String email = user.getEmail();
    return scheduleCategoryService.getUserCategories(email);
  }
  
//  /** 특정 유저의 카테고리 목록 조회 (관리자) */
//  @GetMapping(params = "userId")
//  public List<ResponseScheduleCategoryDTO> getUserCategories(@RequestParam("userId") Integer userId) {
//    return scheduleCategoryService.getUserCategories(email);
//  }
  

}

