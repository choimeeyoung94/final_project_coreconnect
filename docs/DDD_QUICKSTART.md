# 🚀 DDD & 마이크로서비스 빠른 시작 가이드

## 📚 문서 구성

이 프로젝트는 **채팅, 알림, 이메일 시스템**에 DDD 아키텍처를 적용하고, 마이크로서비스로 확장하기 위한 완전한 가이드를 제공합니다.

### 📖 관련 문서

1. **[DDD_ARCHITECTURE_DESIGN.md](./DDD_ARCHITECTURE_DESIGN.md)** - 전체 설계 문서
   - DDD 개념 및 원칙
   - 바운디드 컨텍스트 정의
   - 도메인 모델 설계
   - 마이크로서비스 확장 전략

2. **[DDD_IMPLEMENTATION_EXAMPLE.md](./DDD_IMPLEMENTATION_EXAMPLE.md)** - 구현 예시
   - 실제 코드 예시
   - Before/After 비교
   - 테스트 예시

3. **[MICROSERVICES_MIGRATION_GUIDE.md](./MICROSERVICES_MIGRATION_GUIDE.md)** - 마이크로서비스 전환 가이드
   - 인프라 구축 (Kafka, Eureka, API Gateway)
   - 서비스 분리 방법
   - 배포 전략

---

## 🎯 핵심 개념 5분 요약

### DDD란?

```
전통적 아키텍처 (Anemic Domain Model):
─────────────────────────────────────
Controller → Service (모든 로직) → Repository → DB
              ↑
         모든 비즈니스 로직이 여기 집중됨
         (God Object 안티패턴)

DDD 아키텍처 (Rich Domain Model):
─────────────────────────────────────
Controller → Application Service → Domain Model → Repository → DB
                                        ↑
                                   비즈니스 로직
                                   (ChatRoom.sendMessage())
```

### 주요 패턴

| 패턴 | 설명 | 예시 |
|-----|------|------|
| **Entity** | 고유 식별자를 가진 객체 | `ChatRoom`, `ChatMessage` |
| **Value Object** | 불변 객체, 값으로만 식별 | `MessageContent`, `RoomName` |
| **Aggregate** | 일관성 경계, 트랜잭션 단위 | `ChatRoom` (루트) + `ChatMessage` |
| **Domain Service** | 엔티티에 속하지 않는 로직 | `MessageDeliveryService` |
| **Domain Event** | 도메인에서 발생한 중요한 사건 | `MessageSentEvent` |

### 바운디드 컨텍스트

```
┌─────────────┐  이벤트   ┌─────────────┐
│  채팅       │ ─────────> │  알림        │
│  Context    │            │  Context    │
└─────────────┘            └─────────────┘
      ↓                            ↑
   [공유 커널: User]                │
      ↓                            │
┌─────────────┐     이벤트          │
│  이메일      │ ────────────────────┘
│  Context    │
└─────────────┘
```

---

## 🚀 3단계 적용 계획

### Phase 1: DDD 적용 (4주) - 모놀리스 유지

**목표**: 비즈니스 로직을 도메인 계층으로 이동

```java
// Before: Service에 모든 로직
@Service
public class ChatService {
    public void sendMessage(Integer roomId, Integer senderId, String content) {
        // 검증
        if (content == null || content.isEmpty()) {
            throw new IllegalArgumentException("빈 메시지");
        }
        if (content.length() > 5000) {
            throw new IllegalArgumentException("너무 긴 메시지");
        }
        
        // 저장
        Chat chat = new Chat();
        chat.setRoomId(roomId);
        chat.setSenderId(senderId);
        chat.setContent(content);
        chatRepository.save(chat);
        
        // 알림
        notificationService.send(...);
    }
}

// After: 도메인 모델에 로직
@Getter
public class ChatRoom extends AggregateRoot {
    public ChatMessage sendMessage(User sender, MessageContent content) {
        // 1. 도메인 규칙 검증
        validateCanSendMessage(sender);
        
        // 2. 메시지 생성
        ChatMessage message = ChatMessage.create(sender, content);
        this.messages.add(message);
        
        // 3. 도메인 이벤트 발행
        addDomainEvent(new MessageSentEvent(...));
        
        return message;
    }
}
```

