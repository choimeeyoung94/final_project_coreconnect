package com.goodee.coreconnect.admin.dto.request;

import com.goodee.coreconnect.user.enums.JobGrade;
import com.goodee.coreconnect.user.enums.Role;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** 신규 사용자 생성 요청용 DTO */
public record CreateUserReqDTO(
 @Email 
 @NotBlank 
 String email,
 
 @NotBlank 
 String name,
 
 @NotBlank 
 String tempPassword, 
 
 String phone,
 
 @NotNull(message = "부서는 필수입니다.")
 Integer deptId,

 @NotNull(message = "직급은 필수입니다.")
 JobGrade jobGrade,
 
 @NotNull 
 Role role         
 
) {}

