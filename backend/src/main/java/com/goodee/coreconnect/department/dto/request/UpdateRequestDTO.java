package com.goodee.coreconnect.department.dto.request;

/**
 * 부서 수정 요청용 DTO
 */
public record UpdateRequestDTO(
    
    // 부서 이름: null일 경우 변경하지 않음
    String name, 
    
    // 정렬 순서: null일 경우 변경하지 않음 (화살표 버튼으로만 변경 가능)
    Integer orderNo) {}