**체크리스트**:
- [ ] `MessageContent`, `RoomName` 등 Value Object 생성
- [ ] `ChatRoom.sendMessage()` 등 비즈니스 로직을 도메인으로 이동
- [ ] `MessageSentEvent` 등 도메인 이벤트 구현
- [ ] Application Service에서 도메인 호출
- [ ] 단위 테스트 작성

### Phase 2: 데이터베이스 분리 (3주)

**목표**: 논리적 분리 (물리적으로는 같은 DB 서버)

```sql
-- Before: 하나의 DB
CREATE DATABASE coreconnect_db;

-- After: 논리적으로 분리된 스키마
CREATE DATABASE chat_db;
CREATE DATABASE email_db;
CREATE DATABASE notification_db;
```

**체크리스트**:
- [ ] 스키마 분리
- [ ] 외래키 제거 (채팅 → 사용자)
- [ ] 논리적 참조로 변경 (userId만 저장)
- [ ] 데이터 마이그레이션

### Phase 3: 마이크로서비스 분리 (6-8주)

**목표**: 독립 배포 가능한 서비스

```
Before:
┌────────────────────┐
│  Monolith          │
│  ├─ Chat           │
│  ├─ Email          │
│  └─ Notification   │
└────────────────────┘

After:
┌──────────┐  ┌──────────┐  ┌──────────┐
│  Chat    │  │  Email   │  │  Notif   │
│  Service │  │  Service │  │  Service │
└──────────┘  └──────────┘  └──────────┘
     │              │              │
     └──────────────┴──────────────┘
                    │
              ┌─────▼─────┐
              │   Kafka   │
              └───────────┘
```

**체크리스트**:
- [ ] Kafka 설치 및 설정
- [ ] Eureka Server 구축
- [ ] API Gateway 구축
- [ ] 서비스별로 분리 (알림 → 이메일 → 채팅)
- [ ] 이벤트 기반 통신 구현

---

## 💻 즉시 적용 가능한 코드

### 1. Value Object 생성

```java
// backend/src/main/java/com/goodee/coreconnect/chat/domain/vo/MessageContent.java
package com.goodee.coreconnect.chat.domain.vo;

import lombok.Value;

@Value
public class MessageContent {
    public static final int MAX_LENGTH = 5000;
    String value;
    
    public static MessageContent of(String value) {
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException("메시지는 비어있을 수 없습니다.");
        }
        if (value.length() > MAX_LENGTH) {
            throw new IllegalArgumentException("메시지는 최대 " + MAX_LENGTH + "자까지 가능합니다.");
        }
        return new MessageContent(value);
    }
}
```

**적용 방법**:
1. 위 파일 생성
2. 기존 `ChatService`에서 사용:
```java
@Service
public class ChatService {
    public void sendMessage(Integer roomId, Integer senderId, String content) {
        // Before: if (content == null || content.isEmpty()) { ... }
        // After:
        MessageContent messageContent = MessageContent.of(content);  // 검증 자동!
        
        // ... 나머지 로직
    }
}
```

### 2. 도메인 이벤트 인프라

```java
// backend/src/main/java/com/goodee/coreconnect/shared/domain/event/DomainEvent.java
package com.goodee.coreconnect.shared.domain.event;

import java.time.LocalDateTime;

public interface DomainEvent {
    LocalDateTime getOccurredAt();
    String getEventType();
}
```

```java
// backend/src/main/java/com/goodee/coreconnect/shared/infrastructure/event/EventPublisher.java
package com.goodee.coreconnect.shared.infrastructure.event;

import com.goodee.coreconnect.shared.domain.event.DomainEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SpringEventPublisher {
    private final ApplicationEventPublisher publisher;
    
    public void publish(DomainEvent event) {
        publisher.publishEvent(event);
    }
}
```

**적용 방법**:
1. 위 파일들 생성
2. 이벤트 정의:
```java
@Getter
@RequiredArgsConstructor
public class MessageSentEvent implements DomainEvent {
    private final Integer messageId;
    private final Integer roomId;
    private final LocalDateTime occurredAt = LocalDateTime.now();
    
    @Override
    public String getEventType() {
        return "chat.message.sent";
    }
}
```

