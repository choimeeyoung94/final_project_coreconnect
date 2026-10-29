package com.goodee.coreconnect.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.goodee.coreconnect.chat.repository.NotificationRepository;
import com.goodee.coreconnect.common.entity.Notification;
import com.goodee.coreconnect.common.notification.enums.NotificationType;
import com.goodee.coreconnect.security.jwt.JwtProvider;
import com.goodee.coreconnect.support.AbstractIntegrationTest;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

import jakarta.persistence.EntityManagerFactory;
import jakarta.servlet.http.Cookie;

/**
 * 읽은 알림 처리 (open_issues 13번)
 * - 목록: GET /api/v1/notification?status=unread|all&page&size — 안 읽은 것만 / 전체(읽음 구분), 서버에서 개수 제한
 * - 종 아이콘 API가 알림 전체 이력을 읽지 않음
 * - 응답: ResponseDTO{data: {content: [...], last, page}}, 항목마다 readYn으로 읽음 구분
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = "security.mode=secure")
class NotificationListApiTest extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtProvider jwtProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private NotificationRepository notificationRepository;
  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private EntityManagerFactory entityManagerFactory;

  private final ObjectMapper objectMapper = new ObjectMapper();

  @Test
  @DisplayName("안 읽은 알림 목록: 안 읽은 것만, 최신순, 요청한 개수까지만")
  void unreadOnly_limited() throws Exception {
    User b = newUser("b");
    for (int i = 0; i < 8; i++) notif(b, "안읽음" + i, false);
    for (int i = 0; i < 4; i++) notif(b, "읽음" + i, true);

    JsonNode content = page(b, "unread", 0, 5).path("content");
    assertThat(content.size()).isEqualTo(5);
    content.forEach(n -> assertThat(n.path("readYn").asBoolean()).isFalse());
  }

  @Test
  @DisplayName("전체 알림 목록: 읽은 것도 오고 읽음 여부로 구분, 20개씩 다음 페이지")
  void all_withReadFlag_paged() throws Exception {
    User b = newUser("b");
    for (int i = 0; i < 15; i++) notif(b, "안읽음" + i, false);
    for (int i = 0; i < 15; i++) notif(b, "읽음" + i, true);

    JsonNode p0 = page(b, "all", 0, 20);
    assertThat(p0.path("content").size()).isEqualTo(20);
    assertThat(p0.path("last").asBoolean()).isFalse();
    JsonNode p1 = page(b, "all", 1, 20);
    assertThat(p1.path("content").size()).isEqualTo(10);
    long readCount = 0;
    for (JsonNode n : p0.path("content")) if (n.path("readYn").asBoolean()) readCount++;
    for (JsonNode n : p1.path("content")) if (n.path("readYn").asBoolean()) readCount++;
    assertThat(readCount).isEqualTo(15);
  }

  @Test
  @DisplayName("종 아이콘 API는 알림 전체 이력을 읽지 않는다 (읽은 알림 2,000개 + 안 읽은 3개)")
  void bellApi_doesNotLoadWholeHistory() throws Exception {
    User b = newUser("b");
    bulkRead(b, 2000);
    for (int i = 0; i < 3; i++) notif(b, "안읽음" + i, false);

    Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
    stats.setStatisticsEnabled(true);
    try {
      stats.clear();
      mockMvc.perform(as(b, get("/api/v1/chat/notifications/unread/all"))).andExpect(status().isOk());
      assertThat(stats.getEntityLoadCount()).as("읽어 온 알림 엔티티 수").isLessThan(100);
    } finally {
      stats.setStatisticsEnabled(false);
    }
  }

  // ───────────── 도우미 ─────────────

  private JsonNode page(User viewer, String status, int page, int size) throws Exception {
    String body = mockMvc.perform(as(viewer, get("/api/v1/notification")
            .param("status", status).param("page", String.valueOf(page)).param("size", String.valueOf(size))))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
    return objectMapper.readTree(body).path("data");
  }

  private Notification notif(User u, String msg, boolean read) {
    Notification n = Notification.createNotification(u, NotificationType.SCHEDULE, msg, null, null, null, null,
        false, true, false, LocalDateTime.now(), null, null);
    if (read) n.markRead();
    return notificationRepository.save(n);
  }

  private void bulkRead(User u, int count) {
    List<Object[]> rows = new ArrayList<>();
    for (int i = 0; i < count; i++) rows.add(new Object[] {u.getId(), "읽음" + i});
    jdbcTemplate.batchUpdate("INSERT INTO notification (user_id, notification_type, notification_message, notification_read_yn, notification_sent_yn, notification_deleted_yn, notification_sent_at, notification_read_at) VALUES (?, 'SCHEDULE', ?, true, true, false, NOW(), NOW())", rows);
  }

  private void setReadAt(Notification n, LocalDateTime at) {
    jdbcTemplate.update("UPDATE notification SET notification_read_at = ? WHERE id = ?", at, n.getId());
  }

  private void setSentAt(Notification n, LocalDateTime at) {
    jdbcTemplate.update("UPDATE notification SET notification_sent_at = ? WHERE id = ?", at, n.getId());
  }

  private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
    return request.cookie(new Cookie("access_token", jwtProvider.createAccess(user.getEmail(), user.getRole(), 30)));
  }

  private User newUser(String prefix) {
    return userRepository.save(User.createUser("pw", prefix, Role.USER, prefix + "-" + UUID.randomUUID() + "@test.com", null, null, null, null));
  }
}
