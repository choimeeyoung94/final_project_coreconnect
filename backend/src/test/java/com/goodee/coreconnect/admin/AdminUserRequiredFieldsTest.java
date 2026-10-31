package com.goodee.coreconnect.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.goodee.coreconnect.department.entity.Department;
import com.goodee.coreconnect.department.repository.DepartmentRepository;
import com.goodee.coreconnect.security.jwt.JwtProvider;
import com.goodee.coreconnect.support.AbstractIntegrationTest;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.JobGrade;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

import jakarta.servlet.http.Cookie;

/**
 * 사용자 생성 필수값 테스트 - 부서와 직급이 없는 사용자가 저장되지 않아야 한다
 *
 * 화면을 거치지 않은 API 직접 호출로 보고, 응답 코드와 DB 저장 여부를 함께 확인한다.
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = "security.mode=secure")
class AdminUserRequiredFieldsTest extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtProvider jwtProvider;
  @Autowired private ObjectMapper objectMapper;
  @Autowired private UserRepository userRepository;
  @Autowired private DepartmentRepository departmentRepository;

  @Test
  @DisplayName("직급을 빼고 보내면 400이고 사용자가 저장되지 않는다")
  void create_withoutJobGrade_rejected() throws Exception {
    Map<String, Object> body = validBody();
    body.remove("jobGrade");

    mockMvc.perform(asAdmin(body))
        .andExpect(status().isBadRequest())
        .andExpect(content().string(containsString("직급은 필수입니다.")));

    assertThat(userRepository.existsByEmail((String) body.get("email"))).isFalse();
  }

  @Test
  @DisplayName("화면처럼 직급을 빈 문자열로 보내면 400이고 사용자가 저장되지 않는다")
  void create_emptyJobGrade_rejected() throws Exception {
    Map<String, Object> body = validBody();
    body.put("jobGrade", "");

    mockMvc.perform(asAdmin(body))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value("입력한 값의 형식이 올바르지 않습니다. 입력 내용을 확인해 주세요."));

    assertThat(userRepository.existsByEmail((String) body.get("email"))).isFalse();
  }

  @Test
  @DisplayName("부서를 빼고 보내면 400이고 사용자가 저장되지 않는다")
  void create_withoutDepartment_rejected() throws Exception {
    Map<String, Object> body = validBody();
    body.remove("deptId");

    assertRejected(body);
  }

  @Test
  @DisplayName("부서와 직급이 있으면 사용자가 저장된다. 사장도 최상위 부서로 만들 수 있다")
  void create_withDepartmentAndJobGrade_saved() throws Exception {
    Map<String, Object> body = validBody();
    body.put("jobGrade", JobGrade.PRESIDENT.name());

    mockMvc.perform(asAdmin(body)).andExpect(status().isOk());

    User saved = userRepository.findByEmailWithDepartment((String) body.get("email")).orElseThrow();
    assertThat(saved.getJobGrade()).isEqualTo(JobGrade.PRESIDENT);
    assertThat(saved.getDepartment().getDeptName()).isEqualTo("코어커넥트 1.0");
  }

  private void assertRejected(Map<String, Object> body) throws Exception {
    mockMvc.perform(asAdmin(body)).andExpect(status().isBadRequest());

    assertThat(userRepository.existsByEmail((String) body.get("email"))).isFalse();
  }

  private Map<String, Object> validBody() {
    Department department = departmentRepository.save(Department.createDepartment("코어커넥트 1.0", 1));
    Map<String, Object> body = new HashMap<>();
    body.put("email", "new-" + UUID.randomUUID() + "@test.com");
    body.put("name", "신규직원");
    body.put("tempPassword", "pw1234");
    body.put("deptId", department.getId());
    body.put("jobGrade", JobGrade.STAFF.name());
    body.put("role", Role.USER.name());
    return body;
  }

  private MockHttpServletRequestBuilder asAdmin(Map<String, Object> body) throws Exception {
    String email = "admin-" + UUID.randomUUID() + "@test.com";
    User admin = userRepository.save(User.createUser("pw", "관리자", Role.ADMIN, email, null, null, JobGrade.PRESIDENT, null));
    String token = jwtProvider.createAccess(admin.getEmail(), admin.getRole(), 30);
    return post("/api/v1/admin/users")
        .cookie(new Cookie("access_token", token))
        .contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(body));
  }
}
