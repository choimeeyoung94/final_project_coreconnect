package com.goodee.coreconnect.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.goodee.coreconnect.chat.repository.NotificationRepository;
import com.goodee.coreconnect.common.entity.Notification;
import com.goodee.coreconnect.common.notification.enums.NotificationType;
import com.goodee.coreconnect.security.jwt.JwtProvider;
import com.goodee.coreconnect.support.AbstractIntegrationTest;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

import jakarta.servlet.http.Cookie;

/**
 * 알림 읽음 API를 하나로 합친 뒤의 동작 (PUT /api/v1/notification/{id}/read)
 * - 규칙은 NotificationService.markAsRead 한 곳: 본인 알림만, 이미 읽었으면 읽은 시각 그대로
 * - 응답은 프론트가 쓰던 모양(ResponseDTO: {status, message, data})
 * - 옛 주소 /api/v1/chat/notifications/{id}/read 는 없어짐
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = "security.mode=secure")
class NotificationReadApiTest extends AbstractIntegrationTest {

  private static final String READ = "/api/v1/notification/{id}/read";

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtProvider jwtProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private NotificationRepository notificationRepository;

  @Test
  @DisplayName("본인 알림을 읽음 처리하면 200, 읽음으로 바뀌고 응답은 ResponseDTO로 감싼 모양이다")
  void ownNotification_markedRead() throws Exception {
    User b = newUser("b");
    Notification n = notificationOf(b);

    mockMvc.perform(as(b, put(READ, n.getId())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.notificationId").value(n.getId()))
        .andExpect(jsonPath("$.data.readYn").value(true));

    assertThat(reload(n).getNotificationReadYn()).isTrue();
    assertThat(reload(n).getNotificationReadAt()).isNotNull();
  }

  @Test
  @DisplayName("이미 읽은 알림을 다시 읽음 처리해도 200이고, 읽은 시각은 바뀌지 않는다")
  void alreadyRead_keepsReadAt() throws Exception {
    User b = newUser("b");
    Notification n = notificationOf(b);
    mockMvc.perform(as(b, put(READ, n.getId()))).andExpect(status().isOk());
    LocalDateTime firstReadAt = reload(n).getNotificationReadAt();
    Thread.sleep(1100);

    mockMvc.perform(as(b, put(READ, n.getId()))).andExpect(status().isOk());

    assertThat(reload(n).getNotificationReadAt().truncatedTo(ChronoUnit.MILLIS))
        .as("두 번째 읽음 처리 뒤 읽은 시각").isEqualTo(firstReadAt.truncatedTo(ChronoUnit.MILLIS));
  }

  @Test
  @DisplayName("남의 알림이면 403이고 안 읽음으로 남는다")
  void othersNotification_forbidden() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    Notification n = notificationOf(b);

    mockMvc.perform(as(a, put(READ, n.getId()))).andExpect(status().isForbidden());

    assertThat(reload(n).getNotificationReadYn()).isFalse();
  }

  @Test
  @DisplayName("없는 알림이면 400")
  void missingNotification_badRequest() throws Exception {
    User b = newUser("b");
    mockMvc.perform(as(b, put(READ, 99_999_999))).andExpect(status().isBadRequest());
  }

  @Test
  @DisplayName("옛 주소 /api/v1/chat/notifications/{id}/read 는 더 이상 없다")
  void oldChatPath_removed() throws Exception {
    User b = newUser("b");
    Notification n = notificationOf(b);

    int code = mockMvc.perform(as(b, put("/api/v1/chat/notifications/{id}/read", n.getId())))
        .andReturn().getResponse().getStatus();

    assertThat(code).as("옛 주소 응답 코드").isIn(404, 405);
    assertThat(reload(n).getNotificationReadYn()).as("옛 주소로는 읽음 처리 안 됨").isFalse();
  }

  // ───────────── 도우미 ─────────────

  private Notification reload(Notification n) {
    return notificationRepository.findById(n.getId()).orElseThrow();
  }

  private Notification notificationOf(User recipient) {
    return notificationRepository.save(Notification.createNotification(
        recipient, NotificationType.SCHEDULE, "알림", null, null, null, null,
        false, true, false, LocalDateTime.now(), null, null));
  }

  private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
    return request.cookie(new Cookie("access_token", jwtProvider.createAccess(user.getEmail(), user.getRole(), 30)));
  }

  private User newUser(String prefix) {
    String email = prefix + "-" + UUID.randomUUID() + "@test.com";
    return userRepository.save(User.createUser("pw", prefix, Role.USER, email, null, null, null, null));
  }
}
