package com.goodee.coreconnect.notification;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import com.goodee.coreconnect.security.jwt.JwtProvider;
import com.goodee.coreconnect.support.AbstractIntegrationTest;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

import jakarta.persistence.EntityManagerFactory;
import jakarta.servlet.http.Cookie;

/**
 * 알림이 많이 쌓인 사용자의 종 아이콘·대시보드 알림 API 비용 (MEASURE=true일 때만)
 * - 사용자 1명에게 읽은 알림 N개(1만, 10만) + 안 읽은 알림 5개
 * - 주소는 환경변수 BELL_PATH, CARD_PATH (Git Bash 경로 변환을 피하려고 앞 / 없이)
 *   수정 전: api/v1/chat/notifications/unread/all, api/v1/chat/notifications
 *   수정 후: api/v1/chat/notifications/unread/all, api/v1/notification?status=unread&size=5
 * - 요청 1번당 읽은 엔티티 수·SQL 수(통계 켬, 1번), 시간(통계 끔, 워밍업 2번 버리고 CALLS번)
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = {"security.mode=secure", "logging.level.org.hibernate.SQL=WARN", "logging.level.org.hibernate.stat=WARN",
    "logging.level.com.goodee.coreconnect=WARN"})
@EnabledIfEnvironmentVariable(named = "MEASURE", matches = "true")
class NotificationListMeasurementTest extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtProvider jwtProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private EntityManagerFactory entityManagerFactory;

  @Test
  void measure() throws Exception {
    String bell = "/" + System.getenv().getOrDefault("BELL_PATH", "api/v1/chat/notifications/unread/all");
    String card = "/" + System.getenv().getOrDefault("CARD_PATH", "api/v1/notification?status=unread&size=5");
    for (int n : new int[] {10_000, 100_000}) {
      User b = userRepository.save(User.createUser("pw", "b", Role.USER, "b-" + UUID.randomUUID() + "@test.com", null, null, null, null));
      for (int start = 0; start < n; start += 1000) {
        StringBuilder sql = new StringBuilder("INSERT INTO notification (user_id, notification_type, notification_message, notification_read_yn, notification_sent_yn, notification_deleted_yn, notification_sent_at, notification_read_at) VALUES ");
        for (int i = 0; i < 1000; i++) sql.append(i == 0 ? "" : ",").append("(").append(b.getId()).append(", 'SCHEDULE', 'read', true, true, false, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY)");
        jdbcTemplate.update(sql.toString());
      }
      for (int i = 0; i < 5; i++) jdbcTemplate.update("INSERT INTO notification (user_id, notification_type, notification_message, notification_read_yn, notification_sent_yn, notification_deleted_yn, notification_sent_at) VALUES (?, 'SCHEDULE', 'unread', false, true, false, NOW())", b.getId());
      Cookie cookie = new Cookie("access_token", jwtProvider.createAccess(b.getEmail(), b.getRole(), 60));
      int calls = n >= 100_000 ? 5 : 20;
      for (String path : new String[] {bell, card}) {
        String[] parts = path.split("[?]", 2);
        var req = get(parts[0]).cookie(cookie);
        if (parts.length > 1) for (String kv : parts[1].split("&")) { String[] p = kv.split("="); req = req.param(p[0], p[1]); }
        Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        stats.setStatisticsEnabled(true);
        stats.clear();
        mockMvc.perform(req).andExpect(status().isOk());
        long entities = stats.getEntityLoadCount();
        long sqls = stats.getPrepareStatementCount();
        stats.setStatisticsEnabled(false);
        for (int i = 0; i < 2; i++) mockMvc.perform(req).andExpect(status().isOk());
        List<Long> nanos = new ArrayList<>();
        for (int i = 0; i < calls; i++) {
          long t0 = System.nanoTime();
          mockMvc.perform(req).andExpect(status().isOk());
          nanos.add(System.nanoTime() - t0);
        }
        nanos.sort(Long::compare);
        System.out.printf("[MEASURE] n=%d path=%s entitiesLoaded=%d sql=%d calls=%d p50=%.1fms max=%.1fms%n", n, path, entities, sqls, calls,
            nanos.get(nanos.size() / 2) / 1e6, nanos.get(nanos.size() - 1) / 1e6);
      }
    }
  }
}
