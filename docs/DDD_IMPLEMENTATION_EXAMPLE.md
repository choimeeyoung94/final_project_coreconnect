# 🚀 DDD 아키텍처 구현 예시

## 📌 개요

이 문서는 현재 CoreConnect 프로젝트의 **채팅 기능을 DDD 패턴으로 리팩토링**하는 구체적인 예시를 제공합니다.

---

## 1. 현재 구조 vs DDD 구조

### 1.1 Before (현재 레이어드 아키텍처)

```
chat/
├── controller/
│   └── ChatMessageController.java    # 비대한 컨트롤러 (300+ lines)
├── service/
│   ├── ChatService.java              # 비대한 서비스 (500+ lines)
│   └── ChatRoomService.java
├── entity/
│   ├── Chat.java                     # 빈약한 도메인 모델
│   └── ChatRoom.java
└── repository/
    └── ChatRepository.java
```

**문제점:**
- Service에 모든 비즈니스 로직 집중
- Entity는 단순 데이터 컨테이너
- 도메인 규칙이 여기저기 흩어짐

### 1.2 After (DDD 적용)

```
chat/
├── domain/                           # 도메인 계층
│   ├── model/
│   │   ├── ChatRoom.java            # 애그리게이트 루트 (풍부한 도메인 모델)
│   │   ├── ChatMessage.java
│   │   ├── vo/                      # Value Objects
│   │   │   ├── MessageContent.java
│   │   │   ├── RoomName.java
│   │   │   └── ReadStatus.java
│   │   └── event/                   # Domain Events
│   │       ├── MessageSentEvent.java
│   │       └── ChatRoomCreatedEvent.java
│   ├── service/                     # Domain Service
│   │   └── ChatRoomDomainService.java
│   └── repository/                  # Repository Interface
│       └── ChatRoomRepository.java
│
├── application/                     # 애플리케이션 계층
│   ├── service/
│   │   └── ChatApplicationService.java
│   ├── dto/
│   │   ├── SendMessageCommand.java
│   │   └── ChatRoomResponse.java
│   └── eventhandler/
│       └── ChatEventHandler.java
│
├── infrastructure/                  # 인프라 계층
│   ├── persistence/
│   │   ├── ChatRoomRepositoryImpl.java
│   │   └── JpaChatRoomRepository.java
│   └── messaging/
│       └── WebSocketMessageSender.java
│
└── interfaces/                      # 인터페이스 계층
    └── rest/
        └── ChatController.java      # 간결한 컨트롤러 (50 lines)
```

---

## 2. 단계별 구현

### Phase 1: 공통 인프라 구축

#### 2.1 도메인 이벤트 베이스 클래스

```java
// backend/src/main/java/com/goodee/coreconnect/shared/domain/event/DomainEvent.java
package com.goodee.coreconnect.shared.domain.event;

import java.time.LocalDateTime;

/**
 * 도메인 이벤트 인터페이스
 */
public interface DomainEvent {
    /**
     * 이벤트 발생 시간
     */
    LocalDateTime getOccurredAt();
    
    /**
     * 이벤트 타입 (예: "chat.message.sent")
     */
    String getEventType();
}
```

#### 2.2 이벤트 발행자

```java
// backend/src/main/java/com/goodee/coreconnect/shared/infrastructure/event/EventPublisher.java
package com.goodee.coreconnect.shared.infrastructure.event;

import com.goodee.coreconnect.shared.domain.event.DomainEvent;

/**
 * 이벤트 발행 인터페이스
 * 
 * 모놀리스: Spring Event 사용
 * 마이크로서비스: Kafka 사용
 */
public interface EventPublisher {
    void publish(DomainEvent event);
}

// 구현체 (Spring Event 버전)
@Component
@RequiredArgsConstructor
@Slf4j
public class SpringEventPublisher implements EventPublisher {
    
    private final ApplicationEventPublisher springPublisher;
    
    @Override
    public void publish(DomainEvent event) {
        log.info("📢 이벤트 발행: type={}, event={}", event.getEventType(), event);
        springPublisher.publishEvent(event);
    }
}
```

#### 2.3 애그리게이트 베이스 클래스

```java
// backend/src/main/java/com/goodee/coreconnect/shared/domain/AggregateRoot.java
package com.goodee.coreconnect.shared.domain;

import com.goodee.coreconnect.shared.domain.event.DomainEvent;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * 애그리게이트 루트 베이스 클래스
 * 
 * 도메인 이벤트 관리 기능 제공
 */
public abstract class AggregateRoot {
    
    private final transient List<DomainEvent> domainEvents = new ArrayList<>();
    
    /**
     * 도메인 이벤트 추가
     */
    protected void addDomainEvent(DomainEvent event) {
        this.domainEvents.add(event);
    }
    
    /**
     * 도메인 이벤트 조회 (읽기 전용)
     */
    public List<DomainEvent> getDomainEvents() {
        return Collections.unmodifiableList(domainEvents);
    }
    
    /**
     * 도메인 이벤트 초기화 (발행 후 호출)
     */
    public void clearDomainEvents() {
        this.domainEvents.clear();
    }
}
```

---

### Phase 2: 채팅 도메인 모델 구현

#### 2.1 Value Objects

