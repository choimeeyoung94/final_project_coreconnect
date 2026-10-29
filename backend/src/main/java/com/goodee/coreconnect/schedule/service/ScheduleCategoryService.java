package com.goodee.coreconnect.schedule.service;

import java.util.List;

import com.goodee.coreconnect.schedule.dto.request.RequestScheduleCategoryDTO;
import com.goodee.coreconnect.schedule.dto.response.ResponseScheduleCategoryDTO;

public interface ScheduleCategoryService {

  ResponseScheduleCategoryDTO createCategory(RequestScheduleCategoryDTO dto, String email);

  /** 카테고리 주인만 수정 가능 (아니면 SecurityException → 403) */
  ResponseScheduleCategoryDTO updateCategory(Integer id, RequestScheduleCategoryDTO dto, String email);

  /** 카테고리 주인만 삭제 가능 (아니면 SecurityException → 403) */
  void deleteCategory(Integer id, String email);

  List<ResponseScheduleCategoryDTO> getUserCategories(String email);
  
}
