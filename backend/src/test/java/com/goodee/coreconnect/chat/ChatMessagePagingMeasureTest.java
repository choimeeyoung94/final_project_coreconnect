package com.goodee.coreconnect.chat;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.goodee.coreconnect.chat.entity.ChatRoom;
import com.goodee.coreconnect.chat.service.ChatRoomService;
import com.goodee.coreconnect.security.jwt.JwtProvider;
import com.goodee.coreconnect.support.AbstractIntegrationTest;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

import jakarta.persistence.EntityManagerFactory;
import jakarta.servlet.http.Cookie;

/**
 * 메시지 목록 API 측정 (open_issues 6-1·6-2·11) — 수정 전·후에 같은 코드로 돌려 비교
 *
 * - MEASURE=true일 때만 실행 (방마다 메시지를 수천~수만 개 넣어서 오래 걸림)
 * - MEASURE_TOTALS: 방 메시지 수 목록 (기본 "1000,10000")
 * - MEASURE_REPS: 경우마다 잴 횟수 (기본 10, 앞의 2번은 데우기로 버림)
 * - MEASURE_CURSOR=true: 커서(before) 요청도 잼 (수정 후에만 있는 API)
 * - 한 요청마다: 걸린 시간, SQL 수(Hibernate 통계 prepareStatementCount), 만든 엔티티 수(entityLoadCount),
 *   DB가 읽은 행 수(MySQL 전역 Innodb_rows_read 전후 차이 — 테스트 컨테이너라 이 요청 말고 읽는 것이 없음)
 * - 경우: 수정 전 코드는 첫 페이지(page=0)·중간 페이지(page=전체/40) — 이 두 경우는 page 방식을 없앤 뒤 지움(수정 전 결과는 chat_paging_before.log)
 *   수정 후 코드는 최신(파라미터 없음)·커서로 중간(before=중간 메시지 id, MEASURE_CURSOR=true)
 * - EXPLAIN: 수정 전 쿼리 모양(정렬 sent_at만, LIMIT 없음)과 수정 후 모양(id만 LIMIT, 커서)을 같은 방에서
 * - 결과는 [MEASURE] / [EXPLAIN] 줄로 출력
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = {"security.mode=secure", "logging.level.org.hibernate.SQL=${MEASURE_SQL_LOG:WARN}"})
@EnabledIfEnvironmentVariable(named = "MEASURE", matches = "true")
class ChatMessagePagingMeasureTest extends AbstractIntegrationTest {

  private static final int SIZE = 20;

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtProvider jwtProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private ChatRoomService chatRoomService;
  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private EntityManagerFactory entityManagerFactory;

  private final ObjectMapper objectMapper = new ObjectMapper();

  @Test
  void measure() throws Exception {
    int[] totals = Arrays.stream(System.getenv().getOrDefault("MEASURE_TOTALS", "1000,10000").split(","))
        .mapToInt(s -> Integer.parseInt(s.trim())).toArray();
    int reps = Integer.parseInt(System.getenv().getOrDefault("MEASURE_REPS", "10"));
    boolean cursor = "true".equals(System.getenv("MEASURE_CURSOR"));

    jdbcTemplate.queryForList("SHOW INDEX FROM chat_message").forEach(r ->
        System.out.printf("[INDEX] %s seq=%s col=%s collation=%s%n", r.get("Key_name"), r.get("Seq_in_index"), r.get("Column_name"), r.get("Collation")));

    for (int total : totals) {
      User a = newUser("a");
      User b = newUser("b");
      ChatRoom room = chatRoomService.createChatRoom("방", List.of(a.getId(), b.getId()), a.getEmail());
      insert(room.getId(), a.getId(), b.getId(), total);
      // 안 읽은 수 쿼리 실행 계획: 읽음 상태를 막 넣은 직후(통계가 옛 값) vs ANALYZE 뒤
      String ids20 = String.join(",", jdbcTemplate.queryForList(
          "SELECT id FROM chat_message WHERE chat_room_id = ? ORDER BY sent_at DESC, id DESC LIMIT 20", String.class, room.getId()));
      String unreadSql = "SELECT r.chat_message_id, COUNT(1) FROM chat_message_read_status r JOIN chat_message c ON c.id = r.chat_message_id "
          + "WHERE r.chat_message_id IN (" + ids20 + ") AND r.chat_message_read_status_read_yn = 0 AND r.user_id <> c.sender_id GROUP BY r.chat_message_id";
      explain(total, "unread: 읽음 상태 넣은 직후", unreadSql);
      jdbcTemplate.execute("ANALYZE TABLE chat_message");
      if (!"false".equals(System.getenv("MEASURE_ANALYZE_READ_STATUS"))) {
        jdbcTemplate.execute("ANALYZE TABLE chat_message_read_status");
      }
      explain(total, "unread: ANALYZE 뒤", unreadSql);

      int middlePage = total / SIZE / 2;
      Integer middleId = jdbcTemplate.queryForObject(
          "SELECT id FROM chat_message WHERE chat_room_id = ? ORDER BY sent_at DESC, id DESC LIMIT 1 OFFSET ?",
          Integer.class, room.getId(), middlePage * SIZE);

      if (cursor) {
        run(total, "latest", reps, () -> get("/api/v1/chat/{roomId}/messages", room.getId()).param("size", "" + SIZE), b);
      }
      if (cursor) {
        run(total, "before-middle", reps, () -> get("/api/v1/chat/{roomId}/messages", room.getId()).param("before", "" + middleId).param("size", "" + SIZE), b);
      }

      explain(total, "old: 방 전체, sent_at만 정렬, LIMIT 없음",
          "SELECT c.id, c.sent_at FROM chat_message c WHERE c.chat_room_id = ? ORDER BY c.sent_at DESC", room.getId());
      explain(total, "new: 첫 페이지 id만 LIMIT",
          "SELECT c.id FROM chat_message c WHERE c.chat_room_id = ? ORDER BY c.sent_at DESC, c.id DESC LIMIT 20", room.getId());
      explain(total, "new: 중간 페이지 OFFSET",
          "SELECT c.id FROM chat_message c WHERE c.chat_room_id = ? ORDER BY c.sent_at DESC, c.id DESC LIMIT 20 OFFSET " + middlePage * SIZE, room.getId());
      Map<String, Object> mid = jdbcTemplate.queryForMap("SELECT sent_at, id FROM chat_message WHERE id = ?", middleId);
      explain(total, "new: 커서 before",
          "SELECT c.id FROM chat_message c WHERE c.chat_room_id = ? AND (c.sent_at < ? OR (c.sent_at = ? AND c.id < ?)) ORDER BY c.sent_at DESC, c.id DESC LIMIT 21",
          room.getId(), mid.get("sent_at"), mid.get("sent_at"), mid.get("id"));
    }
  }

  private interface RequestFactory { MockHttpServletRequestBuilder create(); }

  private void run(int total, String label, int reps, RequestFactory request, User viewer) throws Exception {
    Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
    stats.setStatisticsEnabled(true);
    List<Long> ms = new ArrayList<>();
    List<Long> rowsPerRequest = new ArrayList<>();
    long sql = 0, entities = 0, rows = 0, received = 0;
    try {
      for (int i = 0; i < reps; i++) {
        stats.clear();
        if (TRACE) rootUpdate("TRUNCATE TABLE performance_schema.events_statements_summary_by_digest");
        long rowsBefore = innodbRowsRead();
        long t0 = System.nanoTime();
        String body = mockMvc.perform(request.create().cookie(new Cookie("access_token", jwtProvider.createAccess(viewer.getEmail(), viewer.getRole(), 60))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        long elapsed = (System.nanoTime() - t0) / 1_000_000;
        long rowsRead = innodbRowsRead() - rowsBefore;
        if (TRACE && rowsRead > 500) traceDigests(total, label, i, rowsRead);
        if (i < 2) continue; // 데우기
        rowsPerRequest.add(rowsRead);
        ms.add(elapsed);
        sql = stats.getPrepareStatementCount();
        entities = stats.getEntityLoadCount();
        rows = rowsRead;
        received = objectMapper.readTree(body).path("data").path("content").size();
      }
    } finally {
      stats.setStatisticsEnabled(false);
    }
    ms.sort(Long::compare);
    System.out.printf("[MEASURE] total=%d case=%s n=%d received=%d sql=%d entities=%d innodbRowsRead=%d p50=%dms p95=%dms max=%dms%n",
        total, label, ms.size(), received, sql, entities, rows, pct(ms, 50), pct(ms, 95), ms.get(ms.size() - 1));
    System.out.printf("[ROWS] total=%d case=%s perRequest=%s%n", total, label, rowsPerRequest);
    // 마지막 요청에서 SQL이 어디서 나왔나: JPQL별 실행 횟수, 지연 로딩(엔티티·컬렉션) 횟수
    System.out.printf("[DETAIL] total=%d case=%s entityFetch=%d collectionFetch=%d collectionLoad=%d%n",
        total, label, stats.getEntityFetchCount(), stats.getCollectionFetchCount(), stats.getCollectionLoadCount());
    for (String q : stats.getQueries()) {
      System.out.printf("[DETAIL] total=%d case=%s x%d %s%n", total, label, stats.getQueryStatistics(q).getExecutionCount(), q.replaceAll("\\s+", " "));
    }
  }

  /** MEASURE_TRACE=true: 요청 하나가 500행 넘게 읽으면 그 사이 실행된 SQL을 행 수 많은 순으로 (요청 밖 SQL도 보임) */
  private static final boolean TRACE = "true".equals(System.getenv("MEASURE_TRACE"));

  private void traceDigests(int total, String label, int i, long rowsRead) throws Exception {
    try (java.sql.Connection c = rootConnection(); java.sql.Statement st = c.createStatement();
         java.sql.ResultSet rs = st.executeQuery("SELECT SCHEMA_NAME, COUNT_STAR, SUM_ROWS_EXAMINED, LEFT(DIGEST_TEXT, 200) "
             + "FROM performance_schema.events_statements_summary_by_digest WHERE SUM_ROWS_EXAMINED > 0 ORDER BY SUM_ROWS_EXAMINED DESC LIMIT 8")) {
      while (rs.next()) {
        System.out.printf("[TRACE] total=%d case=%s req=%d rowsRead=%d | schema=%s x%d examined=%d %s%n",
            total, label, i, rowsRead, rs.getString(1), rs.getLong(2), rs.getLong(3), rs.getString(4));
      }
    }
  }

  private void rootUpdate(String sql) throws Exception {
    try (java.sql.Connection c = rootConnection(); java.sql.Statement st = c.createStatement()) { st.execute(sql); }
  }

  /** performance_schema는 test 계정 권한이 없어서 root로 (Testcontainers MySQL은 root 비밀번호 = 설정한 비밀번호) */
  private java.sql.Connection rootConnection() throws Exception {
    String url;
    try (java.sql.Connection c = jdbcTemplate.getDataSource().getConnection()) { url = c.getMetaData().getURL(); }
    return java.sql.DriverManager.getConnection(url, "root", "test");
  }

  private void explain(int total, String label, String sql, Object... args) {
    for (Map<String, Object> r : jdbcTemplate.queryForList("EXPLAIN " + sql, args)) {
      System.out.printf("[EXPLAIN] total=%d %s | type=%s key=%s rows=%s Extra=%s%n", total, label, r.get("type"), r.get("key"), r.get("rows"), r.get("Extra"));
    }
    String analyze = jdbcTemplate.queryForObject("EXPLAIN ANALYZE " + sql, String.class, args);
    System.out.printf("[EXPLAIN] total=%d %s | ANALYZE %s%n", total, label, analyze.replace("\n", " / "));
  }

  private long innodbRowsRead() {
    return Long.parseLong(String.valueOf(jdbcTemplate.queryForMap("SHOW GLOBAL STATUS LIKE 'Innodb_rows_read'").get("Value")));
  }

  private static long pct(List<Long> sorted, int p) {
    int idx = (int) Math.ceil(p / 100.0 * sorted.size()) - 1;
    return sorted.get(Math.max(0, idx));
  }

  /** 1초에 1개씩, 보낸 사람 A. 읽음 상태: A는 읽음, B는 짝수 메시지만 읽음 (안 읽은 수가 0·1로 섞이게) */
  private void insert(Integer roomId, Integer senderId, Integer viewerId, int total) {
    LocalDateTime base = LocalDateTime.now().plusMinutes(1); // 들어온 시각(joined_at) 뒤여야 목록에 보임
    Integer firstId = null;
    for (int start = 0; start < total; start += 1000) {
      int end = Math.min(total, start + 1000);
      StringBuilder sql = new StringBuilder("INSERT INTO chat_message (chat_room_id, sender_id, message_content, sent_at, file_yn, read_yn, unread_count) VALUES ");
      List<Object> args = new ArrayList<>();
      for (int i = start; i < end; i++) {
        sql.append(i == start ? "" : ",").append("(?,?,?,?,?,?,?)");
        args.add(roomId); args.add(senderId); args.add("m" + i); args.add(Timestamp.valueOf(base.plusSeconds(i)));
        args.add(false); args.add(false); args.add(0);
      }
      jdbcTemplate.update(sql.toString(), args.toArray());
    }
    firstId = jdbcTemplate.queryForObject("SELECT MIN(id) FROM chat_message WHERE chat_room_id = ?", Integer.class, roomId);
    jdbcTemplate.update("INSERT INTO chat_message_read_status (chat_message_id, user_id, chat_message_read_status_read_yn) "
        + "SELECT id, ?, true FROM chat_message WHERE chat_room_id = ?", senderId, roomId);
    jdbcTemplate.update("INSERT INTO chat_message_read_status (chat_message_id, user_id, chat_message_read_status_read_yn) "
        + "SELECT id, ?, ((id - ?) % 2 = 0) FROM chat_message WHERE chat_room_id = ?", viewerId, firstId, roomId);
  }

  private User newUser(String prefix) {
    String email = prefix + "-" + UUID.randomUUID() + "@test.com";
    return userRepository.save(User.createUser("pw", prefix, Role.USER, email, null, null, null, null));
  }
}