```java
// backend/src/main/java/com/goodee/coreconnect/chat/domain/model/vo/MessageContent.java
package com.goodee.coreconnect.chat.domain.model.vo;

import lombok.Value;

/**
 * 메시지 내용 (Value Object)
 * 
 * 불변 객체, 비즈니스 규칙 포함
 */
@Value
public class MessageContent {
    
    public static final int MAX_LENGTH = 5000;
    
    String value;
    
    // 팩토리 메서드
    public static MessageContent of(String value) {
        validate(value);
        return new MessageContent(value);
    }
    
    // 비즈니스 규칙 검증
    private static void validate(String value) {
        if (value == null) {
            throw new IllegalArgumentException("메시지 내용은 null일 수 없습니다.");
        }
        if (value.trim().isEmpty()) {
            throw new IllegalArgumentException("메시지 내용은 비어있을 수 없습니다.");
        }
        if (value.length() > MAX_LENGTH) {
            throw new IllegalArgumentException(
                String.format("메시지 내용은 최대 %d자까지 가능합니다. (현재: %d자)", 
                    MAX_LENGTH, value.length())
            );
        }
    }
    
    // 비즈니스 메서드
    public boolean isEmpty() {
        return value.trim().isEmpty();
    }
    
    public boolean containsKeyword(String keyword) {
        return value.contains(keyword);
    }
    
    public MessageContent truncate(int maxLength) {
        if (value.length() <= maxLength) {
            return this;
        }
        return new MessageContent(value.substring(0, maxLength) + "...");
    }
}
```

```java
// backend/src/main/java/com/goodee/coreconnect/chat/domain/model/vo/RoomName.java
package com.goodee.coreconnect.chat.domain.model.vo;

import lombok.Value;

/**
 * 채팅방 이름 (Value Object)
 */
@Value
public class RoomName {
    
    public static final int MAX_LENGTH = 100;
    
    String value;
    
    public static RoomName of(String value) {
        validate(value);
        return new RoomName(value.trim());
    }
    
    private static void validate(String value) {
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException("방 이름은 비어있을 수 없습니다.");
        }
        if (value.length() > MAX_LENGTH) {
            throw new IllegalArgumentException(
                String.format("방 이름은 최대 %d자까지 가능합니다.", MAX_LENGTH)
            );
        }
    }
}
```

```java
// backend/src/main/java/com/goodee/coreconnect/chat/domain/model/vo/ReadStatus.java
package com.goodee.coreconnect.chat.domain.model.vo;

import lombok.Value;
import java.time.LocalDateTime;

/**
 * 읽음 상태 (Value Object)
 */
@Value
public class ReadStatus {
    Integer userId;
    boolean isRead;
    LocalDateTime readAt;
    
    public static ReadStatus unread(Integer userId) {
        return new ReadStatus(userId, false, null);
    }
    
    public static ReadStatus read(Integer userId) {
        return new ReadStatus(userId, true, LocalDateTime.now());
    }
    
    // 불변 객체이므로 새로운 객체 반환
    public ReadStatus markAsRead() {
        if (isRead) {
            return this;  // 이미 읽음
        }
        return new ReadStatus(userId, true, LocalDateTime.now());
    }
}
```

#### 2.2 도메인 이벤트

```java
// backend/src/main/java/com/goodee/coreconnect/chat/domain/model/event/MessageSentEvent.java
package com.goodee.coreconnect.chat.domain.model.event;

import com.goodee.coreconnect.shared.domain.event.DomainEvent;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 메시지 전송 이벤트
 */
@Getter
@RequiredArgsConstructor
public class MessageSentEvent implements DomainEvent {
    
    private final Integer messageId;
    private final Integer roomId;
    private final Integer senderId;
    private final String content;
    private final List<Integer> recipientIds;
    private final LocalDateTime occurredAt = LocalDateTime.now();
    
    @Override
    public String getEventType() {
        return "chat.message.sent";
    }
}
```

```java
// backend/src/main/java/com/goodee/coreconnect/chat/domain/model/event/ChatRoomCreatedEvent.java
package com.goodee.coreconnect.chat.domain.model.event;

import com.goodee.coreconnect.shared.domain.event.DomainEvent;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import java.time.LocalDateTime;

/**
 * 채팅방 생성 이벤트
 */
@Getter
@RequiredArgsConstructor
public class ChatRoomCreatedEvent implements DomainEvent {
    
    private final Integer roomId;
    private final String roomName;
    private final Integer creatorId;
    private final LocalDateTime occurredAt = LocalDateTime.now();
    
    @Override
    public String getEventType() {
        return "chat.room.created";
    }
}
```

#### 2.3 애그리게이트 루트: ChatRoom

