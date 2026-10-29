package com.goodee.coreconnect.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mockingDetails;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;

import com.goodee.coreconnect.chat.controller.ChatMessageController;
import com.goodee.coreconnect.chat.dto.request.SendMessageRequestDTO;
import com.goodee.coreconnect.chat.entity.ChatRoom;
import com.goodee.coreconnect.chat.pubsub.ChatPubSubService;
import com.goodee.coreconnect.chat.service.ChatRoomService;
import com.goodee.coreconnect.support.AbstractIntegrationTest;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

/**
 * STOMP 메시지 전송이 실패했을 때 클라이언트로 나가는 ERROR 내용에 서버 내부 예외 문구가 없는지
 *
 * - 메시지 저장(ChatRoomService.sendChatMessage)이 내부 정보를 담은 예외를 던지도록 바꾼 뒤 전송
 * - ChatPubSubService.publish로 나간 ERROR의 message가 고정 문구인지, 예외 문구가 섞이지 않았는지 확인
 */
class ChatSendErrorMessageTest extends AbstractIntegrationTest {

  private static final String INTERNAL_DETAIL = "SQL 오류: table chat_message column internal_col";

  @SpyBean private ChatRoomService chatRoomService;
  @SpyBean private ChatPubSubService chatPubSubService;
  @Autowired private ChatMessageController chatMessageController;
  @Autowired private UserRepository userRepository;

  @Test
  @DisplayName("전송이 실패하면 ERROR에는 고정 문구만 담기고, 서버 내부 예외 문구는 담기지 않는다")
  void sendFailure_errorPayloadHasNoExceptionText() {
    User a = newUser("a");
    User b = newUser("b");
    ChatRoom room = chatRoomService.createChatRoom("방", List.of(a.getId(), b.getId()), a.getEmail());
    doThrow(new RuntimeException(INTERNAL_DETAIL)).when(chatRoomService).sendChatMessage(anyInt(), anyInt(), any());

    SendMessageRequestDTO req = new SendMessageRequestDTO();
    req.setRoomId(room.getId());
    req.setContent("안녕하세요");
    SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.create();
    Map<String, Object> attributes = new HashMap<>();
    attributes.put("wsUserEmail", a.getEmail());
    accessor.setSessionAttributes(attributes);
    try {
      chatMessageController.sendMessage(req, accessor);
    } catch (org.springframework.transaction.UnexpectedRollbackException alreadyRolledBack) {
      // 기존 동작: 안쪽 @Transactional(sendChatMessage)이 예외로 롤백 표시를 남겨, 바깥 sendMessage 커밋 때 이 예외가 남
      // ERROR 방송은 그 전에 이미 나갔으므로 아래에서 내용만 확인
    }

    List<Map<?, ?>> errors = new java.util.ArrayList<>();
    for (var invocation : mockingDetails(chatPubSubService).getInvocations()) {
      Object payload = invocation.getMethod().getName().equals("publish") ? invocation.getArgument(1) : null;
      if (payload instanceof Map<?, ?> m && "ERROR".equals(m.get("type"))) {
        errors.add(m);
      }
    }

    assertThat(errors).as("보낸 ERROR 수").hasSize(1);
    assertThat(errors.get(0).get("message")).isEqualTo("메시지를 보내지 못했습니다");
    assertThat(String.valueOf(errors.get(0))).doesNotContain(INTERNAL_DETAIL).doesNotContain("internal_col");
  }

  private User newUser(String prefix) {
    String email = prefix + "-" + UUID.randomUUID() + "@test.com";
    return userRepository.save(User.createUser("pw", prefix, Role.USER, email, null, null, null, null));
  }
}
