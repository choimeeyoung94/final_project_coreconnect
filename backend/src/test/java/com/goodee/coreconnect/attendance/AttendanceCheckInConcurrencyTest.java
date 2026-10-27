package com.goodee.coreconnect.attendance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.goodee.coreconnect.attendance.entity.Attendance;
import com.goodee.coreconnect.attendance.repository.AttendanceRepository;
import com.goodee.coreconnect.attendance.service.AttendanceService;
import com.goodee.coreconnect.support.AbstractIntegrationTest;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

import lombok.extern.slf4j.Slf4j;

/**
 * 출근(checkIn) 중복 저장 방지 테스트
 *
 * 스레드마다 별도 트랜잭션으로 커밋되어야 경합이 재현되므로 클래스에 @Transactional을 붙이지 않음.
 * 대신 @AfterEach에서 만든 데이터를 직접 지움.
 */
@Slf4j
class AttendanceCheckInConcurrencyTest extends AbstractIntegrationTest {

  private static final int THREAD_COUNT = 10;

  @Autowired
  private AttendanceService attendanceService;

  @Autowired
  private AttendanceRepository attendanceRepository;

  @Autowired
  private UserRepository userRepository;

  private User user;

  @BeforeEach
  void setUp() {
    String email = "checkin-" + UUID.randomUUID() + "@test.com";
    user = userRepository.save(User.createUser("pw", "출근테스터", Role.USER, email, null, null, null, null));
  }

  @AfterEach
  void tearDown() {
    attendanceRepository.deleteAll(todayRecords());
    userRepository.deleteById(user.getId());
  }

  @Test
  @DisplayName("이미 출근한 사용자가 다시 출근하면 '이미 오늘 출근 기록이 있습니다' 예외가 발생한다")
  void checkInTwice_throwsAlreadyCheckedIn() {
    attendanceService.checkIn(user.getEmail());

    assertThatThrownBy(() -> attendanceService.checkIn(user.getEmail()))
        .isInstanceOf(IllegalStateException.class)
        .hasMessage("이미 오늘 출근 기록이 있습니다.");
    assertThat(todayRecords()).hasSize(1);
  }

  @Test
  @DisplayName("같은 사용자가 동시에 10번 출근해도 출근 기록은 1건만 저장된다")
  void concurrentCheckIn_savesOnlyOneRecord() throws InterruptedException {
    ExecutorService executor = Executors.newFixedThreadPool(THREAD_COUNT);
    CountDownLatch ready = new CountDownLatch(THREAD_COUNT); // 모든 스레드가 준비될 때까지 대기
    CountDownLatch start = new CountDownLatch(1);            // 출발 신호
    CountDownLatch done = new CountDownLatch(THREAD_COUNT);  // 모든 스레드 종료 대기

    AtomicInteger successCount = new AtomicInteger();
    ConcurrentLinkedQueue<Throwable> failures = new ConcurrentLinkedQueue<>();

    for (int i = 0; i < THREAD_COUNT; i++) {
      executor.submit(() -> {
        ready.countDown();
        try {
          start.await();
          attendanceService.checkIn(user.getEmail());
          successCount.incrementAndGet();
        } catch (Throwable e) {
          failures.add(e);
        } finally {
          done.countDown();
        }
      });
    }

    ready.await();
    start.countDown(); // 10개 스레드 동시 출발
    assertThat(done.await(30, TimeUnit.SECONDS)).isTrue();
    executor.shutdown();

    List<Attendance> saved = todayRecords();
    log.info("저장 건수={}, 성공={}, 실패={}", saved.size(), successCount.get(), failures.size());
    failures.forEach(e -> log.info("실패 예외: {} - {}", e.getClass().getSimpleName(), e.getMessage()));

    assertThat(saved).hasSize(1);
    assertThat(successCount.get()).isEqualTo(1);
    assertThat(failures).hasSize(THREAD_COUNT - 1)
        .allSatisfy(e -> assertThat(e)
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("이미 오늘 출근 기록이 있습니다."));
  }

  private List<Attendance> todayRecords() {
    LocalDate today = LocalDate.now();
    return attendanceRepository.findByUser_IdAndWorkDateBetween(user.getId(), today, today);
  }
}