```java
// backend/src/main/java/com/goodee/coreconnect/chat/domain/model/ChatRoom.java
package com.goodee.coreconnect.chat.domain.model;

import com.goodee.coreconnect.chat.domain.model.event.*;
import com.goodee.coreconnect.chat.domain.model.vo.*;
import com.goodee.coreconnect.shared.domain.AggregateRoot;
import com.goodee.coreconnect.user.entity.User;
import lombok.Getter;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 채팅방 애그리게이트 루트
 * 
 * 책임:
 * 1. 채팅방 생성/삭제
 * 2. 메시지 전송 (비즈니스 규칙 포함)
 * 3. 참여자 관리
 * 4. 읽음 상태 관리
 * 5. 도메인 이벤트 발행
 */
@Getter
public class ChatRoom extends AggregateRoot {
    
    private Integer id;  // DB PK (JPA에서 관리)
    private RoomName name;
    private LocalDateTime createdAt;
    private boolean isActive;
    
    // 애그리게이트 내부 엔티티 (생명주기를 함께 함)
    private List<ChatMessage> messages = new ArrayList<>();
    private Set<Integer> participantIds = new HashSet<>();
    
    // ==================== 생성자 (외부 노출 금지) ====================
    
    protected ChatRoom() {
        // JPA용 기본 생성자
    }
    
    private ChatRoom(RoomName name, Integer creatorId) {
        this.name = name;
        this.createdAt = LocalDateTime.now();
        this.isActive = true;
        this.participantIds.add(creatorId);
    }
    
    // ==================== 팩토리 메서드 ====================
    
    /**
     * 채팅방 생성
     * 
     * @param name 방 이름
     * @param creator 생성자
     * @return 새로운 채팅방
     */
    public static ChatRoom create(RoomName name, User creator) {
        ChatRoom room = new ChatRoom(name, creator.getId());
        
        // 도메인 이벤트 발행
        room.addDomainEvent(new ChatRoomCreatedEvent(
            room.id,
            name.getValue(),
            creator.getId()
        ));
        
        return room;
    }
    
    // ==================== 비즈니스 로직 ====================
    
    /**
     * 메시지 전송
     * 
     * 비즈니스 규칙:
     * 1. 참여자만 메시지를 보낼 수 있음
     * 2. 활성 상태의 채팅방에만 메시지 전송 가능
     * 3. 메시지 내용은 비어있을 수 없음
     * 
     * @param sender 발신자
     * @param content 메시지 내용
     * @return 생성된 메시지
     */
    public ChatMessage sendMessage(User sender, MessageContent content) {
        // 1. 비즈니스 규칙 검증
        validateCanSendMessage(sender);
        
        // 2. 메시지 생성
        ChatMessage message = ChatMessage.create(sender, content);
        this.messages.add(message);
        
        // 3. 읽음 상태 초기화 (발신자 제외한 모든 참여자)
        List<Integer> recipientIds = getOtherParticipantIds(sender.getId());
        recipientIds.forEach(recipientId -> {
            message.addReadStatus(ReadStatus.unread(recipientId));
        });
        
        // 4. 도메인 이벤트 발행
        addDomainEvent(new MessageSentEvent(
            message.getId(),
            this.id,
            sender.getId(),
            content.getValue(),
            recipientIds
        ));
        
        return message;
    }
    
    /**
     * 참여자 추가
     */
    public void addParticipant(User user) {
        if (isParticipant(user.getId())) {
            throw new IllegalArgumentException(
                String.format("이미 참여 중인 사용자입니다. userId=%d", user.getId())
            );
        }
        
        if (!isActive) {
            throw new IllegalStateException("비활성화된 채팅방입니다.");
        }
        
        this.participantIds.add(user.getId());
        
        addDomainEvent(new ParticipantJoinedEvent(this.id, user.getId()));
    }
    
    /**
     * 참여자 제거
     */
    public void removeParticipant(Integer userId) {
        if (!isParticipant(userId)) {
            throw new IllegalArgumentException("참여하지 않은 사용자입니다.");
        }
        
        this.participantIds.remove(userId);
        
        addDomainEvent(new ParticipantLeftEvent(this.id, userId));
        
        // 참여자가 없으면 채팅방 비활성화
        if (participantIds.isEmpty()) {
            deactivate();
        }
    }
    
    /**
     * 메시지 읽음 처리
     */
    public void markMessageAsRead(Integer messageId, User reader) {
        ChatMessage message = findMessage(messageId);
        message.markAsReadBy(reader.getId());
        
        addDomainEvent(new MessageReadEvent(messageId, this.id, reader.getId()));
    }
    
    /**
     * 특정 사용자의 안읽은 메시지 수
     */
    public int getUnreadCount(Integer userId) {
        return (int) messages.stream()
            .filter(msg -> !msg.isReadBy(userId))
            .filter(msg -> !msg.isSentBy(userId))  // 본인이 보낸 메시지 제외
            .count();
    }
    
    /**
     * 마지막 메시지 조회
     */
    public Optional<ChatMessage> getLastMessage() {
        return messages.stream()
            .max(Comparator.comparing(ChatMessage::getSentAt));
    }
    
    /**
     * 채팅방 비활성화
     */
    public void deactivate() {
        if (!isActive) {
            return;  // 이미 비활성화됨
        }
        
        this.isActive = false;
        addDomainEvent(new ChatRoomDeactivatedEvent(this.id));
    }
    
    // ==================== 도메인 규칙 검증 ====================
    
    private void validateCanSendMessage(User sender) {
        if (!isActive) {
            throw new IllegalStateException("비활성화된 채팅방에는 메시지를 보낼 수 없습니다.");
        }
        
        if (!isParticipant(sender.getId())) {
            throw new IllegalStateException(
                String.format("채팅방 참여자만 메시지를 보낼 수 있습니다. userId=%d", sender.getId())
            );
        }
    }
    
    private boolean isParticipant(Integer userId) {
        return participantIds.contains(userId);
    }
    
    private List<Integer> getOtherParticipantIds(Integer senderId) {
        return participantIds.stream()
            .filter(id -> !id.equals(senderId))
            .collect(Collectors.toList());
    }
    
    private ChatMessage findMessage(Integer messageId) {
        return messages.stream()
            .filter(m -> m.getId().equals(messageId))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException(
                String.format("메시지를 찾을 수 없습니다. messageId=%d", messageId)
            ));
    }
    
    // ==================== 쿼리 메서드 ====================
    
    public boolean hasParticipants() {
        return !participantIds.isEmpty();
    }
    
    public int getParticipantCount() {
        return participantIds.size();
    }
    
    public boolean isUrgentRoom() {
        // 비즈니스 규칙: 참여자가 10명 이상이면 중요한 채팅방
        return participantIds.size() >= 10;
    }
}
```

#### 2.4 엔티티: ChatMessage

