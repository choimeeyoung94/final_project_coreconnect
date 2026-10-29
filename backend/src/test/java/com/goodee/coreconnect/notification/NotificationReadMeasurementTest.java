package com.goodee.coreconnect.notification;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

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
 * 알림 읽음 요청 1번당 SQL 수와 시간 (MEASURE=true일 때만)
 * - 주소는 환경변수 READ_PATH (수정 전 /api/v1/chat/notifications/{id}/read, 수정 후 /api/v1/notification/{id}/read)
 * - 안 읽은 알림을 새로 만들어 읽음 처리 (매번 실제로 읽음으로 바뀌는 요청)
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = {"security.mode=secure", "logging.level.org.hibernate.SQL=WARN", "logging.level.org.hibernate.stat=WARN"})
@EnabledIfEnvironmentVariable(named = "MEASURE", matches = "true")
class NotificationReadMeasurementTest extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtProvider jwtProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private NotificationRepository notificationRepository;
  @Autowired private EntityManagerFactory entityManagerFactory;

  @Test
  void measure() throws Exception {
    String path = "/" + System.getenv().getOrDefault("READ_PATH", "api/v1/notification/{id}/read"); // Git Bash 경로 변환을 피하려고 앞 / 없이 받음
    User b = userRepository.save(User.createUser("pw", "b", Role.USER, "b-" + UUID.randomUUID() + "@test.com", null, null, null, null));
    Cookie cookie = new Cookie("access_token", jwtProvider.createAccess(b.getEmail(), b.getRole(), 60));
    List<Integer> ids = new ArrayList<>();
    for (int i = 0; i < 520; i++) ids.add(notificationRepository.save(Notification.createNotification(
        b, NotificationType.SCHEDULE, "알림" + i, null, null, null, null, false, true, false, LocalDateTime.now(), null, null)).getId());

    for (int i = 0; i < 100; i++) mockMvc.perform(put(path, ids.get(i)).cookie(cookie)).andExpect(status().isOk()); // 워밍업
    Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
    stats.setStatisticsEnabled(true);
    stats.clear();
    for (int i = 100; i < 120; i++) mockMvc.perform(put(path, ids.get(i)).cookie(cookie)).andExpect(status().isOk());
    double sqlPerRequest = stats.getPrepareStatementCount() / 20.0;
    stats.setStatisticsEnabled(false);
    List<Long> nanos = new ArrayList<>();
    for (int i = 120; i < 520; i++) {
      long t0 = System.nanoTime();
      mockMvc.perform(put(path, ids.get(i)).cookie(cookie)).andExpect(status().isOk());
      nanos.add(System.nanoTime() - t0);
    }
    nanos.sort(Long::compare);
    System.out.printf("[MEASURE] path=%s sqlPerRequest=%.2f n=%d p50=%.2fms p95=%.2fms%n", path, sqlPerRequest, nanos.size(),
        nanos.get(nanos.size() / 2) / 1e6, nanos.get((int) Math.ceil(nanos.size() * 0.95) - 1) / 1e6);
  }
}
