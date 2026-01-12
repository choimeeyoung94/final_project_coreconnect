# 📐 DDD 아키텍처 설계 및 마이크로서비스 확장 전략

## 📌 목차
1. [현재 구조 분석](#1-현재-구조-분석)
2. [DDD 설계 원칙](#2-ddd-설계-원칙)
3. [바운디드 컨텍스트 정의](#3-바운디드-컨텍스트-정의)
4. [DDD 패키지 구조](#4-ddd-패키지-구조)
5. [도메인 모델 설계](#5-도메인-모델-설계)
6. [마이크로서비스 확장 전략](#6-마이크로서비스-확장-전략)
7. [마이그레이션 로드맵](#7-마이그레이션-로드맵)

---

## 1. 현재 구조 분석

### 1.1 현재 아키텍처 (레이어드 아키텍처)

```
현재 구조:
backend/
└── src/main/java/com/goodee/coreconnect/
    ├── chat/
    │   ├── controller/      # ChatMessageController
    │   ├── service/         # ChatService, ChatRoomService
    │   └── repository/      # ChatRepository
    ├── email/
    │   ├── controller/      # EmailController
    │   ├── service/         # EmailService
    │   └── repository/      # EmailRepository
    └── notification/
        ├── controller/      # NotificationController
        ├── service/         # NotificationService
        └── repository/      # NotificationRepository
```

### 1.2 현재 문제점

❌ **안티패턴들:**
- **빈약한 도메인 모델 (Anemic Domain Model)**: 엔티티가 데이터만 담고 있고 비즈니스 로직은 Service에 집중
- **서비스의 비대화**: Service가 너무 많은 책임을 가짐
- **도메인 경계 불명확**: 채팅, 알림, 이메일이 서로 강하게 결합됨
- **확장성 부족**: 마이크로서비스로 분리하기 어려운 구조

---

## 2. DDD 설계 원칙

### 2.1 핵심 개념

#### **전략적 설계 (Strategic Design)**
- **유비쿼터스 언어 (Ubiquitous Language)**: 개발자와 도메인 전문가가 같은 용어 사용
- **바운디드 컨텍스트 (Bounded Context)**: 명확한 경계를 가진 도메인 영역
- **컨텍스트 맵 (Context Map)**: 컨텍스트 간 관계 정의

#### **전술적 설계 (Tactical Design)**
- **엔티티 (Entity)**: 고유 식별자를 가진 객체
- **밸류 오브젝트 (Value Object)**: 불변 객체, 속성으로만 식별
- **애그리게이트 (Aggregate)**: 일관성 경계
- **도메인 서비스 (Domain Service)**: 엔티티나 VO에 속하지 않는 비즈니스 로직
- **리포지토리 (Repository)**: 애그리게이트 저장소 추상화
- **도메인 이벤트 (Domain Event)**: 도메인에서 발생한 중요한 사건

---

## 3. 바운디드 컨텍스트 정의

### 3.1 컨텍스트 식별

```
┌─────────────────────────────────────────────────────────────┐
│                     CoreConnect 시스템                       │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   채팅       │  │   이메일      │  │   알림        │      │
│  │  Context     │  │   Context     │  │  Context      │      │
│  │              │  │              │  │              │      │
│  │ - 메시지전송  │  │ - 메일발송    │  │ - 알림발송    │      │
│  │ - 채팅방관리  │  │ - 예약발송    │  │ - 읽음처리    │      │
│  │ - 읽음처리    │  │ - 메일함관리  │  │ - 구독관리    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                  ┌─────────────────┐                        │
│                  │   사용자 Context  │                        │
│                  │ (공유 커널)       │                        │
│                  └─────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 컨텍스트별 책임

| 컨텍스트 | 핵심 책임 | 도메인 용어 |
|---------|---------|-----------|
| **채팅** | 실시간 메시지 교환 | 메시지, 채팅방, 참여자, 읽음상태 |
| **이메일** | 비동기 메일 전송 | 메일, 수신자, 발신자, 예약발송, 메일함 |
| **알림** | 이벤트 기반 알림 전달 | 알림, 구독, 채널, 전송상태 |
| **사용자** | 사용자 정보 관리 | 사용자, 부서, 권한 |

### 3.3 컨텍스트 간 관계 (Context Map)

```
채팅 Context ────[이벤트]───> 알림 Context
  │                              ▲
  │                              │
  └────[공유 커널: User]───────────┘
  
이메일 Context ──[이벤트]───> 알림 Context
  │                              ▲
  │                              │
  └────[공유 커널: User]───────────┘
```

**관계 패턴:**
- **공유 커널 (Shared Kernel)**: User 도메인은 모든 컨텍스트에서 공유
- **이벤트 기반 통신**: 채팅/이메일에서 발생한 이벤트를 알림이 구독
- **느슨한 결합**: 각 컨텍스트는 독립적으로 배포 가능

---

## 4. DDD 패키지 구조

### 4.1 목표 구조 (DDD 적용 후)

```
backend/
└── src/main/java/com/goodee/coreconnect/
    │
    ├── chat/                           # 채팅 바운디드 컨텍스트
    │   ├── domain/                     # 도메인 계층
    │   │   ├── model/                  # 도메인 모델
    │   │   │   ├── ChatMessage.java    # 엔티티 (Entity)
    │   │   │   ├── ChatRoom.java       # 애그리게이트 루트
    │   │   │   ├── MessageContent.java # 밸류 오브젝트
    │   │   │   ├── ReadStatus.java     # 밸류 오브젝트
    │   │   │   └── Participant.java    # 엔티티
    │   │   ├── service/                # 도메인 서비스
    │   │   │   ├── ChatRoomDomainService.java
    │   │   │   └── MessageDeliveryService.java
    │   │   ├── event/                  # 도메인 이벤트
    │   │   │   ├── MessageSentEvent.java
    │   │   │   └── ChatRoomCreatedEvent.java
    │   │   └── repository/             # 리포지토리 인터페이스
    │   │       └── ChatRoomRepository.java
    │   │
    │   ├── application/                # 애플리케이션 계층
    │   │   ├── service/                # 애플리케이션 서비스
    │   │   │   ├── ChatMessageApplicationService.java
    │   │   │   └── ChatRoomApplicationService.java
    │   │   ├── dto/                    # DTO
    │   │   │   ├── SendMessageCommand.java
    │   │   │   └── ChatRoomResponse.java
    │   │   └── eventhandler/           # 이벤트 핸들러
    │   │       └── ChatEventHandler.java
    │   │
    │   ├── infrastructure/             # 인프라 계층
    │   │   ├── persistence/            # 영속성 구현
    │   │   │   ├── ChatRoomRepositoryImpl.java
    │   │   │   └── ChatJpaRepository.java
    │   │   └── messaging/              # 메시징 구현
    │   │       └── WebSocketMessageSender.java
    │   │
    │   └── interfaces/                 # 인터페이스 계층 (API)
    │       ├── rest/                   # REST API
    │       │   └── ChatMessageController.java
    │       └── websocket/              # WebSocket
    │           └── ChatWebSocketHandler.java
    │
    ├── email/                          # 이메일 바운디드 컨텍스트
    │   ├── domain/
    │   │   ├── model/
    │   │   │   ├── Email.java          # 애그리게이트 루트
    │   │   │   ├── Recipient.java      # 엔티티
    │   │   │   ├── EmailAddress.java   # 밸류 오브젝트
    │   │   │   ├── EmailContent.java   # 밸류 오브젝트
    │   │   │   └── ScheduledSend.java  # 밸류 오브젝트
    │   │   ├── service/
    │   │   │   ├── EmailSendDomainService.java
    │   │   │   └── EmailValidationService.java
    │   │   ├── event/
    │   │   │   ├── EmailSentEvent.java
    │   │   │   └── EmailScheduledEvent.java
    │   │   └── repository/
    │   │       └── EmailRepository.java
    │   │
    │   ├── application/
    │   │   ├── service/
    │   │   │   ├── EmailApplicationService.java
    │   │   │   └── EmailSchedulerService.java
    │   │   ├── dto/
    │   │   │   ├── SendEmailCommand.java
    │   │   │   └── EmailResponse.java
    │   │   └── eventhandler/
    │   │       └── EmailEventHandler.java
    │   │
    │   ├── infrastructure/
    │   │   ├── persistence/
    │   │   │   └── EmailRepositoryImpl.java
    │   │   ├── external/               # 외부 서비스 어댑터
    │   │   │   ├── SendGridAdapter.java
    │   │   │   └── S3StorageAdapter.java
    │   │   └── scheduler/
    │   │       └── EmailReservationScheduler.java
    │   │
    │   └── interfaces/
    │       └── rest/
    │           └── EmailController.java
    │
    ├── notification/                   # 알림 바운디드 컨텍스트
    │   ├── domain/
    │   │   ├── model/
    │   │   │   ├── Notification.java   # 애그리게이트 루트
    │   │   │   ├── NotificationType.java # 밸류 오브젝트 (Enum)
    │   │   │   ├── Recipient.java      # 엔티티
    │   │   │   └── DeliveryStatus.java # 밸류 오브젝트
    │   │   ├── service/
    │   │   │   └── NotificationDeliveryService.java
    │   │   ├── event/
    │   │   │   └── NotificationSentEvent.java
    │   │   └── repository/
    │   │       └── NotificationRepository.java
    │   │
    │   ├── application/
    │   │   ├── service/
    │   │   │   └── NotificationApplicationService.java
    │   │   ├── dto/
    │   │   │   ├── SendNotificationCommand.java
    │   │   │   └── NotificationResponse.java
    │   │   └── eventhandler/           # 외부 이벤트 구독
    │   │       ├── ChatEventSubscriber.java
    │   │       └── EmailEventSubscriber.java
    │   │
    │   ├── infrastructure/
    │   │   ├── persistence/
    │   │   │   └── NotificationRepositoryImpl.java
    │   │   └── delivery/
    │   │       ├── WebSocketDeliveryAdapter.java
    │   │       └── PushNotificationAdapter.java
    │   │
    │   └── interfaces/
    │       └── rest/
    │           └── NotificationController.java
    │
    └── shared/                         # 공유 커널
        ├── domain/
        │   ├── User.java               # 공유 도메인 모델
        │   ├── Department.java
        │   └── event/
        │       └── DomainEvent.java    # 도메인 이벤트 베이스
        └── infrastructure/
            └── eventbus/
                ├── EventBus.java
                └── EventPublisher.java
```

### 4.2 계층별 책임

#### **Domain Layer (도메인 계층)**
- **역할**: 핵심 비즈니스 로직 포함
- **특징**: 외부 의존성 없음, 순수 Java
- **포함**: Entity, Value Object, Domain Service, Repository Interface

#### **Application Layer (애플리케이션 계층)**
- **역할**: 유스케이스 조율, 트랜잭션 관리
- **특징**: 도메인 객체를 조합하여 비즈니스 흐름 구현
- **포함**: Application Service, DTO, Event Handler

#### **Infrastructure Layer (인프라 계층)**
- **역할**: 기술적 구현체
- **특징**: DB, 외부 API, 메시징 등 구체적 기술 구현
- **포함**: Repository Impl, External Adapters

#### **Interface Layer (인터페이스 계층)**
- **역할**: 외부와의 통신
- **특징**: REST, GraphQL, WebSocket 등
- **포함**: Controller, WebSocket Handler

---

## 5. 도메인 모델 설계

### 5.1 채팅 컨텍스트

#### **애그리게이트: ChatRoom**

```java
// ============================================
// Domain Layer - Aggregate Root
// ============================================
package com.goodee.coreconnect.chat.domain.model;

import java.time.LocalDateTime;
import java.util.*;
import lombok.*;

/**
 * 채팅방 애그리게이트 루트
 * 
 * 책임:
 * - 채팅방 생성/삭제
 * - 메시지 전송
 * - 참여자 관리
 * - 읽음 상태 관리
 */
@Getter
public class ChatRoom {
    private final ChatRoomId id;
    private RoomName name;
    private final List<ChatMessage> messages;
    private final List<Participant> participants;
    private LocalDateTime createdAt;
    
    // ========== 생성자 (팩토리 메서드) ==========
    public static ChatRoom create(RoomName name, User creator) {
        ChatRoom room = new ChatRoom(ChatRoomId.generate(), name);
        room.addParticipant(creator);
        room.createdAt = LocalDateTime.now();
        
        // 도메인 이벤트 발행
        room.addDomainEvent(new ChatRoomCreatedEvent(room.id, creator.getId()));
        return room;
    }
    
    private ChatRoom(ChatRoomId id, RoomName name) {
        this.id = id;
        this.name = name;
        this.messages = new ArrayList<>();
        this.participants = new ArrayList<>();
    }
    
    // ========== 비즈니스 로직 ==========
    
    /**
     * 메시지 전송
     */
    public ChatMessage sendMessage(User sender, MessageContent content) {
        // 1. 도메인 규칙 검증
        validateParticipant(sender);
        validateMessageContent(content);
        
        // 2. 메시지 생성
        ChatMessage message = ChatMessage.create(
            MessageId.generate(),
            sender,
            content,
            LocalDateTime.now()
        );
        
        // 3. 애그리게이트 상태 변경
        this.messages.add(message);
        
        // 4. 읽음 상태 초기화 (발신자 제외)
        initializeReadStatus(message, sender);
        
        // 5. 도메인 이벤트 발행
        addDomainEvent(new MessageSentEvent(
            message.getId(),
            this.id,
            sender.getId(),
            content.getValue(),
            getOtherParticipantIds(sender)
        ));
        
        return message;
    }
    
    /**
     * 참여자 추가
     */
    public void addParticipant(User user) {
        if (isParticipant(user)) {
            throw new IllegalArgumentException("이미 참여 중인 사용자입니다: " + user.getId());
        }
        
        Participant participant = new Participant(user, LocalDateTime.now());
        this.participants.add(participant);
        
        addDomainEvent(new ParticipantJoinedEvent(this.id, user.getId()));
    }
    
    /**
     * 메시지 읽음 처리
     */
    public void markMessageAsRead(MessageId messageId, User reader) {
        ChatMessage message = findMessage(messageId);
        message.markAsReadBy(reader);
        
        addDomainEvent(new MessageReadEvent(messageId, this.id, reader.getId()));
    }
    
    /**
     * 안읽은 메시지 수 계산
     */
    public int getUnreadCount(User user) {
        return (int) messages.stream()
            .filter(msg -> !msg.isReadBy(user))
            .filter(msg -> !msg.isSentBy(user))  // 본인이 보낸 메시지 제외
            .count();
    }
    
    // ========== 도메인 규칙 검증 ==========
    
    private void validateParticipant(User sender) {
        if (!isParticipant(sender)) {
            throw new IllegalStateException("채팅방 참여자만 메시지를 보낼 수 있습니다.");
        }
    }
    
    private void validateMessageContent(MessageContent content) {
        if (content.isEmpty()) {
            throw new IllegalArgumentException("메시지 내용은 비어있을 수 없습니다.");
        }
        if (content.exceedsMaxLength()) {
            throw new IllegalArgumentException("메시지 내용이 너무 깁니다. 최대 " + 
                MessageContent.MAX_LENGTH + "자까지 가능합니다.");
        }
    }
    
    private boolean isParticipant(User user) {
        return participants.stream()
            .anyMatch(p -> p.getUserId().equals(user.getId()));
    }
    
    private void initializeReadStatus(ChatMessage message, User sender) {
        participants.stream()
            .filter(p -> !p.getUserId().equals(sender.getId()))
            .forEach(p -> message.addReadStatus(ReadStatus.unread(p.getUser())));
    }
    
    private ChatMessage findMessage(MessageId messageId) {
        return messages.stream()
            .filter(m -> m.getId().equals(messageId))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("메시지를 찾을 수 없습니다: " + messageId));
    }
    
    private List<UserId> getOtherParticipantIds(User sender) {
        return participants.stream()
            .map(Participant::getUserId)
            .filter(id -> !id.equals(sender.getId()))
            .collect(Collectors.toList());
    }
    
    // ========== 도메인 이벤트 관리 ==========
    private final List<DomainEvent> domainEvents = new ArrayList<>();
    
    private void addDomainEvent(DomainEvent event) {
        this.domainEvents.add(event);
    }
    
    public List<DomainEvent> getDomainEvents() {
        return Collections.unmodifiableList(domainEvents);
    }
    
    public void clearDomainEvents() {
        this.domainEvents.clear();
    }
}

// ============================================
// Value Objects
// ============================================

/**
 * 채팅방 ID (Value Object)
 */
@Value
public class ChatRoomId {
    Integer value;
    
    public static ChatRoomId of(Integer value) {
        return new ChatRoomId(value);
    }
    
    public static ChatRoomId generate() {
        // ID 생성 로직은 Repository에서 처리하거나, UUID 사용
        return null;  // 실제 구현 시 수정
    }
}

/**
 * 방 이름 (Value Object)
 */
@Value
public class RoomName {
    String value;
    
    public static RoomName of(String value) {
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException("방 이름은 비어있을 수 없습니다.");
        }
        if (value.length() > 100) {
            throw new IllegalArgumentException("방 이름은 최대 100자까지 가능합니다.");
        }
        return new RoomName(value.trim());
    }
}

/**
 * 메시지 내용 (Value Object)
 */
@Value
public class MessageContent {
    public static final int MAX_LENGTH = 5000;
    
    String value;
    
    public static MessageContent of(String value) {
        if (value == null) {
            throw new IllegalArgumentException("메시지 내용은 null일 수 없습니다.");
        }
        return new MessageContent(value);
    }
    
    public boolean isEmpty() {
        return value.trim().isEmpty();
    }
    
    public boolean exceedsMaxLength() {
        return value.length() > MAX_LENGTH;
    }
}

/**
 * 읽음 상태 (Value Object)
 */
@Value
public class ReadStatus {
    UserId userId;
    boolean isRead;
    LocalDateTime readAt;
    
    public static ReadStatus unread(User user) {
        return new ReadStatus(user.getId(), false, null);
    }
    
    public static ReadStatus read(User user, LocalDateTime readAt) {
        return new ReadStatus(user.getId(), true, readAt);
    }
    
    public ReadStatus markAsRead() {
        return new ReadStatus(this.userId, true, LocalDateTime.now());
    }
}

// ============================================
// Entity
// ============================================

/**
 * 채팅 메시지 엔티티
 */
@Getter
public class ChatMessage {
    private final MessageId id;
    private final User sender;
    private final MessageContent content;
    private final LocalDateTime sentAt;
    private final List<ReadStatus> readStatuses;
    
    public static ChatMessage create(MessageId id, User sender, 
                                     MessageContent content, LocalDateTime sentAt) {
        return new ChatMessage(id, sender, content, sentAt);
    }
    
    private ChatMessage(MessageId id, User sender, MessageContent content, LocalDateTime sentAt) {
        this.id = id;
        this.sender = sender;
        this.content = content;
        this.sentAt = sentAt;
        this.readStatuses = new ArrayList<>();
    }
    
    public void addReadStatus(ReadStatus status) {
        this.readStatuses.add(status);
    }
    
    public boolean isReadBy(User user) {
        return readStatuses.stream()
            .anyMatch(rs -> rs.getUserId().equals(user.getId()) && rs.isRead());
    }
    
    public boolean isSentBy(User user) {
        return sender.getId().equals(user.getId());
    }
    
    public void markAsReadBy(User reader) {
        ReadStatus oldStatus = findReadStatus(reader);
        readStatuses.remove(oldStatus);
        readStatuses.add(oldStatus.markAsRead());
    }
    
    private ReadStatus findReadStatus(User user) {
        return readStatuses.stream()
            .filter(rs -> rs.getUserId().equals(user.getId()))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("읽음 상태를 찾을 수 없습니다."));
    }
}

/**
 * 참여자 엔티티
 */
@Getter
@AllArgsConstructor
public class Participant {
    private User user;
    private LocalDateTime joinedAt;
    
    public UserId getUserId() {
        return user.getId();
    }
}
```

#### **도메인 서비스**

```java
// ============================================
// Domain Service
// ============================================
package com.goodee.coreconnect.chat.domain.service;

/**
 * 메시지 전달 도메인 서비스
 * 
 * 여러 애그리게이트에 걸친 비즈니스 로직 처리
 */
@Service
public class MessageDeliveryService {
    
    /**
     * 메시지를 모든 참여자에게 전달할 수 있는지 검증
     */
    public boolean canDeliver(ChatRoom room, ChatMessage message) {
        // 비즈니스 규칙: 
        // - 채팅방이 활성 상태여야 함
        // - 참여자가 1명 이상이어야 함
        return room.isActive() && room.hasParticipants();
    }
    
    /**
     * 메시지 전달 우선순위 계산
     */
    public DeliveryPriority calculatePriority(ChatRoom room, ChatMessage message) {
        // 비즈니스 규칙에 따라 우선순위 결정
        if (room.isUrgentRoom()) {
            return DeliveryPriority.HIGH;
        }
        return DeliveryPriority.NORMAL;
    }
}
```

#### **도메인 이벤트**

```java
// ============================================
// Domain Events
// ============================================
package com.goodee.coreconnect.chat.domain.event;

/**
 * 메시지 전송 이벤트
 */
@Getter
@AllArgsConstructor
public class MessageSentEvent implements DomainEvent {
    private final MessageId messageId;
    private final ChatRoomId roomId;
    private final UserId senderId;
    private final String content;
    private final List<UserId> recipientIds;
    private final LocalDateTime occurredAt = LocalDateTime.now();
    
    @Override
    public String getEventType() {
        return "chat.message.sent";
    }
}

/**
 * 채팅방 생성 이벤트
 */
@Getter
@AllArgsConstructor
public class ChatRoomCreatedEvent implements DomainEvent {
    private final ChatRoomId roomId;
    private final UserId creatorId;
    private final LocalDateTime occurredAt = LocalDateTime.now();
    
    @Override
    public String getEventType() {
        return "chat.room.created";
    }
}

/**
 * 메시지 읽음 이벤트
 */
@Getter
@AllArgsConstructor
public class MessageReadEvent implements DomainEvent {
    private final MessageId messageId;
    private final ChatRoomId roomId;
    private final UserId readerId;
    private final LocalDateTime occurredAt = LocalDateTime.now();
    
    @Override
    public String getEventType() {
        return "chat.message.read";
    }
}
```

#### **리포지토리 인터페이스**

```java
// ============================================
// Repository Interface (Domain Layer)
// ============================================
package com.goodee.coreconnect.chat.domain.repository;

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
     * ID로 채팅방 조회
     */
    Optional<ChatRoom> findById(ChatRoomId id);
    
    /**
     * 사용자가 참여 중인 채팅방 조회
     */
    List<ChatRoom> findByParticipant(UserId userId);
    
    /**
     * 채팅방 삭제
     */
    void delete(ChatRoomId id);
    
    /**
     * 채팅방 존재 여부 확인
     */
    boolean exists(ChatRoomId id);
}
```

#### **애플리케이션 서비스**

```java
// ============================================
// Application Service
// ============================================
package com.goodee.coreconnect.chat.application.service;

/**
 * 채팅 메시지 애플리케이션 서비스
 * 
 * 책임:
 * - 유스케이스 조율
 * - 트랜잭션 관리
 * - 도메인 이벤트 발행
 * - DTO 변환
 */
@Service
@Transactional
@RequiredArgsConstructor
public class ChatMessageApplicationService {
    
    private final ChatRoomRepository chatRoomRepository;
    private final UserRepository userRepository;
    private final EventPublisher eventPublisher;
    
    /**
     * 메시지 전송 유스케이스
     */
    public ChatMessageResponse sendMessage(SendMessageCommand command) {
        // 1. 도메인 객체 조회
        ChatRoom chatRoom = chatRoomRepository.findById(ChatRoomId.of(command.getRoomId()))
            .orElseThrow(() -> new ChatRoomNotFoundException(command.getRoomId()));
        
        User sender = userRepository.findById(command.getSenderId())
            .orElseThrow(() -> new UserNotFoundException(command.getSenderId()));
        
        // 2. 도메인 로직 실행
        MessageContent content = MessageContent.of(command.getContent());
        ChatMessage message = chatRoom.sendMessage(sender, content);
        
        // 3. 저장
        chatRoomRepository.save(chatRoom);
        
        // 4. 도메인 이벤트 발행 (트랜잭션 커밋 후)
        publishDomainEvents(chatRoom);
        
        // 5. DTO 변환 및 반환
        return ChatMessageResponse.from(message);
    }
    
    /**
     * 메시지 읽음 처리 유스케이스
     */
    public void markAsRead(MarkAsReadCommand command) {
        ChatRoom chatRoom = chatRoomRepository.findById(ChatRoomId.of(command.getRoomId()))
            .orElseThrow(() -> new ChatRoomNotFoundException(command.getRoomId()));
        
        User reader = userRepository.findById(command.getUserId())
            .orElseThrow(() -> new UserNotFoundException(command.getUserId()));
        
        chatRoom.markMessageAsRead(MessageId.of(command.getMessageId()), reader);
        
        chatRoomRepository.save(chatRoom);
        publishDomainEvents(chatRoom);
    }
    
    /**
     * 도메인 이벤트 발행
     */
    private void publishDomainEvents(ChatRoom chatRoom) {
        chatRoom.getDomainEvents().forEach(event -> {
            eventPublisher.publish(event);
        });
        chatRoom.clearDomainEvents();
    }
}
```

#### **이벤트 핸들러 (알림 연동)**

```java
// ============================================
// Event Handler (Application Layer)
// ============================================
package com.goodee.coreconnect.chat.application.eventhandler;

/**
 * 채팅 이벤트 핸들러
 * 
 * 채팅 이벤트를 구독하여 후속 작업 처리
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ChatEventHandler {
    
    private final EventPublisher eventPublisher;
    
    /**
     * 메시지 전송 이벤트 처리
     * → 알림 컨텍스트로 이벤트 전파
     */
    @EventListener
    @Async
    public void handleMessageSentEvent(MessageSentEvent event) {
        log.info("메시지 전송 이벤트 수신: messageId={}, roomId={}", 
            event.getMessageId(), event.getRoomId());
        
        // 알림 컨텍스트로 전파할 통합 이벤트 발행
        NotificationRequiredEvent notificationEvent = NotificationRequiredEvent.builder()
            .type(NotificationType.CHAT)
            .senderId(event.getSenderId())
            .recipientIds(event.getRecipientIds())
            .message("새로운 채팅 메시지: " + event.getContent())
            .referenceId(event.getMessageId().getValue())
            .referenceType("CHAT_MESSAGE")
            .build();
        
        eventPublisher.publish(notificationEvent);
    }
}
```

### 5.2 이메일 컨텍스트

```java
// ============================================
// Email Aggregate Root
// ============================================
package com.goodee.coreconnect.email.domain.model;

/**
 * 이메일 애그리게이트 루트
 */
@Getter
public class Email {
    private final EmailId id;
    private final EmailAddress senderAddress;
    private final List<Recipient> recipients;
    private final EmailSubject subject;
    private final EmailContent content;
    private EmailStatus status;
    private final List<Attachment> attachments;
    private ScheduledSend scheduledSend;  // 예약 발송
    
    // ========== 팩토리 메서드 ==========
    
    public static Email compose(
        EmailAddress sender,
        List<Recipient> recipients,
        EmailSubject subject,
        EmailContent content
    ) {
        Email email = new Email(
            EmailId.generate(),
            sender,
            recipients,
            subject,
            content,
            EmailStatus.DRAFT
        );
        
        email.validate();
        return email;
    }
    
    // ========== 비즈니스 로직 ==========
    
    /**
     * 즉시 발송
     */
    public void send() {
        validateCanSend();
        this.status = EmailStatus.SENDING;
        addDomainEvent(new EmailSendRequestedEvent(this.id, this.recipients));
    }
    
    /**
     * 예약 발송 설정
     */
    public void scheduleFor(LocalDateTime sendAt) {
        if (sendAt.isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("예약 시간은 현재 시간 이후여야 합니다.");
        }
        
        this.scheduledSend = ScheduledSend.of(sendAt);
        this.status = EmailStatus.SCHEDULED;
        
        addDomainEvent(new EmailScheduledEvent(this.id, sendAt));
    }
    
    /**
     * 발송 완료 처리
     */
    public void markAsSent() {
        if (this.status != EmailStatus.SENDING) {
            throw new IllegalStateException("발송 중인 이메일만 발송 완료 처리할 수 있습니다.");
        }
        
        this.status = EmailStatus.SENT;
        addDomainEvent(new EmailSentEvent(this.id, this.senderAddress, this.recipients));
    }
    
    /**
     * 발송 실패 처리
     */
    public void markAsFailed(String reason) {
        this.status = EmailStatus.FAILED;
        addDomainEvent(new EmailFailedEvent(this.id, reason));
    }
    
    /**
     * 첨부파일 추가
     */
    public void addAttachment(Attachment attachment) {
        validateAttachmentSize();
        this.attachments.add(attachment);
    }
    
    // ========== 검증 로직 ==========
    
    private void validate() {
        if (recipients.isEmpty()) {
            throw new IllegalArgumentException("수신자가 최소 1명 이상이어야 합니다.");
        }
        if (recipients.size() > 100) {
            throw new IllegalArgumentException("수신자는 최대 100명까지 가능합니다.");
        }
    }
    
    private void validateCanSend() {
        if (this.status == EmailStatus.SENT) {
            throw new IllegalStateException("이미 발송된 이메일입니다.");
        }
        if (this.status == EmailStatus.SENDING) {
            throw new IllegalStateException("발송 중인 이메일입니다.");
        }
    }
    
    private void validateAttachmentSize() {
        long totalSize = attachments.stream()
            .mapToLong(Attachment::getSize)
            .sum();
        
        if (totalSize > 25 * 1024 * 1024) {  // 25MB
            throw new IllegalArgumentException("첨부파일 전체 크기는 25MB를 초과할 수 없습니다.");
        }
    }
}

// ============================================
// Value Objects
// ============================================

@Value
public class EmailAddress {
    String value;
    
    public static EmailAddress of(String email) {
        if (!isValid(email)) {
            throw new IllegalArgumentException("유효하지 않은 이메일 주소입니다: " + email);
        }
        return new EmailAddress(email.toLowerCase());
    }
    
    private static boolean isValid(String email) {
        String emailRegex = "^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$";
        return email != null && email.matches(emailRegex);
    }
}

@Value
public class EmailSubject {
    String value;
    
    public static EmailSubject of(String subject) {
        if (subject == null || subject.trim().isEmpty()) {
            return new EmailSubject("(제목 없음)");
        }
        if (subject.length() > 200) {
            throw new IllegalArgumentException("제목은 최대 200자까지 가능합니다.");
        }
        return new EmailSubject(subject);
    }
}

@Value
public class ScheduledSend {
    LocalDateTime scheduledAt;
    
    public static ScheduledSend of(LocalDateTime scheduledAt) {
        return new ScheduledSend(scheduledAt);
    }
    
    public boolean isReadyToSend() {
        return LocalDateTime.now().isAfter(scheduledAt);
    }
}

public enum EmailStatus {
    DRAFT,      // 임시저장
    SCHEDULED,  // 예약
    SENDING,    // 발송 중
    SENT,       // 발송 완료
    FAILED,     // 발송 실패
    BOUNCED     // 반송
}
```

### 5.3 알림 컨텍스트

```java
// ============================================
// Notification Aggregate Root
// ============================================
package com.goodee.coreconnect.notification.domain.model;

/**
 * 알림 애그리게이트 루트
 */
@Getter
public class Notification {
    private final NotificationId id;
    private final UserId recipientId;
    private final NotificationType type;
    private final NotificationMessage message;
    private DeliveryStatus deliveryStatus;
    private ReadStatus readStatus;
    private final LocalDateTime createdAt;
    
    // ========== 팩토리 메서드 ==========
    
    public static Notification create(
        UserId recipientId,
        NotificationType type,
        NotificationMessage message
    ) {
        Notification notification = new Notification(
            NotificationId.generate(),
            recipientId,
            type,
            message,
            DeliveryStatus.PENDING,
            ReadStatus.UNREAD,
            LocalDateTime.now()
        );
        
        notification.addDomainEvent(new NotificationCreatedEvent(
            notification.id, 
            notification.recipientId,
            notification.type
        ));
        
        return notification;
    }
    
    // ========== 비즈니스 로직 ==========
    
    /**
     * 전송 완료 처리
     */
    public void markAsDelivered() {
        if (this.deliveryStatus == DeliveryStatus.DELIVERED) {
            return;  // 이미 전송됨
        }
        
        this.deliveryStatus = DeliveryStatus.DELIVERED;
        addDomainEvent(new NotificationDeliveredEvent(this.id, this.recipientId));
    }
    
    /**
     * 전송 실패 처리
     */
    public void markAsFailed(String reason) {
        this.deliveryStatus = DeliveryStatus.FAILED;
        addDomainEvent(new NotificationFailedEvent(this.id, reason));
    }
    
    /**
     * 읽음 처리
     */
    public void markAsRead() {
        if (this.readStatus == ReadStatus.READ) {
            return;  // 이미 읽음
        }
        
        this.readStatus = ReadStatus.READ;
        addDomainEvent(new NotificationReadEvent(this.id, this.recipientId));
    }
    
    /**
     * 재전송 가능 여부
     */
    public boolean canRetry() {
        return this.deliveryStatus == DeliveryStatus.FAILED;
    }
}

// ============================================
// Value Objects
// ============================================

@Value
public class NotificationMessage {
    String title;
    String body;
    Map<String, String> data;  // 추가 데이터
    
    public static NotificationMessage of(String title, String body) {
        return new NotificationMessage(title, body, new HashMap<>());
    }
    
    public NotificationMessage withData(String key, String value) {
        Map<String, String> newData = new HashMap<>(this.data);
        newData.put(key, value);
        return new NotificationMessage(this.title, this.body, newData);
    }
}

public enum DeliveryStatus {
    PENDING,    // 전송 대기
    DELIVERED,  // 전송 완료
    FAILED      // 전송 실패
}

public enum ReadStatus {
    UNREAD,  // 안읽음
    READ     // 읽음
}

public enum NotificationType {
    CHAT,       // 채팅
    EMAIL,      // 이메일
    NOTICE,     // 공지사항
    SCHEDULE,   // 일정
    APPROVAL    // 결재
}
```

#### **이벤트 구독자 (다른 컨텍스트 이벤트 수신)**

```java
// ============================================
// Event Subscriber (Application Layer)
// ============================================
package com.goodee.coreconnect.notification.application.eventhandler;

/**
 * 외부 컨텍스트 이벤트 구독자
 * 
 * 채팅/이메일 컨텍스트에서 발생한 이벤트를 구독하여
 * 알림 생성
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ExternalEventSubscriber {
    
    private final NotificationApplicationService notificationService;
    
    /**
     * 채팅 메시지 전송 이벤트 수신
     */
    @EventListener
    @Async
    public void onMessageSent(NotificationRequiredEvent event) {
        if (event.getType() != NotificationType.CHAT) {
            return;
        }
        
        log.info("채팅 알림 생성: {}", event);
        
        // 각 수신자에게 알림 생성
        event.getRecipientIds().forEach(recipientId -> {
            SendNotificationCommand command = SendNotificationCommand.builder()
                .recipientId(recipientId)
                .type(NotificationType.CHAT)
                .title("새로운 메시지")
                .message(event.getMessage())
                .referenceType("CHAT_MESSAGE")
                .referenceId(event.getReferenceId())
                .build();
            
            notificationService.send(command);
        });
    }
    
    /**
     * 이메일 발송 이벤트 수신
     */
    @EventListener
    @Async
    public void onEmailSent(NotificationRequiredEvent event) {
        if (event.getType() != NotificationType.EMAIL) {
            return;
        }
        
        log.info("이메일 알림 생성: {}", event);
        
        event.getRecipientIds().forEach(recipientId -> {
            SendNotificationCommand command = SendNotificationCommand.builder()
                .recipientId(recipientId)
                .type(NotificationType.EMAIL)
                .title("새로운 이메일")
                .message(event.getMessage())
                .referenceType("EMAIL")
                .referenceId(event.getReferenceId())
                .build();
            
            notificationService.send(command);
        });
    }
}
```

---

## 6. 마이크로서비스 확장 전략

### 6.1 단계적 전환 전략

```
Phase 1: 모놀리스 with DDD
┌─────────────────────────────────┐
│     Spring Boot Application     │
│                                 │
│  ┌───────┐ ┌───────┐ ┌───────┐ │
│  │ Chat  │ │ Email │ │ Notif │ │
│  │Context│ │Context│ │Context│ │
│  └───────┘ └───────┘ └───────┘ │
│       │         │         │     │
│       └─────────┴─────────┘     │
│              ▼                  │
│        Single Database          │
└─────────────────────────────────┘

Phase 2: 데이터베이스 분리
┌─────────────────────────────────┐
│     Spring Boot Application     │
│                                 │
│  ┌───────┐ ┌───────┐ ┌───────┐ │
│  │ Chat  │ │ Email │ │ Notif │ │
│  │Context│ │Context│ │Context│ │
│  └───┬───┘ └───┬───┘ └───┬───┘ │
└──────┼─────────┼─────────┼─────┘
       │         │         │
       ▼         ▼         ▼
   ┌─────┐   ┌─────┐   ┌─────┐
   │ DB1 │   │ DB2 │   │ DB3 │
   │Chat │   │Email│   │Notif│
   └─────┘   └─────┘   └─────┘

Phase 3: 마이크로서비스 분리
┌────────────┐  ┌────────────┐  ┌────────────┐
│   Chat     │  │   Email    │  │Notification│
│  Service   │  │  Service   │  │  Service   │
│            │  │            │  │            │
│ ┌────────┐ │  │ ┌────────┐ │  │ ┌────────┐ │
│ │Context │ │  │ │Context │ │  │ │Context │ │
│ └────────┘ │  │ └────────┘ │  │ └────────┘ │
└──────┬─────┘  └──────┬─────┘  └──────┬─────┘
       │               │               │
       ▼               ▼               ▼
   ┌─────┐         ┌─────┐         ┌─────┐
   │ DB1 │         │ DB2 │         │ DB3 │
   └─────┘         └─────┘         └─────┘
       │               │               │
       └───────────────┴───────────────┘
                       │
                   ┌───▼───┐
                   │Message│
                   │ Bus   │
                   │(Kafka)│
                   └───────┘
```

### 6.2 컨텍스트 간 통신

#### **모놀리스 단계 (Phase 1-2): 도메인 이벤트**

```java
// 같은 애플리케이션 내에서 Spring Event 사용
@Component
public class SpringEventPublisher implements EventPublisher {
    
    private final ApplicationEventPublisher publisher;
    
    @Override
    public void publish(DomainEvent event) {
        publisher.publishEvent(event);
    }
}
```

#### **마이크로서비스 단계 (Phase 3): 메시지 브로커**

```java
// Kafka를 사용한 이벤트 발행
@Component
public class KafkaEventPublisher implements EventPublisher {
    
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;
    
    @Override
    public void publish(DomainEvent event) {
        try {
            String topic = event.getEventType();
            String message = objectMapper.writeValueAsString(event);
            
            kafkaTemplate.send(topic, message);
            log.info("이벤트 발행 완료: topic={}, event={}", topic, event);
        } catch (Exception e) {
            log.error("이벤트 발행 실패", e);
            throw new EventPublishException(e);
        }
    }
}

// Kafka 이벤트 구독
@Component
public class KafkaEventSubscriber {
    
    @KafkaListener(topics = "chat.message.sent")
    public void onMessageSent(String message) {
        MessageSentEvent event = objectMapper.readValue(message, MessageSentEvent.class);
        // 알림 생성 로직
    }
}
```

### 6.3 데이터 일관성 전략

#### **Saga 패턴**

```java
// Choreography Saga (이벤트 기반)
// 
// 시나리오: 이메일 발송 → 알림 생성
//
// 1. Email Service: 이메일 발송
@Transactional
public void sendEmail(SendEmailCommand command) {
    Email email = Email.compose(...);
    email.send();
    emailRepository.save(email);
    
    // 이벤트 발행
    eventPublisher.publish(new EmailSentEvent(email.getId(), ...));
}

// 2. Notification Service: 이벤트 수신 후 알림 생성
@KafkaListener(topics = "email.sent")
@Transactional
public void onEmailSent(EmailSentEvent event) {
    // 보상 트랜잭션 준비
    try {
        Notification notification = Notification.create(...);
        notificationRepository.save(notification);
        
        // 성공 이벤트 발행
        eventPublisher.publish(new NotificationCreatedEvent(...));
    } catch (Exception e) {
        // 실패 시 보상 이벤트 발행
        eventPublisher.publish(new NotificationCreationFailedEvent(...));
    }
}

// 3. Email Service: 보상 처리
@KafkaListener(topics = "notification.creation.failed")
@Transactional
public void onNotificationFailed(NotificationCreationFailedEvent event) {
    // 보상 로직: 이메일 상태 변경 등
    Email email = emailRepository.findById(event.getEmailId())
        .orElseThrow();
    email.markNotificationFailed();
    emailRepository.save(email);
}
```

### 6.4 API Gateway 패턴

```yaml
# API Gateway (Spring Cloud Gateway)
spring:
  cloud:
    gateway:
      routes:
        # 채팅 서비스
        - id: chat-service
          uri: lb://CHAT-SERVICE
          predicates:
            - Path=/api/chat/**
          filters:
            - StripPrefix=2
            
        # 이메일 서비스
        - id: email-service
          uri: lb://EMAIL-SERVICE
          predicates:
            - Path=/api/email/**
          filters:
            - StripPrefix=2
            
        # 알림 서비스
        - id: notification-service
          uri: lb://NOTIFICATION-SERVICE
          predicates:
            - Path=/api/notifications/**
          filters:
            - StripPrefix=2
```

### 6.5 서비스 디스커버리

```yaml
# Eureka Server 설정
eureka:
  server:
    enable-self-preservation: false

# 각 마이크로서비스 설정
eureka:
  client:
    serviceUrl:
      defaultZone: http://localhost:8761/eureka/
  instance:
    preferIpAddress: true

spring:
  application:
    name: chat-service  # 또는 email-service, notification-service
```

---

## 7. 마이그레이션 로드맵

### 7.1 Phase 1: DDD 적용 (모놀리스 유지) - 4주

#### Week 1-2: 도메인 모델링
- [x] 바운디드 컨텍스트 정의
- [x] 유비쿼터스 언어 정의
- [ ] 애그리게이트 식별
- [ ] 도메인 이벤트 설계

#### Week 3-4: 코드 리팩토링
- [ ] 패키지 구조 변경
- [ ] 엔티티 → 애그리게이트 전환
- [ ] Service → Application Service + Domain Service 분리
- [ ] 도메인 이벤트 구현

**마일스톤:** DDD 패턴 적용 완료, 기존 기능 유지

### 7.2 Phase 2: 데이터베이스 분리 - 3주

#### Week 5-6: 스키마 분리
- [ ] 채팅/이메일/알림 스키마 분리
- [ ] 데이터 마이그레이션 스크립트 작성
- [ ] 외래키 제거 및 논리적 참조로 변경

#### Week 7: 통합 테스트
- [ ] 컨텍스트 간 데이터 일관성 검증
- [ ] 성능 테스트

**마일스톤:** 논리적으로 분리된 데이터베이스

### 7.3 Phase 3: 마이크로서비스 분리 - 8주

#### Week 8-9: 인프라 구축
- [ ] Kafka 설정
- [ ] Service Discovery (Eureka) 설정
- [ ] API Gateway 설정

#### Week 10-12: 서비스 분리
- [ ] 채팅 서비스 분리
- [ ] 이메일 서비스 분리
- [ ] 알림 서비스 분리

#### Week 13-14: 이벤트 기반 통신
- [ ] Saga 패턴 구현
- [ ] 보상 트랜잭션 구현
- [ ] 이벤트 재시도 메커니즘

#### Week 15: 통합 테스트 및 배포
- [ ] E2E 테스트
- [ ] 부하 테스트
- [ ] 카나리 배포

**마일스톤:** 완전한 마이크로서비스 아키텍처

---

## 8. 예상 효과

### 8.1 DDD 적용 효과

✅ **비즈니스 로직 명확화**
- 도메인 전문가와 소통 용이
- 비즈니스 규칙이 코드로 명확히 표현

✅ **유지보수성 향상**
- 변경 영향 범위 최소화
- 테스트 용이성 증가

✅ **확장성 증가**
- 마이크로서비스로 자연스러운 전환
- 새로운 기능 추가 시 기존 코드 영향 최소화

### 8.2 마이크로서비스 확장 효과

✅ **독립 배포**
- 채팅 기능 변경 시 이메일 서비스 영향 없음
- 배포 주기 단축

✅ **기술 다양성**
- 서비스별 최적 기술 스택 선택 가능
- 예: 채팅은 WebSocket, 이메일은 배치 처리

✅ **확장성**
- 트래픽이 많은 서비스만 스케일 아웃
- 리소스 효율적 사용

✅ **장애 격리**
- 이메일 서비스 장애 시 채팅 서비스는 정상 작동

---

## 9. 주의사항 및 Best Practices

### 9.1 DDD 적용 시 주의사항

⚠️ **과도한 설계 지양**
- 모든 엔티티를 애그리게이트로 만들 필요 없음
- 비즈니스 가치가 있는 곳에 집중

⚠️ **애그리게이트 크기**
- 애그리게이트는 작게 유지
- 트랜잭션 경계를 명확히

⚠️ **도메인 이벤트 남발 지양**
- 정말 중요한 비즈니스 이벤트만 발행
- 이벤트 스톰 방지

### 9.2 마이크로서비스 전환 시 주의사항

⚠️ **성급한 분리 금지**
- 모놀리스로 충분히 검증 후 분리
- "분산 모놀리스" 안티패턴 주의

⚠️ **데이터 일관성**
- Eventual Consistency 수용
- 보상 트랜잭션 필수

⚠️ **운영 복잡도 증가**
- 모니터링, 로깅, 추적 시스템 필수
- DevOps 역량 필요

---

## 10. 참고 자료

### 책
- Eric Evans, "Domain-Driven Design" (DDD의 바이블)
- Vaughn Vernon, "Implementing Domain-Driven Design" (실전 DDD)
- Chris Richardson, "Microservices Patterns" (마이크로서비스 패턴)

### 온라인 자료
- Martin Fowler's Blog: https://martinfowler.com/
- DDD Community: https://www.domainlanguage.com/
- Microservices.io: https://microservices.io/

---

## 다음 단계

1. **도메인 전문가와 미팅**: 유비쿼터스 언어 정의
2. **이벤트 스토밍 워크샵**: 도메인 이벤트 및 애그리게이트 식별
3. **PoC 진행**: 하나의 컨텍스트(채팅)만 DDD로 리팩토링하여 효과 검증
4. **점진적 확장**: 검증 후 나머지 컨텍스트 적용

---

**작성일**: 2026-01-12  
**작성자**: CoreConnect 개발팀  
**버전**: 1.0