```java
// backend/src/main/java/com/goodee/coreconnect/chat/domain/model/ChatMessage.java
package com.goodee.coreconnect.chat.domain.model;

import com.goodee.coreconnect.chat.domain.model.vo.MessageContent;
import com.goodee.coreconnect.chat.domain.model.vo.ReadStatus;
import com.goodee.coreconnect.user.entity.User;
import lombok.Getter;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 채팅 메시지 엔티티
 * 
 * ChatRoom 애그리게이트 내부의 엔티티
 * 독립적으로 조회되지 않고, 항상 ChatRoom을 통해 접근
 */
@Getter
public class ChatMessage {
    
    private Integer id;  // DB PK
    private Integer senderId;
    private String senderName;
    private MessageContent content;
    private LocalDateTime sentAt;
    private List<ReadStatus> readStatuses = new ArrayList<>();
    
    // ==================== 생성자 ====================
    
    protected ChatMessage() {
        // JPA용
    }
    
    private ChatMessage(User sender, MessageContent content) {
        this.senderId = sender.getId();
        this.senderName = sender.getName();
        this.content = content;
        this.sentAt = LocalDateTime.now();
    }
    
    // ==================== 팩토리 메서드 ====================
    
    public static ChatMessage create(User sender, MessageContent content) {
        return new ChatMessage(sender, content);
    }
    
    // ==================== 비즈니스 로직 ====================
    
    /**
     * 읽음 상태 추가
     */
    public void addReadStatus(ReadStatus status) {
        this.readStatuses.add(status);
    }
    
    /**
     * 특정 사용자가 읽었는지 확인
     */
    public boolean isReadBy(Integer userId) {
        return readStatuses.stream()
            .anyMatch(rs -> rs.getUserId().equals(userId) && rs.isRead());
    }
    
    /**
     * 특정 사용자가 보낸 메시지인지 확인
     */
    public boolean isSentBy(Integer userId) {
        return senderId.equals(userId);
    }
    
    /**
     * 특정 사용자의 읽음 처리
     */
    public void markAsReadBy(Integer userId) {
        ReadStatus oldStatus = findReadStatus(userId);
        readStatuses.remove(oldStatus);
        readStatuses.add(oldStatus.markAsRead());
    }
    
    /**
     * 안읽은 사용자 수
     */
    public int getUnreadCount() {
        return (int) readStatuses.stream()
            .filter(rs -> !rs.isRead())
            .count();
    }
    
    // ==================== Private 메서드 ====================
    
    private ReadStatus findReadStatus(Integer userId) {
        return readStatuses.stream()
            .filter(rs -> rs.getUserId().equals(userId))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException(
                String.format("읽음 상태를 찾을 수 없습니다. userId=%d", userId)
            ));
    }
}
```

---

### Phase 3: 애플리케이션 계층

#### 3.1 DTO (Command & Response)

```java
// backend/src/main/java/com/goodee/coreconnect/chat/application/dto/SendMessageCommand.java
package com.goodee.coreconnect.chat.application.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 메시지 전송 커맨드
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SendMessageCommand {
    private Integer roomId;
    private Integer senderId;
    private String content;
}
```

```java
// backend/src/main/java/com/goodee/coreconnect/chat/application/dto/ChatMessageResponse.java
package com.goodee.coreconnect.chat.application.dto;

import com.goodee.coreconnect.chat.domain.model.ChatMessage;
import lombok.Builder;
import lombok.Getter;
import java.time.LocalDateTime;

/**
 * 채팅 메시지 응답 DTO
 */
@Getter
@Builder
public class ChatMessageResponse {
    private Integer id;
    private Integer senderId;
    private String senderName;
    private String content;
    private LocalDateTime sentAt;
    private int unreadCount;
    
    /**
     * 도메인 모델 → DTO 변환
     */
    public static ChatMessageResponse from(ChatMessage message) {
        return ChatMessageResponse.builder()
            .id(message.getId())
            .senderId(message.getSenderId())
            .senderName(message.getSenderName())
            .content(message.getContent().getValue())
            .sentAt(message.getSentAt())
            .unreadCount(message.getUnreadCount())
            .build();
    }
}
```

#### 3.2 애플리케이션 서비스

