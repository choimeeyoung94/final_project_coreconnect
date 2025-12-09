package com.goodee.coreconnect.admin.controller;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.goodee.coreconnect.admin.dto.request.CreateUserReqDTO;
import com.goodee.coreconnect.admin.dto.request.RejectLeaveRequestDTO;
import com.goodee.coreconnect.admin.dto.request.UpdateUserReqDTO;
import com.goodee.coreconnect.admin.service.AdminUserService;
import com.goodee.coreconnect.department.service.DepartmentService;
import com.goodee.coreconnect.security.userdetails.CustomUserDetails;
import com.goodee.coreconnect.user.dto.response.PasswordResetResponseDTO;
import com.goodee.coreconnect.user.dto.response.TempPasswordResponseDTO;
import com.goodee.coreconnect.user.dto.response.UserDTO;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.JobGrade;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.service.PasswordResetService;
import com.goodee.coreconnect.user.service.UserService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Slf4j
public class AdminUserController {
  
  private final AdminUserService adminUserService;
  private final UserService userService;
  private final DepartmentService departmentService;
  private final PasswordResetService passwordResetService;
  
  /** 신규 사용자 생성 */
  @PostMapping
  public UserDTO create(@Valid @RequestBody CreateUserReqDTO req) {
    return adminUserService.createUser(req);
  }
  
  /** 관리자용 사용자 목록 조회 */
  @GetMapping
  public List<UserDTO> findAllUsers() {
    return userService.findAllUsers();
  }
  
  /** 사용자 정보 수정 */
  @PutMapping("/{id}")
  public ResponseEntity<UserDTO> update(
      @PathVariable(name = "id") Integer id,
      @RequestBody UpdateUserReqDTO req
  ) {
    UserDTO updated = adminUserService.updateUser(id, req);
    return ResponseEntity.ok(updated);
  }
  
  /** 각종 통계를 제공해주는 메소드 */
  @GetMapping("/stats")
  public Map<String, Long> getAllStats() {
    Map<String, Long> stats = new HashMap<>();
    stats.put("totalUsers", adminUserService.getAllUserCount());
    stats.put("activeUsers", adminUserService.getAllActiveUserCount());
    stats.put("departments", departmentService.getAllDepartmentCount());
    return stats;
  }
  
  /** 사용 가능한 Role 목록 조회(서비스X) */
  @GetMapping("/roles")
  public List<String> getRoles() {
    return Arrays.stream(Role.values())
                 .map(Enum::name)
                 .collect(Collectors.toList());
  }
  
  /** 사용 가능한 직급 목록 조회(서비스X) */
  @GetMapping("/job-grades")
  public List<Map<String, String>> getJobGrades() {
    return Arrays.stream(JobGrade.values())
                 .map(grade -> Map.of(
                       "value", grade.name()
                     ))
                 .collect(Collectors.toList());
  }
  
  /** 비밀번호 변경 요청 조회 */
  @GetMapping("/password-reset/requests")
  public List<PasswordResetResponseDTO> getRequest(@RequestParam(name = "status", required = false) String status) {
    log.info("password-reset: {}", passwordResetService.getRequests(status));
    return passwordResetService.getRequests(status);
  }
  
  /** 비밀번호 변경 요청 승인 */
  @PutMapping("/password-reset/requests/{id}/approve")
  public ResponseEntity<Map<String, String>> approve(@PathVariable(name = "id") Long id,
                                                         @AuthenticationPrincipal CustomUserDetails customUserDetails) {
    String email = customUserDetails.getEmail();
    User user = userService.getUserByEmail(email);
    String externalEmail = passwordResetService.approve(id, user);
    Map<String, String> response = new HashMap<>();
    response.put("externalEmail", externalEmail);
    return ResponseEntity.ok(response);
  }
  
  /** 비밀번호 변경 요청 거절 */
  @PutMapping("/password-reset/requests/{id}/reject")
  public ResponseEntity<TempPasswordResponseDTO> reject(
      @PathVariable(name = "id") Long id,
      @AuthenticationPrincipal CustomUserDetails customUserDetails,
      @RequestBody RejectLeaveRequestDTO rejectReason
  ) {
      String email = customUserDetails.getEmail();
      User user = userService.getUserByEmail(email);
      passwordResetService.reject(id, user, rejectReason);
      return ResponseEntity.noContent().build();
  }
  
}
