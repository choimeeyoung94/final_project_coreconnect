package com.goodee.coreconnect.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.goodee.coreconnect.chat.entity.ChatRoom;
import com.goodee.coreconnect.chat.service.ChatRoomService;
import com.goodee.coreconnect.email.entity.Email;
import com.goodee.coreconnect.email.entity.EmailRecipient;
import com.goodee.coreconnect.email.enums.EmailStatusEnum;
import com.goodee.coreconnect.email.repository.EmailRecipientRepository;
import com.goodee.coreconnect.email.repository.EmailRepository;
import com.goodee.coreconnect.schedule.dto.request.RequestScheduleDTO;
import com.goodee.coreconnect.schedule.service.ScheduleService;
import com.goodee.coreconnect.security.jwt.JwtProvider;
import com.goodee.coreconnect.support.AbstractIntegrationTest;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

import jakarta.persistence.EntityManagerFactory;
import jakarta.servlet.http.Cookie;

/**
 * 인가 확인 추가 전후 "정상 요청(본인 데이터)" 비용 측정
 *
 * - 평소 테스트 실행에서는 건너뛰고, 환경변수 MEASURE=true일 때만 실행
 * - 수정 전 코드와 수정 후 코드 모두에서 컴파일되도록 HTTP 요청만 사용
 *   (수정 전 API는 userEmail 파라미터가 필수라서 같이 보냄, 수정 후에는 서버가 무시함)
 * - sqlCountPerRequest: 요청 1번당 SQL 실행 수(Hibernate Statistics prepareStatementCount). 통계는 이 메서드 안에서만 켬
 * - timing: 통계·SQL 로그를 끈 상태에서 시간만 잼 (통계를 켜면 쿼리마다 비용이 붙어 쿼리가 많은 쪽이 더 느려 보임)
 *   워밍업 1회(버림) 뒤 ROUNDS회, 회차마다 API별로 CALLS번 호출. 모든 호출 시간으로 p50·p95, 회차 평균들로 평균·표준편차
 * - 두 메서드는 --tests로 따로 실행. 결과는 [MEASURE] 줄로 출력
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = {
    "security.mode=secure",
    "logging.level.org.hibernate.SQL=WARN",
    "logging.level.org.hibernate.stat=WARN",
    "logging.level.org.hibernate.engine.internal.StatisticalLoggingSessionEventListener=WARN"
})
@EnabledIfEnvironmentVariable(named = "MEASURE", matches = "true")
class AuthorizationLatencyMeasurementTest extends AbstractIntegrationTest {

  private static final int ROUNDS = 10;
  private static final int CALLS = 100;

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtProvider jwtProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private EmailRepository emailRepository;
  @Autowired private EmailRecipientRepository emailRecipientRepository;
  @Autowired private ChatRoomService chatRoomService;
  @Autowired private ScheduleService scheduleService;
  @Autowired private EntityManagerFactory entityManagerFactory;

  @Test
  void sqlCountPerRequest() throws Exception {
    Map<String, MockHttpServletRequestBuilder> apis = ownerRequests();
    Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
    stats.setStatisticsEnabled(true);
    try {
      for (var api : apis.entrySet()) {
        mockMvc.perform(api.getValue()).andExpect(status().isOk()); // 첫 호출은 버림
        stats.clear();
        int n = 20;
        for (int i = 0; i < n; i++) {
          mockMvc.perform(api.getValue()).andExpect(status().isOk());
        }
        System.out.printf("[MEASURE] SQL %s queriesPerRequest=%.2f%n", api.getKey(), (double) stats.getPrepareStatementCount() / n);
        for (String q : stats.getQueries()) {
          System.out.printf("[MEASURE] SQLQ %s x%d %s%n", api.getKey(), stats.getQueryStatistics(q).getExecutionCount(), q);
        }
      }
    } finally {
      stats.setStatisticsEnabled(false);
    }
  }

  @Test
  void timing() throws Exception {
    Map<String, MockHttpServletRequestBuilder> apis = ownerRequests();
    entityManagerFactory.unwrap(SessionFactory.class).getStatistics().setStatisticsEnabled(false);

    // 워밍업 1회 버림
    for (var api : apis.values()) {
      for (int i = 0; i < CALLS; i++) {
        mockMvc.perform(api).andExpect(status().isOk());
      }
    }
    Map<String, List<Long>> allNanos = new LinkedHashMap<>();
    Map<String, List<Double>> roundAvgMs = new LinkedHashMap<>();
    for (int round = 1; round <= ROUNDS; round++) {
      for (var api : apis.entrySet()) {
        long sum = 0;
        for (int i = 0; i < CALLS; i++) {
          long t0 = System.nanoTime();
          mockMvc.perform(api.getValue()).andExpect(status().isOk());
          long d = System.nanoTime() - t0;
          sum += d;
          allNanos.computeIfAbsent(api.getKey(), k -> new ArrayList<>()).add(d);
        }
        roundAvgMs.computeIfAbsent(api.getKey(), k -> new ArrayList<>()).add(sum / 1_000_000.0 / CALLS);
      }
    }
    for (String name : apis.keySet()) {
      List<Long> nanos = allNanos.get(name);
      nanos.sort(Long::compare);
      double p50 = nanos.get(nanos.size() / 2) / 1_000_000.0;
      double p95 = nanos.get((int) Math.ceil(nanos.size() * 0.95) - 1) / 1_000_000.0;
      List<Double> avgs = roundAvgMs.get(name);
      double mean = avgs.stream().mapToDouble(Double::doubleValue).average().orElse(0);
      double sd = Math.sqrt(avgs.stream().mapToDouble(v -> (v - mean) * (v - mean)).sum() / (avgs.size() - 1));
      System.out.printf("[MEASURE] TIME %s p50=%.3fms p95=%.3fms roundAvgMean=%.3fms roundAvgSd=%.3fms rounds=%s%n",
          name, p50, p95, mean, sd, avgs.stream().map(v -> String.format("%.2f", v)).toList());
    }
  }

  /** 본인 데이터를 보는 정상 요청 4개 (B가 받은 메일, B가 참여한 방, B의 일정) */
  private Map<String, MockHttpServletRequestBuilder> ownerRequests() {
    User b = newUser("b");
    User c = newUser("c");
    Email mail = mailTo(b, c);
    ChatRoom room = chatRoomService.createChatRoom("방", List.of(b.getId(), c.getId()), b.getEmail());
    LocalDateTime start = LocalDateTime.of(2099, 6, 1, 10, 0);
    Integer scheduleId = scheduleService.createSchedule(RequestScheduleDTO.builder()
        .title("B 일정").startDateTime(start).endDateTime(start.plusHours(1)).participantIds(List.of()).build(),
        b.getEmail()).getId();

    Map<String, MockHttpServletRequestBuilder> apis = new LinkedHashMap<>();
    apis.put("메일 상세", as(b, get("/api/v1/email/{id}", mail.getEmailId()).param("userEmail", b.getEmail())));
    apis.put("받은메일함", as(b, get("/api/v1/email/inbox").param("userEmail", b.getEmail())));
    apis.put("채팅 메시지 목록", as(b, get("/api/v1/chat/{roomId}/messages", room.getId())));
    apis.put("일정 단건", as(b, get("/api/v1/schedules").param("id", String.valueOf(scheduleId))));
    return apis;
  }

  private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
    return request.cookie(new Cookie("access_token", jwtProvider.createAccess(user.getEmail(), user.getRole(), 60)));
  }

  private User newUser(String prefix) {
    String email = prefix + "-" + UUID.randomUUID() + "@test.com";
    return userRepository.save(User.createUser("pw", prefix, Role.USER, email, null, null, null, null));
  }

  private Email mailTo(User recipient, User sender) {
    Email mail = emailRepository.save(Email.builder()
        .emailTitle("측정용 메일").emailContent("본문").emailStatus(EmailStatusEnum.SENT)
        .senderId(sender.getId()).senderEmail(sender.getEmail()).emailSentTime(LocalDateTime.now()).emailFolder("SENT")
        .build());
    emailRecipientRepository.save(EmailRecipient.builder()
        .emailRecipientType("TO").emailRecipientAddress(recipient.getEmail()).userId(recipient.getId()).email(mail)
        .build());
    return mail;
  }
}