```java
// backend/src/main/java/com/goodee/coreconnect/chat/application/service/ChatApplicationService.java
package com.goodee.coreconnect.chat.application.service;

import com.goodee.coreconnect.chat.application.dto.*;
import com.goodee.coreconnect.chat.domain.model.ChatMessage;
import com.goodee.coreconnect.chat.domain.model.ChatRoom;
import com.goodee.coreconnect.chat.domain.model.vo.MessageContent;
import com.goodee.coreconnect.chat.domain.repository.ChatRoomRepository;
import com.goodee.coreconnect.shared.infrastructure.event.EventPublisher;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 채팅 애플리케이션 서비스
 * 
 * 책임:
 * 1. 유스케이스 조율 (도메인 객체 조합)
 * 2. 트랜잭션 관리
 * 3. 도메인 이벤트 발행
 * 4. DTO 변환
 * 
 * 주의: 비즈니스 로직은 도메인 계층에!
 */
@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class ChatApplicationService {
    
    private final ChatRoomRepository chatRoomRepository;
    private final UserRepository userRepository;
    private final EventPublisher eventPublisher;
    
    /**
     * 메시지 전송 유스케이스
     */
    public ChatMessageResponse sendMessage(SendMessageCommand command) {
        log.info("📨 [sendMessage] 시작 - roomId={}, senderId={}", 
            command.getRoomId(), command.getSenderId());
        
        // 1. 도메인 객체 조회
        ChatRoom chatRoom = chatRoomRepository.findById(command.getRoomId())
            .orElseThrow(() -> new IllegalArgumentException(
                "채팅방을 찾을 수 없습니다. roomId=" + command.getRoomId()));
        
        User sender = userRepository.findById(command.getSenderId())
            .orElseThrow(() -> new IllegalArgumentException(
                "사용자를 찾을 수 없습니다. userId=" + command.getSenderId()));
        
        // 2. 도메인 로직 실행 (비즈니스 규칙은 도메인 계층에서 검증)
        MessageContent content = MessageContent.of(command.getContent());
        ChatMessage message = chatRoom.sendMessage(sender, content);
        
        // 3. 저장 (애그리게이트 전체 저장)
        chatRoomRepository.save(chatRoom);
        
        // 4. 도메인 이벤트 발행 (트랜잭션 커밋 후)
        publishDomainEvents(chatRoom);
        
        log.info("✅ [sendMessage] 완료 - messageId={}", message.getId());
        
        // 5. DTO 변환 및 반환
        return ChatMessageResponse.from(message);
    }
    
    /**
     * 메시지 읽음 처리 유스케이스
     */
    public void markAsRead(Integer roomId, Integer messageId, Integer userId) {
        log.info("👁️ [markAsRead] 시작 - roomId={}, messageId={}, userId={}", 
            roomId, messageId, userId);
        
        ChatRoom chatRoom = chatRoomRepository.findById(roomId)
            .orElseThrow(() -> new IllegalArgumentException("채팅방을 찾을 수 없습니다."));
        
        User reader = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        
        chatRoom.markMessageAsRead(messageId, reader);
        
        chatRoomRepository.save(chatRoom);
        publishDomainEvents(chatRoom);
        
        log.info("✅ [markAsRead] 완료");
    }
    
    /**
     * 채팅방 생성 유스케이스
     */
    public ChatRoomResponse createChatRoom(CreateChatRoomCommand command) {
        log.info("🏠 [createChatRoom] 시작 - roomName={}, creatorId={}", 
            command.getRoomName(), command.getCreatorId());
        
        User creator = userRepository.findById(command.getCreatorId())
            .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        
        RoomName roomName = RoomName.of(command.getRoomName());
        ChatRoom chatRoom = ChatRoom.create(roomName, creator);
        
        chatRoomRepository.save(chatRoom);
        publishDomainEvents(chatRoom);
        
        log.info("✅ [createChatRoom] 완료 - roomId={}", chatRoom.getId());
        
        return ChatRoomResponse.from(chatRoom);
    }
    
    /**
     * 도메인 이벤트 발행
     * 
     * 트랜잭션 커밋 후 발행되도록 TransactionSynchronization 사용 가능
     */
    private void publishDomainEvents(ChatRoom chatRoom) {
        chatRoom.getDomainEvents().forEach(event -> {
            try {
                eventPublisher.publish(event);
            } catch (Exception e) {
                log.error("❌ 이벤트 발행 실패: event={}", event, e);
                // 이벤트 발행 실패 시 처리 전략
                // 1. 재시도 큐에 저장
                // 2. Dead Letter Queue로 이동
                // 3. 알림 발송
            }
        });
        chatRoom.clearDomainEvents();
    }
}
```

#### 3.3 이벤트 핸들러 (알림 연동)

```java
// backend/src/main/java/com/goodee/coreconnect/chat/application/eventhandler/ChatEventHandler.java
package com.goodee.coreconnect.chat.application.eventhandler;

import com.goodee.coreconnect.chat.domain.model.event.MessageSentEvent;
import com.goodee.coreconnect.common.notification.enums.NotificationType;
import com.goodee.coreconnect.common.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * 채팅 이벤트 핸들러
 * 
 * 도메인 이벤트를 구독하여 후속 작업 처리
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ChatEventHandler {
    
    private final NotificationService notificationService;
    
    /**
     * 메시지 전송 이벤트 처리
     * → 알림 컨텍스트로 연동
     */
    @EventListener
    @Async  // 비동기 처리 (메인 트랜잭션과 분리)
    public void handleMessageSentEvent(MessageSentEvent event) {
        log.info("📬 [MessageSentEvent] 수신 - messageId={}, roomId={}, recipientCount={}", 
            event.getMessageId(), event.getRoomId(), event.getRecipientIds().size());
        
        try {
            // 각 수신자에게 알림 전송
            String message = "새로운 채팅 메시지: " + truncate(event.getContent(), 50);
            
            notificationService.sendNotificationToUsers(
                event.getRecipientIds(),
                NotificationType.CHAT,
                message,
                event.getMessageId(),
                event.getRoomId(),
                event.getSenderId(),
                null  // senderName은 NotificationService에서 조회
            );
            
            log.info("✅ [MessageSentEvent] 알림 전송 완료 - recipientCount={}", 
                event.getRecipientIds().size());
            
        } catch (Exception e) {
            log.error("❌ [MessageSentEvent] 알림 전송 실패", e);
            // 실패 처리 전략
            // 1. 재시도
            // 2. Dead Letter Queue
            // 3. 관리자 알림
        }
    }
    
    private String truncate(String text, int maxLength) {
        if (text == null || text.length() <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + "...";
    }
}
```

---

### Phase 4: 인프라 계층 (Repository 구현)

#### 4.1 Repository 인터페이스 (Domain Layer)

```java
// backend/src/main/java/com/goodee/coreconnect/chat/domain/repository/ChatRoomRepository.java
package com.goodee.coreconnect.chat.domain.repository;

import com.goodee.coreconnect.chat.domain.model.ChatRoom;
import java.util.List;
import java.util.Optional;

/**
 * 채팅방 리포지토리 인터페이스
 * 
 * 도메인 계층에서 정의, 인프라 계층에서 구현
 */
public interface ChatRoomRepository {
    
    /**
     * 채팅방 저장
     */
    ChatRoom save(ChatRoom chatRoom);
    
    /**
     * ID로 채팅방 조회 (애그리게이트 전체 로드)
     */
    Optional<ChatRoom> findById(Integer id);
    
    /**
     * 사용자가 참여 중인 채팅방 목록
     */
    List<ChatRoom> findByParticipant(Integer userId);
    
    /**
     * 채팅방 삭제
     */
    void delete(Integer id);
    
    /**
     * 채팅방 존재 여부
     */
    boolean exists(Integer id);
}
```

