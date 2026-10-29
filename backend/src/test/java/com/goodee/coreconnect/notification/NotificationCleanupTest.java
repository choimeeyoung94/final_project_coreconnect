package com.goodee.coreconnect.notification;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;

import com.goodee.coreconnect.chat.repository.NotificationRepository;
import com.goodee.coreconnect.common.entity.Notification;
import com.goodee.coreconnect.common.notification.enums.NotificationType;
import com.goodee.coreconnect.common.notification.service.NotificationCleanupService;
import com.goodee.coreconnect.support.AbstractIntegrationTest;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

import net.javacrumbs.shedlock.core.LockConfiguration;
import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.core.SimpleLock;

/**
 * 알림 정리 (open_issues 13번)
 * - 읽은 알림: 읽은 지(notification_read_at) 30일 지나면 지움
 * - 안 읽은 알림: 온 지(notification_sent_at) 90일 지나면 지움
 * - 서버 여러 대: 정리 작업은 ShedLock(Redis) 잠금을 잡은 서버 한 대만 실행
 * - 정리 작업은 실제로 매일 도는 scheduledCleanup()으로 부름. lockAtLeastFor(1분) 때문에 테스트마다 잠금 키를 지우고 시작
 */
class NotificationCleanupTest extends AbstractIntegrationTest {

  @Autowired private UserRepository userRepository;
  @Autowired private NotificationRepository notificationRepository;
  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private NotificationCleanupService cleanupService;
  @Autowired private LockProvider lockProvider;
  @Autowired private StringRedisTemplate redisTemplate;

  @BeforeEach
  void clearLocks() {
    Set<String> keys = redisTemplate.keys("job-lock:*");
    if (keys != null && !keys.isEmpty()) redisTemplate.delete(keys);
  }

  @Test
  @DisplayName("읽은 알림은 읽은 지 30일 지나면 지운다 (사람 상관없이), 29일 된 것은 남는다")
  void deletesReadOlderThan30Days() {
    User b = newUser("b");
    User c = newUser("c");
    Notification oldRead = notif(b, true);
    Notification recentRead = notif(b, true);
    Notification othersOldRead = notif(c, true);
    setReadAt(oldRead, LocalDateTime.now().minusDays(31));
    setReadAt(recentRead, LocalDateTime.now().minusDays(29));
    setReadAt(othersOldRead, LocalDateTime.now().minusDays(40));

    cleanupService.scheduledCleanup();

    assertThat(notificationRepository.existsById(oldRead.getId())).as("읽은 지 31일").isFalse();
    assertThat(notificationRepository.existsById(othersOldRead.getId())).as("다른 사람, 읽은 지 40일").isFalse();
    assertThat(notificationRepository.existsById(recentRead.getId())).as("읽은 지 29일").isTrue();
  }

  @Test
  @DisplayName("안 읽은 알림은 온 지 90일 지나면 지운다, 89일 된 것은 남는다. 읽은 알림은 온 날이 아니라 읽은 날 기준")
  void deletesUnreadOlderThan90Days() {
    User b = newUser("b");
    Notification oldUnread = notif(b, false);
    Notification recentUnread = notif(b, false);
    Notification oldSentRecentlyRead = notif(b, true);
    setSentAt(oldUnread, LocalDateTime.now().minusDays(91));
    setSentAt(recentUnread, LocalDateTime.now().minusDays(89));
    setSentAt(oldSentRecentlyRead, LocalDateTime.now().minusDays(200));
    setReadAt(oldSentRecentlyRead, LocalDateTime.now().minusDays(10));

    cleanupService.scheduledCleanup();

    assertThat(notificationRepository.existsById(oldUnread.getId())).as("안 읽음, 온 지 91일").isFalse();
    assertThat(notificationRepository.existsById(recentUnread.getId())).as("안 읽음, 온 지 89일").isTrue();
    assertThat(notificationRepository.existsById(oldSentRecentlyRead.getId())).as("온 지 200일이지만 읽은 지 10일").isTrue();
  }

  @Test
  @DisplayName("지울 것이 많아도(읽은 2,500개 + 안 읽은 2,500개) 나눠서 전부 지운다")
  void deletesInBatches() {
    User b = newUser("b");
    bulkInsert(b, true, 2500);
    bulkInsert(b, false, 2500);

    cleanupService.scheduledCleanup();

    Integer left = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM notification WHERE user_id = ?", Integer.class, b.getId());
    assertThat(left).isZero();
  }

  @Test
  @DisplayName("다른 서버가 잠금을 잡고 있으면 이 서버의 정리 작업은 실행하지 않는다 (서버 여러 대에서 한 번만)")
  void skipsWhenAnotherServerHoldsLock() {
    User b = newUser("b");
    Notification oldRead = notif(b, true);
    setReadAt(oldRead, LocalDateTime.now().minusDays(100));
    Optional<SimpleLock> otherServer = lockProvider.lock(new LockConfiguration(Instant.now(),
        NotificationCleanupService.LOCK_NAME, Duration.ofMinutes(5), Duration.ZERO));
    assertThat(otherServer).as("다른 서버 역할로 잠금 잡기").isPresent();
    try {
      cleanupService.scheduledCleanup();
      assertThat(notificationRepository.existsById(oldRead.getId())).as("잠금이 있으면 안 지움").isTrue();
    } finally {
      otherServer.get().unlock();
    }
    cleanupService.scheduledCleanup();
    assertThat(notificationRepository.existsById(oldRead.getId())).as("잠금이 풀리면 지움").isFalse();
  }

  /** read=true면 읽은 지 100일, false면 온 지 100일 된 알림을 count개 넣음 */
  private void bulkInsert(User u, boolean read, int count) {
    String row = read
        ? ", 'SCHEDULE', 'old', true, true, false, NOW() - INTERVAL 100 DAY, NOW() - INTERVAL 100 DAY)"
        : ", 'SCHEDULE', 'old', false, true, false, NOW() - INTERVAL 100 DAY, NULL)";
    for (int start = 0; start < count; start += 500) {
      StringBuilder sql = new StringBuilder("INSERT INTO notification (user_id, notification_type, notification_message, notification_read_yn, notification_sent_yn, notification_deleted_yn, notification_sent_at, notification_read_at) VALUES ");
      for (int i = 0; i < 500; i++) sql.append(i == 0 ? "" : ",").append("(").append(u.getId()).append(row);
      jdbcTemplate.update(sql.toString());
    }
  }

  private void setSentAt(Notification n, LocalDateTime at) {
    jdbcTemplate.update("UPDATE notification SET notification_sent_at = ? WHERE id = ?", at, n.getId());
  }

  private void setReadAt(Notification n, LocalDateTime at) {
    jdbcTemplate.update("UPDATE notification SET notification_read_at = ? WHERE id = ?", at, n.getId());
  }

  private Notification notif(User u, boolean read) {
    Notification n = Notification.createNotification(u, NotificationType.SCHEDULE, "알림", null, null, null, null,
        false, true, false, LocalDateTime.now(), null, null);
    if (read) n.markRead();
    return notificationRepository.save(n);
  }

  private User newUser(String prefix) {
    return userRepository.save(User.createUser("pw", prefix, Role.USER, prefix + "-" + UUID.randomUUID() + "@test.com", null, null, null, null));
  }
}
