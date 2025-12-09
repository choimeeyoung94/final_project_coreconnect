package com.goodee.coreconnect.department.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 부서 생성 요청 전달용 DTO
 */
public record CreateRequestDTO(
    @NotBlank(message = "부서 이름은 비워둘 수 없습니다.")
    @Size(max = 50, message = "부서 이름은 50자 이내여야 합니다.")
    String name,
    
    // 정렬 순서: null일 경우 자동 계산 (같은 parentId 내 최대값 + 10)
    Integer orderNo,
    
    // 최상위 부서일 경우 Null 허용
    Integer parentId) {}