#### 4.2 JPA Repository (Infrastructure Layer)

```java
// backend/src/main/java/com/goodee/coreconnect/chat/infrastructure/persistence/JpaChatRoomRepository.java
package com.goodee.coreconnect.chat.infrastructure.persistence;

import com.goodee.coreconnect.chat.entity.ChatRoom as ChatRoomEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

/**
 * JPA Repository
 * 
 * 기존 엔티티와 호환을 위해 유지
 */
public interface JpaChatRoomRepository extends JpaRepository<ChatRoomEntity, Integer> {
    
    @Query("SELECT DISTINCT cr FROM ChatRoom cr " +
           "JOIN cr.chatRoomUsers cru " +
           "WHERE cru.user.id = :userId")
    List<ChatRoomEntity> findByParticipantId(Integer userId);
}
```

#### 4.3 Repository 구현체 (Adapter)

```java
// backend/src/main/java/com/goodee/coreconnect/chat/infrastructure/persistence/ChatRoomRepositoryImpl.java
package com.goodee.coreconnect.chat.infrastructure.persistence;

import com.goodee.coreconnect.chat.domain.model.ChatRoom;
import com.goodee.coreconnect.chat.domain.repository.ChatRoomRepository;
import com.goodee.coreconnect.chat.entity.ChatRoom as ChatRoomEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * ChatRoom Repository 구현체
 * 
 * 도메인 모델 ↔ JPA 엔티티 변환
 */
@Repository
@RequiredArgsConstructor
public class ChatRoomRepositoryImpl implements ChatRoomRepository {
    
    private final JpaChatRoomRepository jpaRepository;
    
    @Override
    public ChatRoom save(ChatRoom chatRoom) {
        // 도메인 모델 → JPA 엔티티
        ChatRoomEntity entity = toEntity(chatRoom);
        ChatRoomEntity saved = jpaRepository.save(entity);
        
        // JPA 엔티티 → 도메인 모델
        return toDomain(saved);
    }
    
    @Override
    public Optional<ChatRoom> findById(Integer id) {
        return jpaRepository.findById(id)
            .map(this::toDomain);
    }
    
    @Override
    public List<ChatRoom> findByParticipant(Integer userId) {
        return jpaRepository.findByParticipantId(userId).stream()
            .map(this::toDomain)
            .collect(Collectors.toList());
    }
    
    @Override
    public void delete(Integer id) {
        jpaRepository.deleteById(id);
    }
    
    @Override
    public boolean exists(Integer id) {
        return jpaRepository.existsById(id);
    }
    
    // ==================== 변환 메서드 ====================
    
    /**
     * JPA 엔티티 → 도메인 모델
     */
    private ChatRoom toDomain(ChatRoomEntity entity) {
        // TODO: 실제 변환 로직 구현
        // 1. Value Object 생성
        // 2. 도메인 모델 재구성
        // 3. 이벤트는 초기화 (이미 발행됨)
        return null;
    }
    
    /**
     * 도메인 모델 → JPA 엔티티
     */
    private ChatRoomEntity toEntity(ChatRoom domain) {
        // TODO: 실제 변환 로직 구현
        return null;
    }
}
```

---

### Phase 5: 인터페이스 계층 (Controller)

```java
// backend/src/main/java/com/goodee/coreconnect/chat/interfaces/rest/ChatController.java
package com.goodee.coreconnect.chat.interfaces.rest;

import com.goodee.coreconnect.chat.application.dto.*;
import com.goodee.coreconnect.chat.application.service.ChatApplicationService;
import com.goodee.coreconnect.common.dto.ResponseDTO;
import com.goodee.coreconnect.security.userdetails.CustomUserDetails;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * 채팅 REST API Controller
 * 
 * 책임:
 * 1. HTTP 요청/응답 처리
 * 2. 인증 정보 추출
 * 3. Application Service 호출
 * 
 * 주의: 비즈니스 로직 금지!
 */
@Tag(name = "채팅 API", description = "채팅 메시지 및 채팅방 관리")
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
@Slf4j
public class ChatController {
    
    private final ChatApplicationService chatApplicationService;
    
    /**
     * 메시지 전송 (REST API)
     * 
     * WebSocket은 별도 핸들러에서 처리
     */
    @Operation(summary = "채팅 메시지 전송", description = "새로운 채팅 메시지를 전송합니다.")
    @PostMapping("/messages")
    public ResponseEntity<ResponseDTO<ChatMessageResponse>> sendMessage(
        @RequestBody SendMessageRequest request,
        @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        log.info("📨 [POST /api/chat/messages] roomId={}, content.length={}", 
            request.getRoomId(), request.getContent().length());
        
        // DTO → Command 변환
        SendMessageCommand command = SendMessageCommand.builder()
            .roomId(request.getRoomId())
            .senderId(userDetails.getId())
            .content(request.getContent())
            .build();
        
        // Application Service 호출
        ChatMessageResponse response = chatApplicationService.sendMessage(command);
        
        return ResponseEntity.ok(ResponseDTO.success(response, "메시지 전송 성공"));
    }
    
    /**
     * 메시지 읽음 처리
     */
    @Operation(summary = "메시지 읽음 처리")
    @PutMapping("/rooms/{roomId}/messages/{messageId}/read")
    public ResponseEntity<ResponseDTO<Void>> markAsRead(
        @PathVariable Integer roomId,
        @PathVariable Integer messageId,
        @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        log.info("👁️ [PUT /api/chat/rooms/{}/messages/{}/read] userId={}", 
            roomId, messageId, userDetails.getId());
        
        chatApplicationService.markAsRead(roomId, messageId, userDetails.getId());
        
        return ResponseEntity.ok(ResponseDTO.success(null, "읽음 처리 성공"));
    }
    
    /**
     * 채팅방 생성
     */
    @Operation(summary = "채팅방 생성")
    @PostMapping("/rooms")
    public ResponseEntity<ResponseDTO<ChatRoomResponse>> createChatRoom(
        @RequestBody CreateChatRoomRequest request,
        @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        log.info("🏠 [POST /api/chat/rooms] roomName={}, creatorId={}", 
            request.getRoomName(), userDetails.getId());
        
        CreateChatRoomCommand command = CreateChatRoomCommand.builder()
            .roomName(request.getRoomName())
            .creatorId(userDetails.getId())
            .build();
        
        ChatRoomResponse response = chatApplicationService.createChatRoom(command);
        
        return ResponseEntity.ok(ResponseDTO.success(response, "채팅방 생성 성공"));
    }
}
```