3. 이벤트 발행:
```java
@Service
public class ChatService {
    private final SpringEventPublisher eventPublisher;
    
    public void sendMessage(...) {
        // 메시지 저장
        Chat saved = chatRepository.save(chat);
        
        // 이벤트 발행
        eventPublisher.publish(new MessageSentEvent(saved.getId(), roomId));
    }
}
```

4. 이벤트 구독 (알림 서비스):
```java
@Component
public class ChatEventHandler {
    @EventListener
    public void onMessageSent(MessageSentEvent event) {
        // 알림 생성
        notificationService.create(...);
    }
}
```

---

## 🎓 학습 로드맵

### Week 1-2: DDD 개념 학습
- [ ] DDD 개념 이해 (Aggregate, Entity, Value Object)
- [ ] 바운디드 컨텍스트 정의
- [ ] 유비쿼터스 언어 정의

### Week 3-4: 코드 리팩토링
- [ ] Value Object 적용
- [ ] 도메인 이벤트 구현
- [ ] Application Service 분리

### Week 5-6: 데이터베이스 분리
- [ ] 스키마 분리
- [ ] 외래키 제거

### Week 7-10: 마이크로서비스 전환
- [ ] Kafka 구축
- [ ] 서비스 분리
- [ ] 배포 자동화

---

## 📊 예상 효과

### 코드 품질
- ✅ **비즈니스 로직 집중화**: 도메인 모델에 집중
- ✅ **테스트 용이성 증가**: 순수 Java 객체 테스트
- ✅ **유지보수성 향상**: 변경 영향 범위 최소화

### 확장성
- ✅ **독립 배포**: 서비스별 독립 배포 가능
- ✅ **기술 다양성**: 서비스별 최적 기술 선택
- ✅ **확장 용이**: 트래픽 많은 서비스만 스케일 아웃

### 성능
- ✅ **장애 격리**: 이메일 서비스 장애 → 채팅 서비스는 정상 작동
- ✅ **리소스 효율**: 서비스별 최적화된 리소스 할당

---

## 🤔 FAQ

### Q1: 꼭 마이크로서비스로 전환해야 하나요?
**A**: 아닙니다. DDD는 모놀리스에도 적용 가능하며, 오히려 모놀리스에서 충분히 검증 후 마이크로서비스로 전환하는 것이 안전합니다.

### Q2: 언제 마이크로서비스로 전환해야 하나요?
**A**: 다음과 같은 징후가 보일 때:
- 배포 주기가 너무 길어짐 (2주 이상)
- 팀이 여러 개로 나뉘어짐
- 특정 기능만 스케일 아웃이 필요함
- 기능별로 다른 기술 스택이 필요함

### Q3: 현재 프로젝트에 적용하기 어렵지 않나요?
**A**: 단계적으로 적용하면 됩니다:
1. 먼저 Value Object만 적용
2. 다음으로 도메인 이벤트
3. 마지막으로 전체 리팩토링

### Q4: 성능이 느려지지 않나요?
**A**: 
- **DDD 적용**: 성능 영향 거의 없음 (오히려 최적화 가능)
- **마이크로서비스 전환**: 네트워크 오버헤드 발생 가능, but 캐싱/비동기 처리로 해결

---

## 🔗 참고 자료

### 책
- **Domain-Driven Design** by Eric Evans
- **Implementing Domain-Driven Design** by Vaughn Vernon
- **Microservices Patterns** by Chris Richardson

### 온라인
- [Martin Fowler's Blog](https://martinfowler.com/)
- [DDD Community](https://www.domainlanguage.com/)
- [Microservices.io](https://microservices.io/)

---

## 💡 다음 단계

### 즉시 시작
1. `MessageContent`, `RoomName` Value Object 생성
2. 도메인 이벤트 인프라 구축
3. 채팅 도메인 리팩토링 시작

### 궁금한 점
- DDD 패턴 적용 방법
- 마이크로서비스 전환 시점
- 인프라 구축 방법

**문의**: 위 문서들을 참고하거나, 구체적인 질문을 주시면 답변드리겠습니다!

---

**작성일**: 2026-01-12  
**버전**: 1.0
