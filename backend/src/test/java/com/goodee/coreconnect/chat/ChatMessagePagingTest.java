package com.goodee.coreconnect.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
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
import com.goodee.coreconnect.chat.entity.Chat;
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
 * 메시지 목록 API (GET /api/v1/chat/{roomId}/messages)
 *
 * - 11번: 같은 시각 메시지도 순서가 하나로 고정(sent_at DESC, id DESC) → 페이지를 넘겨도 중복·빠짐 없음
 * - 6-1: 페이지 하나를 열 때 방 메시지 전체를 읽지 않음 (DB에서 LIMIT)
 * - 6-2: SQL 수가 페이지 크기(메시지 수)와 상관없음 (메시지마다 하던 조회를 페이지 단위로 묶음)
 * - 9번 A: 커서 before(이전 메시지)·after(놓친 뒤 메시지)
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = "security.mode=secure")
class ChatMessagePagingTest extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtProvider jwtProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private ChatRoomService chatRoomService;
  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private EntityManagerFactory entityManagerFactory;

  private final ObjectMapper objectMapper = new ObjectMapper();

  @Test
  @DisplayName("[11] 모두 같은 시각인 메시지 45개를 20개씩 위로 스크롤하면 id 큰 순서로 중복·빠짐 없이 온다")
  void sameTimestamp_pagesAreStable() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    ChatRoom room = room(a, b);
    insert(room.getId(), a.getId(), 45, i -> LocalDateTime.now().plusMinutes(1).withNano(0));
    List<Integer> expected = jdbcTemplate.queryForList(
        "SELECT id FROM chat_message WHERE chat_room_id = ? ORDER BY id DESC", Integer.class, room.getId());

    assertThat(scrollToTheBeginning(b, room, 20)).as("이어 붙이면 id 큰 순서 그대로").isEqualTo(expected);
  }

  @Test
  @DisplayName("[6-1] 메시지 150개 방에서 20개 페이지를 열 때 방 메시지 전체를 엔티티로 만들지 않는다")
  void page_doesNotLoadWholeRoom() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    ChatRoom room = room(a, b);
    insert(room.getId(), a.getId(), 150, i -> LocalDateTime.now().plusMinutes(1).plusSeconds(i));

    Statistics stats = statistics();
    try {
      stats.clear();
      perform(b, get("/api/v1/chat/{roomId}/messages", room.getId()).param("size", "20"));
      assertThat(stats.getEntityLoadCount()).as("만든 엔티티 수 (메시지 20 + 보낸 사람 등)").isLessThan(100);
    } finally {
      stats.setStatisticsEnabled(false);
    }
  }

  @Test
  @DisplayName("[6-2] SQL 수가 페이지 크기와 상관없다 (메시지 5개 페이지 = 20개 페이지)")
  void sqlCount_doesNotGrowWithPageSize() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    ChatRoom room = room(a, b);
    for (int i = 0; i < 20; i++) chatRoomService.sendChatMessage(room.getId(), i % 2 == 0 ? a.getId() : b.getId(), "m" + i);

    long five = sqlCountFor(b, room, 5);
    long twenty = sqlCountFor(b, room, 20);

    assertThat(twenty).as("20개 페이지 SQL 수 (5개 페이지는 %d)", five).isEqualTo(five);
  }

  @Test
  @DisplayName("[6-2] 묶음 조회로 바꿔도 내 읽음 여부와 안 읽은 사람 수(보낸 사람 제외)는 그대로다")
  void readYnAndUnreadCount_stillCorrect() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    User c = newUser("c");
    ChatRoom room = chatRoomService.createChatRoom("방", List.of(a.getId(), b.getId(), c.getId()), a.getEmail());
    Chat x = chatRoomService.sendChatMessage(room.getId(), a.getId(), "X");
    jdbcTemplate.update("UPDATE chat_message_read_status SET chat_message_read_status_read_yn = true WHERE chat_message_id = ? AND user_id = ?", x.getId(), b.getId());

    JsonNode m = data(perform(b, get("/api/v1/chat/{roomId}/messages", room.getId()))).path("content").get(0);

    assertThat(m.path("readYn").asBoolean()).as("B는 읽음").isTrue();
    assertThat(m.path("unreadCount").asInt()).as("안 읽은 사람은 C 한 명 (보낸 A 제외)").isEqualTo(1);
    assertThat(m.path("senderName").asText()).isEqualTo(a.getName());
  }

  @Test
  @DisplayName("[6-2] 보낸 사람 기록이 '안 읽음'으로 남아 있어도 안 읽은 사람 수에 세지 않는다")
  void senderRowLeftUnread_isNotCounted() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    User c = newUser("c");
    ChatRoom room = chatRoomService.createChatRoom("방", List.of(a.getId(), b.getId(), c.getId()), a.getEmail());
    Chat x = chatRoomService.sendChatMessage(room.getId(), a.getId(), "X");
    // 보낸 사람 A의 기록을 일부러 '안 읽음'으로 되돌리고, B는 읽음으로
    assertThat(jdbcTemplate.update("UPDATE chat_message_read_status SET chat_message_read_status_read_yn = false WHERE chat_message_id = ? AND user_id = ?", x.getId(), a.getId())).as("A 기록 존재").isEqualTo(1);
    jdbcTemplate.update("UPDATE chat_message_read_status SET chat_message_read_status_read_yn = true WHERE chat_message_id = ? AND user_id = ?", x.getId(), b.getId());
    Integer unreadRows = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM chat_message_read_status WHERE chat_message_id = ? AND chat_message_read_status_read_yn = false", Integer.class, x.getId());

    JsonNode m = data(perform(b, get("/api/v1/chat/{roomId}/messages", room.getId()))).path("content").get(0);

    assertThat(unreadRows).as("표에는 안 읽음 행이 A, C 두 줄").isEqualTo(2);
    assertThat(m.path("unreadCount").asInt()).as("보낸 A는 빼고 C 한 명만").isEqualTo(1);
  }

  @Test
  @DisplayName("[6-2] joined_at이 NULL인 예전 참여자는 읽음 기록이 없는 옛 메시지도 보고, 그 메시지는 안 읽음으로 나온다")
  void legacyMember_noReadRow_showsUnread() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    User old = newUser("old");
    ChatRoom room = room(a, b);
    Chat x = chatRoomService.sendChatMessage(room.getId(), a.getId(), "예전 참여자가 들어오기 전 메시지");
    // joined_at 기능이 생기기 전에 들어온 참여자: joined_at NULL, X의 읽음 기록 없음
    jdbcTemplate.update("INSERT INTO chat_room_user (chat_room_id, user_id, joined_at) VALUES (?, ?, NULL)", room.getId(), old.getId());
    Integer oldRows = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM chat_message_read_status WHERE chat_message_id = ? AND user_id = ?", Integer.class, x.getId(), old.getId());

    JsonNode m = data(perform(old, get("/api/v1/chat/{roomId}/messages", room.getId()))).path("content").get(0);

    assertThat(oldRows).as("읽음 기록 없음").isZero();
    assertThat(m.path("id").asInt()).as("joined_at이 NULL이라 옛 메시지가 보임").isEqualTo(x.getId());
    assertThat(m.path("readYn").asBoolean()).as("기록이 없으면 안 읽음").isFalse();
    assertThat(m.path("unreadCount").asInt()).as("기록이 있는 B 한 명만 셈 (예전 참여자는 기록이 없어 안 셈)").isEqualTo(1);
  }

  @Test
  @DisplayName("[커서] before=id로 계속 넘기면 그 메시지보다 이전 것만 최신순으로, 끝까지 중복·빠짐 없이 온다")
  void before_walksToTheBeginning() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    ChatRoom room = room(a, b);
    LocalDateTime base = LocalDateTime.now().plusMinutes(1).withNano(0);
    insert(room.getId(), a.getId(), 50, i -> base.plusSeconds(i / 10)); // 10개씩 같은 시각
    List<Integer> expected = jdbcTemplate.queryForList(
        "SELECT id FROM chat_message WHERE chat_room_id = ? ORDER BY sent_at DESC, id DESC", Integer.class, room.getId());

    List<Integer> received = scrollToTheBeginning(b, room, 20);

    assertThat(received).isEqualTo(expected);
  }

  @Test
  @DisplayName("[커서] 스크롤 중간에 새 메시지가 와도 다음 묶음에 중복·빠짐이 없다")
  void before_notShiftedByNewMessages() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    ChatRoom room = room(a, b);
    LocalDateTime base = LocalDateTime.now().plusMinutes(1).withNano(0);
    insert(room.getId(), a.getId(), 40, i -> base.plusSeconds(i));
    List<Integer> expected = jdbcTemplate.queryForList(
        "SELECT id FROM chat_message WHERE chat_room_id = ? ORDER BY sent_at DESC, id DESC", Integer.class, room.getId());

    List<Integer> received = new ArrayList<>(ids(data(perform(b, get("/api/v1/chat/{roomId}/messages", room.getId()).param("size", "20")))));
    insert(room.getId(), a.getId(), 3, i -> base.plusHours(1).plusSeconds(i)); // 첫 화면을 본 뒤 새 메시지 3개
    received.addAll(ids(data(perform(b, get("/api/v1/chat/{roomId}/messages", room.getId())
        .param("before", "" + received.get(received.size() - 1)).param("size", "20")))));

    assertThat(received).as("새 메시지에 밀리지 않고 처음 40개가 그대로").isEqualTo(expected);
  }

  @Test
  @DisplayName("[커서·9번 A] after=id면 그 뒤 메시지만 오래된 순으로 size개씩 온다")
  void after_returnsNewerAscending() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    ChatRoom room = room(a, b);
    LocalDateTime base = LocalDateTime.now().plusMinutes(1).withNano(0);
    insert(room.getId(), a.getId(), 30, i -> base.plusSeconds(i / 10));
    List<Integer> asc = jdbcTemplate.queryForList(
        "SELECT id FROM chat_message WHERE chat_room_id = ? ORDER BY sent_at, id", Integer.class, room.getId());

    JsonNode page1 = data(perform(b, get("/api/v1/chat/{roomId}/messages", room.getId()).param("after", "" + asc.get(4)).param("size", "20")));
    assertThat(ids(page1)).isEqualTo(asc.subList(5, 25));
    assertThat(page1.path("last").asBoolean()).isFalse();

    JsonNode page2 = data(perform(b, get("/api/v1/chat/{roomId}/messages", room.getId()).param("after", "" + asc.get(24)).param("size", "20")));
    assertThat(ids(page2)).isEqualTo(asc.subList(25, 30));
    assertThat(page2.path("last").asBoolean()).isTrue();
  }

  @Test
  @DisplayName("[커서] after로 받아도 방에 들어오기 전 메시지는 오지 않는다 (joined_at)")
  void after_respectsJoinedAt() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    ChatRoom room = room(a, b);
    LocalDateTime base = LocalDateTime.now().plusMinutes(1).withNano(0);
    insert(room.getId(), a.getId(), 10, i -> base.plusSeconds(i));
    Integer oldest = jdbcTemplate.queryForObject("SELECT MIN(id) FROM chat_message WHERE chat_room_id = ?", Integer.class, room.getId());
    // B가 5번째 메시지 시각에 들어온 것으로
    jdbcTemplate.update("UPDATE chat_room_user SET joined_at = ? WHERE chat_room_id = ? AND user_id = ?",
        Timestamp.valueOf(base.plusSeconds(5)), room.getId(), b.getId());

    JsonNode res = data(perform(b, get("/api/v1/chat/{roomId}/messages", room.getId()).param("after", "" + oldest).param("size", "20")));

    assertThat(ids(res)).hasSize(5); // 5–9초 메시지
  }

  @Test
  @DisplayName("[커서] 다른 방 메시지 id를 커서로 주면 400")
  void cursorFromOtherRoom_isBadRequest() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    ChatRoom mine = room(a, b);
    ChatRoom other = room(a, newUser("c"));
    Chat foreign = chatRoomService.sendChatMessage(other.getId(), a.getId(), "다른 방");

    mockMvc.perform(as(b, get("/api/v1/chat/{roomId}/messages", mine.getId()).param("before", "" + foreign.getId())))
        .andExpect(status().isBadRequest());
  }

  @Test
  @DisplayName("첫 화면(파라미터 없음)은 최신 size개를 주고 전체 개수는 세지 않는다. 예전 page 파라미터는 무시한다")
  void latest_hasNoTotalCount() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    ChatRoom room = room(a, b);
    insert(room.getId(), a.getId(), 25, i -> LocalDateTime.now().plusMinutes(1).plusSeconds(i));
    List<Integer> newest = jdbcTemplate.queryForList(
        "SELECT id FROM chat_message WHERE chat_room_id = ? ORDER BY sent_at DESC, id DESC LIMIT 20", Integer.class, room.getId());

    JsonNode latest = data(perform(b, get("/api/v1/chat/{roomId}/messages", room.getId()).param("size", "20")));
    JsonNode oldStyle = data(perform(b, get("/api/v1/chat/{roomId}/messages", room.getId()).param("page", "1").param("size", "20")));

    assertThat(ids(latest)).isEqualTo(newest);
    assertThat(latest.path("last").asBoolean()).isFalse();
    assertThat(latest.has("totalElements")).as("Slice: 개수 세는 쿼리 없음").isFalse();
    assertThat(ids(oldStyle)).as("page 번호 방식은 없앰 → 최신 20개").isEqualTo(newest);
  }

  @Test
  @DisplayName("[9번 A] 연결이 끊긴 동안 온 메시지를, 화면의 마지막 id로 after를 last가 될 때까지 받으면 빠짐·중복 없이 모두 온다")
  void reconnect_fetchesAllMissedMessages() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    ChatRoom room = room(a, b);
    for (int i = 0; i < 5; i++) chatRoomService.sendChatMessage(room.getId(), a.getId(), "끊기기 전 " + i);
    // B 화면에 있던 마지막 메시지 = 첫 화면의 가장 최신
    Integer lastOnScreen = ids(data(perform(b, get("/api/v1/chat/{roomId}/messages", room.getId()).param("size", "20")))).get(0);

    // B가 끊긴 동안 A가 150개 보냄 (화면은 100개씩 받음 → 두 번에 나눠 받아야 함)
    List<Integer> missed = new ArrayList<>();
    for (int i = 0; i < 150; i++) missed.add(chatRoomService.sendChatMessage(room.getId(), a.getId(), "끊긴 동안 " + i).getId());

    // 화면 fetchMissedMessages와 같은 순서: after=마지막 id, size=100, last가 아니면 받은 것의 마지막 id로 다시
    List<Integer> received = new ArrayList<>();
    Integer afterId = lastOnScreen;
    int requests = 0;
    while (true) {
      JsonNode res = data(perform(b, get("/api/v1/chat/{roomId}/messages", room.getId()).param("after", "" + afterId).param("size", "100")));
      requests++;
      List<Integer> got = ids(res);
      received.addAll(got);
      if (res.path("last").asBoolean() || requests > 5) break;
      afterId = got.get(got.size() - 1);
    }

    assertThat(received).as("보낸 순서 그대로 150개").isEqualTo(missed);
    assertThat(requests).isEqualTo(2);
  }

  @Test
  @DisplayName("size는 최대 100으로 자른다")
  void size_isCappedAt100() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    ChatRoom room = room(a, b);
    insert(room.getId(), a.getId(), 120, i -> LocalDateTime.now().plusMinutes(1).plusSeconds(i));

    JsonNode res = data(perform(b, get("/api/v1/chat/{roomId}/messages", room.getId()).param("size", "1000")));

    assertThat(ids(res)).hasSize(100);
  }

  // ───────────── 도우미 ─────────────

  /** 화면처럼 첫 화면(파라미터 없음) → 받은 것 중 가장 오래된 id로 before를 last가 될 때까지 */
  private List<Integer> scrollToTheBeginning(User viewer, ChatRoom room, int size) throws Exception {
    JsonNode first = data(perform(viewer, get("/api/v1/chat/{roomId}/messages", room.getId()).param("size", "" + size)));
    List<Integer> received = new ArrayList<>(ids(first));
    boolean last = first.path("last").asBoolean();
    int guard = 0;
    while (!last && guard++ < 100) {
      JsonNode next = data(perform(viewer, get("/api/v1/chat/{roomId}/messages", room.getId())
          .param("before", "" + received.get(received.size() - 1)).param("size", "" + size)));
      received.addAll(ids(next));
      last = next.path("last").asBoolean();
    }
    return received;
  }

  private long sqlCountFor(User viewer, ChatRoom room, int size) throws Exception {
    Statistics stats = statistics();
    try {
      stats.clear();
      perform(viewer, get("/api/v1/chat/{roomId}/messages", room.getId()).param("size", "" + size));
      return stats.getPrepareStatementCount();
    } finally {
      stats.setStatisticsEnabled(false);
    }
  }

  private Statistics statistics() {
    Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
    stats.setStatisticsEnabled(true);
    return stats;
  }

  /** 메시지를 SQL로 바로 넣음 (보낸 시각을 마음대로 정하려고). 읽음 상태 행은 만들지 않음 */
  private void insert(Integer roomId, Integer senderId, int count, java.util.function.IntFunction<LocalDateTime> sentAt) {
    for (int i = 0; i < count; i++) {
      jdbcTemplate.update("INSERT INTO chat_message (chat_room_id, sender_id, message_content, sent_at, file_yn, read_yn, unread_count) VALUES (?,?,?,?,?,?,?)",
          roomId, senderId, "m" + i, Timestamp.valueOf(sentAt.apply(i)), false, false, 0);
    }
  }

  private String perform(User viewer, MockHttpServletRequestBuilder request) throws Exception {
    return mockMvc.perform(as(viewer, request)).andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
  }

  private List<Integer> ids(JsonNode data) {
    List<Integer> ids = new ArrayList<>();
    for (JsonNode m : data.path("content")) ids.add(m.path("id").asInt());
    return ids;
  }

  private JsonNode data(String body) throws Exception {
    return objectMapper.readTree(body).path("data");
  }

  private ChatRoom room(User a, User b) {
    return chatRoomService.createChatRoom("방", List.of(a.getId(), b.getId()), a.getEmail());
  }

  private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
    return request.cookie(new Cookie("access_token", jwtProvider.createAccess(user.getEmail(), user.getRole(), 30)));
  }

  private User newUser(String prefix) {
    String email = prefix + "-" + UUID.randomUUID() + "@test.com";
    return userRepository.save(User.createUser("pw", prefix, Role.USER, email, null, null, null, null));
  }
}