---

## 3. 마이크로서비스 전환 예시

### 3.1 메시지 브로커 통합 (Kafka)

```java
// backend/chat-service/src/main/java/com/goodee/chatservice/infrastructure/event/KafkaEventPublisher.java
package com.goodee.chatservice.infrastructure.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.goodee.coreconnect.shared.domain.event.DomainEvent;
import com.goodee.coreconnect.shared.infrastructure.event.EventPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

/**
 * Kafka 이벤트 발행자
 * 
 * 마이크로서비스 간 통신
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class KafkaEventPublisher implements EventPublisher {
    
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;
    
    @Override
    public void publish(DomainEvent event) {
        try {
            String topic = event.getEventType().replace(".", "_");  // chat.message.sent → chat_message_sent
            String message = objectMapper.writeValueAsString(event);
            
            kafkaTemplate.send(topic, message)
                .whenComplete((result, ex) -> {
                    if (ex == null) {
                        log.info("✅ Kafka 이벤트 발행 성공: topic={}, offset={}", 
                            topic, result.getRecordMetadata().offset());
                    } else {
                        log.error("❌ Kafka 이벤트 발행 실패: topic={}", topic, ex);
                    }
                });
                
        } catch (Exception e) {
            log.error("❌ 이벤트 직렬화 실패", e);
            throw new EventPublishException("이벤트 발행 실패", e);
        }
    }
}
```

```yaml
# backend/chat-service/src/main/resources/application.yml
spring:
  kafka:
    bootstrap-servers: localhost:9092
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.apache.kafka.common.serialization.StringSerializer
    consumer:
      group-id: chat-service
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.apache.kafka.common.serialization.StringDeserializer
```

### 3.2 Notification Service에서 이벤트 구독

```java
// backend/notification-service/src/main/java/com/goodee/notificationservice/infrastructure/event/KafkaEventSubscriber.java
package com.goodee.notificationservice.infrastructure.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.goodee.notificationservice.application.service.NotificationApplicationService;
import com.goodee.notificationservice.application.dto.SendNotificationCommand;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Kafka 이벤트 구독자
 * 
 * 다른 마이크로서비스에서 발행한 이벤트 수신
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class KafkaEventSubscriber {
    
    private final ObjectMapper objectMapper;
    private final NotificationApplicationService notificationService;
    
    /**
     * 채팅 메시지 전송 이벤트 수신
     */
    @KafkaListener(topics = "chat_message_sent", groupId = "notification-service")
    public void onMessageSent(String message) {
        log.info("📬 [Kafka] chat_message_sent 이벤트 수신: {}", message);
        
        try {
            MessageSentEventPayload event = objectMapper.readValue(message, MessageSentEventPayload.class);
            
            // 알림 생성
            event.getRecipientIds().forEach(recipientId -> {
                SendNotificationCommand command = SendNotificationCommand.builder()
                    .recipientId(recipientId)
                    .type(NotificationType.CHAT)
                    .title("새로운 메시지")
                    .message("새로운 채팅 메시지: " + truncate(event.getContent(), 50))
                    .referenceType("CHAT_MESSAGE")
                    .referenceId(event.getMessageId())
                    .build();
                
                notificationService.send(command);
            });
            
            log.info("✅ [Kafka] 알림 생성 완료 - recipientCount={}", event.getRecipientIds().size());
            
        } catch (Exception e) {
            log.error("❌ [Kafka] 이벤트 처리 실패", e);
            // Dead Letter Queue로 이동
        }
    }
    
    private String truncate(String text, int maxLength) {
        if (text == null || text.length() <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + "...";
    }
}
```

---

## 4. 테스트 예시

### 4.1 도메인 모델 테스트

