package com.goodee.coreconnect.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mockingDetails;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;

import com.goodee.coreconnect.chat.entity.Chat;
import com.goodee.coreconnect.chat.entity.ChatRoom;
import com.goodee.coreconnect.chat.pubsub.ChatPubSubService;
import com.goodee.coreconnect.chat.repository.ChatMessageReadStatusRepository;
import com.goodee.coreconnect.chat.service.ChatRoomService;
import com.goodee.coreconnect.security.jwt.JwtProvider;
import com.goodee.coreconnect.support.AbstractIntegrationTest;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

import jakarta.persistence.EntityManagerFactory;
import jakarta.servlet.http.Cookie;

/**
 * 방을 나간 사람과 관련된 표시
 *
 * - 3-F: 나간 사람 몫의 "안 읽음"이 메시지 숫자에서 빠져야 함, 남은 사람 화면에는 커밋 뒤 UNREAD_COUNT_UPDATE로 알림
 * - 3-G: 나간 사람이 보낸 예전 메시지는 내용은 그대로, 보낸 사람은 "알 수 없음"(이메일·사진·부서·직급 비움). 다시 초대되면 이름이 다시 보임
 * - 5번(joined_at): 들어온 시점 이후 메시지만 보임. joined_at이 비어 있는 기존 참여자는 전부 보임
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = "security.mode=secure")
class ChatLeftMemberTest extends AbstractIntegrationTest {

  private static final String UNKNOWN = "알 수 없음";
  /** ChatRoomUserRepository.findUserIdsByChatRoomId의 JPQL (Hibernate 통계는 이 문자열로 셈) */
  private static final String MEMBER_IDS_QUERY = "SELECT cru.user.id FROM ChatRoomUser cru WHERE cru.chatRoom.id = :chatRoomId";

  @SpyBean private ChatPubSubService chatPubSubService;
  @Autowired private MockMvc mockMvc;
  @Autowired private JwtProvider jwtProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private ChatRoomService chatRoomService;
  @Autowired private ChatMessageReadStatusRepository readStatusRepository;
  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private EntityManagerFactory entityManagerFactory;

  private final ObjectMapper objectMapper = new ObjectMapper();

  // ───────────── 3-F 안 읽은 수 ─────────────

  @Test
  @DisplayName("[3-F] 메시지를 안 읽은 B가 나가면 그 메시지의 안 읽은 수에서 B 몫이 빠진다")
  void leftMember_removedFromUnreadCount() {
    User a = newUser("a");
    User b = newUser("b");
    User c = newUser("c");
    ChatRoom room = chatRoomService.createChatRoom("방", List.of(a.getId(), b.getId(), c.getId()), a.getEmail());
    Chat x = chatRoomService.sendChatMessage(room.getId(), a.getId(), "X");
    chatRoomService.markMessagesAsRead(room.getId(), c.getId());
    assertThat(readStatusRepository.countUnreadByChatId(x.getId())).as("나가기 전 (B 몫)").isEqualTo(1);

    chatRoomService.leaveChatRoom(room.getId(), b.getEmail());

    assertThat(readStatusRepository.countUnreadByChatId(x.getId())).as("B가 나간 뒤").isZero();
  }

  @Test
  @DisplayName("[3-F] B가 방1을 나가도 방2 메시지의 안 읽은 수와 C의 방 목록 안 읽은 수는 그대로다")
  void otherRoomsAndRoomListUntouched() {
    User a = newUser("a");
    User b = newUser("b");
    User c = newUser("c");
    ChatRoom room1 = chatRoomService.createChatRoom("방1", List.of(a.getId(), b.getId(), c.getId()), a.getEmail());
    ChatRoom room2 = chatRoomService.createChatRoom("방2", List.of(b.getId(), c.getId()), c.getEmail());
    chatRoomService.sendChatMessage(room1.getId(), a.getId(), "C도 아직 안 읽은 메시지");
    Chat y = chatRoomService.sendChatMessage(room2.getId(), c.getId(), "Y");

    chatRoomService.leaveChatRoom(room1.getId(), b.getEmail());

    assertThat(readStatusRepository.countUnreadByChatId(y.getId())).as("방2 Y (B 몫 그대로)").isEqualTo(1);
    long cRoom1Unread = chatRoomService.getChatRoomListWithUnreadCount(c.getId()).stream()
        .filter(r -> r.getRoomId().equals(room1.getId())).findFirst().orElseThrow().getUnreadCount();
    // C가 안 읽은 것: A 메시지 1개 + B의 나가기 안내 1개
    assertThat(cRoom1Unread).as("C의 방1 안 읽은 수").isEqualTo(2);
  }

  @Test
  @DisplayName("[3-F] 나가기가 커밋된 뒤 방에 바뀐 메시지의 UNREAD_COUNT_UPDATE(새 숫자 0)를 보낸다")
  void unreadUpdateBroadcastAfterLeave() {
    User a = newUser("a");
    User b = newUser("b");
    ChatRoom room = chatRoomService.createChatRoom("방", List.of(a.getId(), b.getId()), a.getEmail());
    Chat x = chatRoomService.sendChatMessage(room.getId(), a.getId(), "X");

    chatRoomService.leaveChatRoom(room.getId(), b.getEmail());

    String topic = "/topic/chat.room." + room.getId();
    List<Map<?, ?>> updates = new ArrayList<>();
    mockingDetails(chatPubSubService).getInvocations().stream()
        .filter(i -> i.getMethod().getName().equals("publish") && topic.equals(i.getArgument(0)))
        .map(i -> i.getArgument(1))
        .filter(p -> p instanceof Map<?, ?> m && "UNREAD_COUNT_UPDATE".equals(m.get("type")))
        .forEach(p -> updates.add((Map<?, ?>) p));
    assertThat(updates).as("방에 보낸 UNREAD_COUNT_UPDATE")
        .anySatisfy(m -> {
          assertThat(m.get("chatId")).isEqualTo(x.getId());
          assertThat(m.get("unreadCount")).isEqualTo(0);
        });
  }

  // ───────────── 3-G 나간 사람 이름 ─────────────

  @Test
  @DisplayName("[3-G] A가 나간 뒤 B의 메시지 목록에서 A의 예전 메시지는 내용 그대로, 보낸 사람은 '알 수 없음'이다")
  void leftSender_shownAsUnknown() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    ChatRoom room = chatRoomService.createChatRoom("방", List.of(a.getId(), b.getId(), newUser("c").getId()), a.getEmail());
    chatRoomService.sendChatMessage(room.getId(), a.getId(), "A가 남긴 말");
    chatRoomService.leaveChatRoom(room.getId(), a.getEmail());

    JsonNode msg = messageWithContent(messages(b, room), "A가 남긴 말");
    assertThat(msg).as("A의 예전 메시지 (내용 그대로)").isNotNull();
    assertThat(msg.path("senderName").asText()).isEqualTo(UNKNOWN);
    assertThat(msg.path("senderEmail").isNull()).as("senderEmail 비움").isTrue();
    assertThat(msg.path("senderProfileImageUrl").isNull()).as("프로필 사진 비움").isTrue();
    assertThat(msg.path("senderDeptName").isNull()).as("부서 비움").isTrue();
  }

  @Test
  @DisplayName("[3-G] 방 목록의 마지막 메시지 보낸 사람도 나간 사람이면 '알 수 없음'이다")
  void leftSender_unknownInRoomList() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    ChatRoom room = chatRoomService.createChatRoom("방", List.of(a.getId(), b.getId(), newUser("c").getId()), a.getEmail());
    chatRoomService.leaveChatRoom(room.getId(), a.getEmail()); // 마지막 메시지 = A의 나가기 안내

    JsonNode rooms = data(mockMvc.perform(as(b, get("/api/v1/chat/rooms/messages/latest"))).andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
    JsonNode mine = null;
    for (JsonNode r : rooms) {
      if (r.path("roomId").asInt() == room.getId()) mine = r;
    }
    assertThat(mine).isNotNull();
    assertThat(mine.path("lastSenderName").asText()).isEqualTo(UNKNOWN);
  }

  @Test
  @DisplayName("[3-G] 나간 A를 다시 초대하면 예전 메시지가 아니라 다시 들어온 뒤 메시지에서 A 이름이 보인다")
  void reinvitedSender_nameShownAgain() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    ChatRoom room = chatRoomService.createChatRoom("방", List.of(a.getId(), b.getId(), newUser("c").getId()), a.getEmail());
    chatRoomService.sendChatMessage(room.getId(), a.getId(), "나가기 전 말");
    chatRoomService.leaveChatRoom(room.getId(), a.getEmail());
    invite(b, room, a);
    chatRoomService.sendChatMessage(room.getId(), a.getId(), "다시 들어와서 한 말");

    JsonNode list = messages(b, room);
    assertThat(messageWithContent(list, "다시 들어와서 한 말").path("senderName").asText()).isEqualTo(a.getName());
    assertThat(messageWithContent(list, "나가기 전 말").path("senderName").asText())
        .as("지금 참여자이므로 예전 메시지에도 이름이 다시 보임").isEqualTo(a.getName());
  }

  @Test
  @DisplayName("[3-G] 참여자 목록은 페이지마다 한 번만 읽는다 (메시지 5개든 20개든 1번)")
  void memberIdsLoadedOncePerPage() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    ChatRoom small = chatRoomService.createChatRoom("작은 방", List.of(a.getId(), b.getId()), a.getEmail());
    ChatRoom big = chatRoomService.createChatRoom("큰 방", List.of(a.getId(), b.getId()), a.getEmail());
    for (int i = 0; i < 5; i++) chatRoomService.sendChatMessage(small.getId(), a.getId(), "s" + i);
    for (int i = 0; i < 20; i++) chatRoomService.sendChatMessage(big.getId(), a.getId(), "b" + i);

    assertThat(memberIdQueriesFor(b, small)).as("메시지 5개 페이지").isEqualTo(1);
    assertThat(memberIdQueriesFor(b, big)).as("메시지 20개 페이지").isEqualTo(1);
  }

  private long memberIdQueriesFor(User viewer, ChatRoom room) throws Exception {
    Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
    stats.setStatisticsEnabled(true);
    try {
      stats.clear();
      messages(viewer, room);
      return stats.getQueryStatistics(MEMBER_IDS_QUERY).getExecutionCount();
    } finally {
      stats.setStatisticsEnabled(false);
    }
  }

  // ───────────── 5번 joined_at ─────────────

  @Test
  @DisplayName("[joined_at] 새로 초대된 D는 초대 전 메시지를 보지 못하고 초대 뒤 메시지만 본다")
  void newInvitee_seesOnlyAfterJoin() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    User d = newUser("d");
    ChatRoom room = chatRoomService.createChatRoom("방", List.of(a.getId(), b.getId(), newUser("c").getId()), a.getEmail());
    chatRoomService.sendChatMessage(room.getId(), a.getId(), "초대 전 말");
    Thread.sleep(1100); // joined_at은 초 단위
    invite(a, room, d);
    chatRoomService.sendChatMessage(room.getId(), a.getId(), "초대 뒤 말");

    JsonNode list = messages(d, room);
    assertThat(messageWithContent(list, "초대 전 말")).as("초대 전 메시지").isNull();
    assertThat(messageWithContent(list, "초대 뒤 말")).as("초대 뒤 메시지").isNotNull();
  }

  @Test
  @DisplayName("[joined_at] 나갔다가 다시 초대된 A는 나가 있던 동안의 메시지를 보지 못한다")
  void reinvited_seesOnlyAfterRejoin() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    ChatRoom room = chatRoomService.createChatRoom("방", List.of(a.getId(), b.getId(), newUser("c").getId()), a.getEmail());
    chatRoomService.leaveChatRoom(room.getId(), a.getEmail());
    chatRoomService.sendChatMessage(room.getId(), b.getId(), "A가 없을 때 말");
    Thread.sleep(1100); // joined_at은 초 단위
    invite(b, room, a);
    chatRoomService.sendChatMessage(room.getId(), b.getId(), "A가 돌아온 뒤 말");

    JsonNode list = messages(a, room);
    assertThat(messageWithContent(list, "A가 없을 때 말")).as("나가 있던 동안 메시지").isNull();
    assertThat(messageWithContent(list, "A가 돌아온 뒤 말")).isNotNull();
  }

  @Test
  @DisplayName("[joined_at] joined_at이 비어 있는 기존 참여자는 메시지를 전부 본다")
  void legacyMemberWithoutJoinedAt_seesAll() throws Exception {
    User a = newUser("a");
    User b = newUser("b");
    ChatRoom room = chatRoomService.createChatRoom("방", List.of(a.getId(), b.getId(), newUser("c").getId()), a.getEmail());
    chatRoomService.sendChatMessage(room.getId(), a.getId(), "예전 말");
    // 배포 전부터 있던 참여자: 컬럼만 추가되고 값은 비어 있음
    jdbcTemplate.update("UPDATE chat_room_user SET joined_at = NULL WHERE chat_room_id = ? AND user_id = ?", room.getId(), b.getId());

    assertThat(messageWithContent(messages(b, room), "예전 말")).isNotNull();
  }

  @Test
  @DisplayName("[joined_at] 안 읽은 수에 들어오기 전 메시지는 들어가지 않는다")
  void unreadExcludesBeforeJoin() throws Exception {
    User a = newUser("a");
    User d = newUser("d");
    ChatRoom room = chatRoomService.createChatRoom("방", List.of(a.getId(), newUser("b").getId(), newUser("c").getId()), a.getEmail());
    chatRoomService.sendChatMessage(room.getId(), a.getId(), "초대 전 1");
    chatRoomService.sendChatMessage(room.getId(), a.getId(), "초대 전 2");
    invite(a, room, d); // 초대 안내 1개

    long unread = chatRoomService.getChatRoomListWithUnreadCount(d.getId()).stream()
        .filter(r -> r.getRoomId().equals(room.getId())).findFirst().orElseThrow().getUnreadCount();
    assertThat(unread).as("D의 안 읽은 수 (초대 안내만)").isLessThanOrEqualTo(1);
  }

  // ───────────── 도우미 ─────────────

  private JsonNode messages(User viewer, ChatRoom room) throws Exception {
    String body = mockMvc.perform(as(viewer, get("/api/v1/chat/{roomId}/messages", room.getId()).param("size", "100")))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
    return data(body).path("content");
  }

  private void invite(User inviter, ChatRoom room, User invitee) throws Exception {
    mockMvc.perform(as(inviter, post("/api/v1/chat/{roomId}/invite", room.getId()))
        .contentType(MediaType.APPLICATION_JSON).content("{\"userIds\":[" + invitee.getId() + "]}"))
        .andExpect(status().isOk());
  }

  private static JsonNode messageWithContent(JsonNode list, String content) {
    for (JsonNode m : list) {
      if (content.equals(m.path("messageContent").asText())) return m;
    }
    return null;
  }

  private JsonNode data(String body) throws Exception {
    return objectMapper.readTree(body).path("data");
  }

  private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
    return request.cookie(new Cookie("access_token", jwtProvider.createAccess(user.getEmail(), user.getRole(), 30)));
  }

  private User newUser(String prefix) {
    String email = prefix + "-" + UUID.randomUUID() + "@test.com";
    return userRepository.save(User.createUser("pw", prefix, Role.USER, email, null, null, null, null));
  }
}
