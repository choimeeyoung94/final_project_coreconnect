package com.goodee.coreconnect.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import com.goodee.coreconnect.support.AbstractIntegrationTest;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.JobGrade;
import com.goodee.coreconnect.user.repository.UserRepository;

/** open 모드에서 로그인으로 자동 생성되는 부하 테스트·개발용 계정도 직급을 가져야 한다 */
@AutoConfigureMockMvc
@TestPropertySource(properties = "security.mode=open")
class OpenModeLoginUserTest extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private UserRepository userRepository;

  @Test
  @DisplayName("open 모드 로그인으로 자동 생성된 계정의 직급은 사원이다")
  void login_autoCreatedUser_hasJobGrade() throws Exception {
    String email = "load-" + UUID.randomUUID() + "@test.com";

    mockMvc.perform(post("/api/v1/auth/login")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"email\":\"" + email + "\",\"password\":\"pw1234\"}"));

    User created = userRepository.findByEmail(email).orElseThrow();
    assertThat(created.getJobGrade()).isEqualTo(JobGrade.STAFF);
  }
}
