package com.goodee.coreconnect.chat;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.goodee.coreconnect.chat.entity.ChatRoom;
import com.goodee.coreconnect.chat.service.ChatRoomService;
import com.goodee.coreconnect.security.jwt.JwtProvider;
import com.goodee.coreconnect.support.AbstractIntegrationTest;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

import jakarta.servlet.http.Cookie;

/**
 * 메시지 5만 개 방에서 화면처럼 20개씩 위로 스크롤할 때 같은 메시지가 다시 오는지 조사
 * - 수정 전 화면: page=0, 1, 2, … (결과 docs/measurements/chat_scroll_before.log, main 967e68ca)
 * - 수정 후 화면: ChatLayout.jsx handleLoadMoreMessages → 첫 화면(파라미터 없음) 다음 before=화면의 가장 오래된 id (page 방식은 없앰)
 * - 세 가지 보낸 시각 분포로 비교
 *   SAME: 5만 개가 모두 같은 시각 (SQL 한 번으로 넣은 더미 데이터처럼)
 *   PER_SECOND: 1초에 50개씩 (반복문으로 빠르게 넣은 더미 데이터처럼, sent_at이 초 단위)
 *   DISTINCT: 모두 다른 시각 (1ms씩)
 * - 오래 걸려서 SCROLL=true일 때만 실행. 결과는 [SCROLL] 줄로 출력
 * - 기준 코드: main(인가·joined_at 포함). 메시지 시각은 방에 들어온 뒤로 넣음
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = {"security.mode=secure", "logging.level.org.hibernate.SQL=WARN"})
@EnabledIfEnvironmentVariable(named = "SCROLL", matches = "true")
class ChatScrollPagingTest extends AbstractIntegrationTest {

  private static final int TOTAL = Integer.parseInt(System.getenv().getOrDefault("SCROLL_TOTAL", "50000"));
  private static final int PAGES = 15;

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtProvider jwtProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private ChatRoomService chatRoomService;
  @Autowired private JdbcTemplate jdbcTemplate;

  private final ObjectMapper objectMapper = new ObjectMapper();

  @Test
  void scrollFiftyThousandMessages() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    LocalDateTime base = LocalDateTime.now().plusMinutes(1); // 들어온 시각(joined_at) 뒤여야 목록에 보임
    Map<String, ChatRoom> rooms = new LinkedHashMap<>();
    rooms.put("SAME", room(a, b));
    rooms.put("PER_SECOND", room(a, b));
    rooms.put("DISTINCT", room(a, b));
    String toInsert = System.getenv().getOrDefault("SCROLL_ONLY", "SAME,PER_SECOND,DISTINCT");
    if (toInsert.contains("SAME")) insert(rooms.get("SAME").getId(), a.getId(), i -> base);
    if (toInsert.contains("PER_SECOND")) insert(rooms.get("PER_SECOND").getId(), a.getId(), i -> base.plusSeconds(i / 50));
    if (toInsert.contains("DISTINCT")) insert(rooms.get("DISTINCT").getId(), a.getId(), i -> base.plusNanos(i * 1_000_000L));

    String only = System.getenv().getOrDefault("SCROLL_ONLY", "SAME,PER_SECOND,DISTINCT");
    for (var e : rooms.entrySet()) {
      if (!only.contains(e.getKey())) continue;
      Integer roomId = e.getValue().getId();
      List<Integer> all = new ArrayList<>();
      Set<Integer> seen = new HashSet<>();
      int duplicates = 0;
      List<Integer> dupPages = new ArrayList<>();
      long totalMs = 0;
      Integer oldest = null;
      for (int page = 0; page < PAGES; page++) {
        long t0 = System.nanoTime();
        List<Integer> ids = pageIds(b, roomId, oldest);
        if (!ids.isEmpty()) oldest = ids.get(ids.size() - 1);
        totalMs += (System.nanoTime() - t0) / 1_000_000;
        int dupHere = 0;
        for (Integer id : ids) {
          if (!seen.add(id)) dupHere++;
          all.add(id);
        }
        if (dupHere > 0) dupPages.add(page);
        duplicates += dupHere;
      }
      // 같은 페이지(두 번째 페이지)를 두 번 요청하면 같은 메시지가 오나 (순서가 고정인가)
      Integer page0Oldest = all.get(19);
      List<Integer> page1a = pageIds(b, roomId, page0Oldest);
      List<Integer> page1b = pageIds(b, roomId, page0Oldest);
      // 진짜 최신 300개(id 큰 순)와 비교해 빠진 개수
      Set<Integer> expected = new HashSet<>(jdbcTemplate.queryForList(
          "SELECT id FROM chat_message WHERE chat_room_id = ? ORDER BY sent_at DESC, id DESC LIMIT ?", Integer.class, roomId, PAGES * 20));
      long missing = expected.stream().filter(id -> !seen.contains(id)).count();
      System.out.printf("[SCROLL] %s pages=%d received=%d unique=%d duplicates=%d duplicatePages=%s missingFromNewest%d=%d samePage1Twice=%s avgMsPerPage=%d firstIdsPage0=%s firstIdsPage1=%s%n",
          e.getKey(), PAGES, all.size(), seen.size(), duplicates, dupPages, PAGES * 20, missing, page1a.equals(page1b),
          totalMs / PAGES, all.subList(0, 5), all.subList(20, 25));
    }
  }

  /** before가 null이면 첫 화면, 아니면 그 id보다 이전 20개 */
  private List<Integer> pageIds(User viewer, Integer roomId, Integer before) throws Exception {
    var request = get("/api/v1/chat/{roomId}/messages", roomId).param("size", "20");
    if (before != null) request.param("before", String.valueOf(before));
    String body = mockMvc.perform(request
        .cookie(new Cookie("access_token", jwtProvider.createAccess(viewer.getEmail(), viewer.getRole(), 60))))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
    List<Integer> ids = new ArrayList<>();
    for (JsonNode m : objectMapper.readTree(body).path("data").path("content")) ids.add(m.path("id").asInt());
    return ids;
  }

  /** 1,000줄씩 한 문장(INSERT ... VALUES (...),(...),...)으로 넣음 — 한 줄씩 보내면 Docker MySQL에서 몇 시간 걸림 */
  private void insert(Integer roomId, Integer senderId, java.util.function.IntFunction<LocalDateTime> sentAt) {
    for (int start = 0; start < TOTAL; start += 1000) {
      StringBuilder sql = new StringBuilder("INSERT INTO chat_message (chat_room_id, sender_id, message_content, sent_at, file_yn, read_yn, unread_count) VALUES ");
      List<Object> args = new ArrayList<>();
      for (int i = start; i < start + 1000; i++) {
        sql.append(i == start ? "" : ",").append("(?,?,?,?,?,?,?)");
        args.add(roomId); args.add(senderId); args.add("m" + i); args.add(Timestamp.valueOf(sentAt.apply(i)));
        args.add(false); args.add(false); args.add(0);
      }
      jdbcTemplate.update(sql.toString(), args.toArray());
    }
  }

  private ChatRoom room(User a, User b) {
    return chatRoomService.createChatRoom("방", List.of(a.getId(), b.getId()), a.getEmail());
  }

  private User newUser(String prefix) {
    String email = prefix + "-" + UUID.randomUUID() + "@test.com";
    return userRepository.save(User.createUser("pw", prefix, Role.USER, email, null, null, null, null));
  }
}