```java
// backend/src/test/java/com/goodee/coreconnect/chat/domain/model/ChatRoomTest.java
package com.goodee.coreconnect.chat.domain.model;

import com.goodee.coreconnect.chat.domain.model.vo.MessageContent;
import com.goodee.coreconnect.chat.domain.model.vo.RoomName;
import com.goodee.coreconnect.user.entity.User;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

/**
 * ChatRoom 도메인 모델 테스트
 */
class ChatRoomTest {
    
    @Test
    void 채팅방_생성_성공() {
        // given
        User creator = createUser(1, "홍길동");
        RoomName roomName = RoomName.of("테스트 채팅방");
        
        // when
        ChatRoom chatRoom = ChatRoom.create(roomName, creator);
        
        // then
        assertThat(chatRoom).isNotNull();
        assertThat(chatRoom.getName()).isEqualTo(roomName);
        assertThat(chatRoom.getParticipantIds()).contains(creator.getId());
        assertThat(chatRoom.isActive()).isTrue();
        assertThat(chatRoom.getDomainEvents()).hasSize(1);
    }
    
    @Test
    void 메시지_전송_성공() {
        // given
        User sender = createUser(1, "홍길동");
        ChatRoom chatRoom = ChatRoom.create(RoomName.of("테스트방"), sender);
        MessageContent content = MessageContent.of("안녕하세요");
        
        // when
        ChatMessage message = chatRoom.sendMessage(sender, content);
        
        // then
        assertThat(message).isNotNull();
        assertThat(message.getContent()).isEqualTo(content);
        assertThat(message.getSenderId()).isEqualTo(sender.getId());
        assertThat(chatRoom.getDomainEvents()).hasSize(2);  // RoomCreated + MessageSent
    }
    
    @Test
    void 비참여자가_메시지_전송_시_예외_발생() {
        // given
        User creator = createUser(1, "홍길동");
        User stranger = createUser(2, "김철수");
        ChatRoom chatRoom = ChatRoom.create(RoomName.of("테스트방"), creator);
        
        // when & then
        assertThatThrownBy(() -> chatRoom.sendMessage(stranger, MessageContent.of("안녕")))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("참여자만");
    }
    
    @Test
    void 빈_메시지_전송_시_예외_발생() {
        // given
        User sender = createUser(1, "홍길동");
        ChatRoom chatRoom = ChatRoom.create(RoomName.of("테스트방"), sender);
        
        // when & then
        assertThatThrownBy(() -> MessageContent.of(""))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("비어있을 수 없습니다");
    }
    
    @Test
    void 안읽은_메시지_수_계산() {
        // given
        User sender = createUser(1, "홍길동");
        User receiver = createUser(2, "김철수");
        ChatRoom chatRoom = ChatRoom.create(RoomName.of("테스트방"), sender);
        chatRoom.addParticipant(receiver);
        
        chatRoom.sendMessage(sender, MessageContent.of("메시지1"));
        chatRoom.sendMessage(sender, MessageContent.of("메시지2"));
        chatRoom.sendMessage(sender, MessageContent.of("메시지3"));
        
        // when
        int unreadCount = chatRoom.getUnreadCount(receiver.getId());
        
        // then
        assertThat(unreadCount).isEqualTo(3);
    }
    
    private User createUser(Integer id, String name) {
        // TODO: User 팩토리 메서드 사용
        return new User();
    }
}
```

### 4.2 Application Service 테스트

```java
// backend/src/test/java/com/goodee/coreconnect/chat/application/service/ChatApplicationServiceTest.java
package com.goodee.coreconnect.chat.application.service;

import com.goodee.coreconnect.chat.application.dto.*;
import com.goodee.coreconnect.chat.domain.model.ChatRoom;
import com.goodee.coreconnect.chat.domain.repository.ChatRoomRepository;
import com.goodee.coreconnect.shared.infrastructure.event.EventPublisher;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * ChatApplicationService 테스트
 */
@ExtendWith(MockitoExtension.class)
class ChatApplicationServiceTest {
    
    @Mock
    private ChatRoomRepository chatRoomRepository;
    
    @Mock
    private UserRepository userRepository;
    
    @Mock
    private EventPublisher eventPublisher;
    
    @InjectMocks
    private ChatApplicationService chatApplicationService;
    
    @Test
    void 메시지_전송_성공() {
        // given
        Integer roomId = 1;
        Integer senderId = 10;
        String content = "안녕하세요";
        
        User sender = createUser(senderId, "홍길동");
        ChatRoom chatRoom = createChatRoom(roomId, sender);
        
        when(chatRoomRepository.findById(roomId)).thenReturn(Optional.of(chatRoom));
        when(userRepository.findById(senderId)).thenReturn(Optional.of(sender));
        when(chatRoomRepository.save(any())).thenReturn(chatRoom);
        
        SendMessageCommand command = SendMessageCommand.builder()
            .roomId(roomId)
            .senderId(senderId)
            .content(content)
            .build();
        
        // when
        ChatMessageResponse response = chatApplicationService.sendMessage(command);
        
        // then
        assertThat(response).isNotNull();
        assertThat(response.getContent()).isEqualTo(content);
        assertThat(response.getSenderId()).isEqualTo(senderId);
        
        verify(chatRoomRepository).save(any(ChatRoom.class));
        verify(eventPublisher, atLeastOnce()).publish(any());
    }
    
    @Test
    void 존재하지_않는_채팅방에_메시지_전송_시_예외() {
        // given
        when(chatRoomRepository.findById(any())).thenReturn(Optional.empty());
        
        SendMessageCommand command = SendMessageCommand.builder()
            .roomId(999)
            .senderId(1)
            .content("안녕")
            .build();
        
        // when & then
        assertThatThrownBy(() -> chatApplicationService.sendMessage(command))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("찾을 수 없습니다");
    }
    
    private User createUser(Integer id, String name) {
        // TODO: 실제 구현
        return new User();
    }
    
    private ChatRoom createChatRoom(Integer id, User creator) {
        // TODO: 실제 구현
        return ChatRoom.create(RoomName.of("테스트방"), creator);
    }
}
```

---

## 5. 다음 단계

### 5.1 즉시 적용 가능
1. **Value Objects 적용**: `MessageContent`, `RoomName` 등
2. **도메인 이벤트 인프라**: `EventPublisher`, `AggregateRoot`
3. **Application Service 분리**: 비즈니스 로직을 도메인으로 이동

### 5.2 단계적 적용
1. **Week 1-2**: 공통 인프라 구축
2. **Week 3-4**: 채팅 도메인 리팩토링
3. **Week 5-6**: 이메일 도메인 리팩토링
4. **Week 7-8**: 알림 도메인 리팩토링

### 5.3 마이크로서비스 전환
1. **Phase 1**: Kafka 인프라 구축
2. **Phase 2**: 이벤트 기반 통신 전환
3. **Phase 3**: 서비스 분리 및 배포

---

**작성일**: 2026-01-12  
**버전**: 1.0
