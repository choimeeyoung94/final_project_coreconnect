package com.goodee.coreconnect.approval.dto.response;

import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.JobGrade;
import com.goodee.coreconnect.user.enums.Role;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class UserInfoResponseDTO {

  private Integer userId;
  private String userName;
  private String userEmail;
  private String deptName;
  private Role role;
  private JobGrade positionName;

  // User 엔티티를 DTO로 변환하는 정적 메소드
  public static UserInfoResponseDTO toDTO(User user) {
      return UserInfoResponseDTO.builder()
              .userId(user.getId())
              .userName(user.getName())
              .userEmail(user.getEmail())
              .deptName(user.getDepartment() != null ? user.getDepartment().getDeptName() : null)
              .positionName(user.getJobGrade())
              .role(user.getRole())
              .build();
  }
  
}
