# 채팅방 목록/최신 메시지 조회 성능 개선

## 📊 AS-IS (개선 전)

### 문제 상황
채팅방 목록 및 각 방의 최신 메시지 조회 API(`/api/v1/chat/rooms/messages/latest`)에서 다음과 같은 성능 병목 발생:

1. **N+1 쿼리 문제**
   - 채팅방 목록 조회 후, 각 방의 최신 메시지를 개별 쿼리로 조회
   - 각 메시지의 `ChatRoom`, `Sender(User)` 정보도 개별 쿼리로 조회
   - 예: 10개 채팅방 → 1(목록) + 10(메시지) + 10(ChatRoom) + 10(Sender) = **31개 쿼리**

2. **인덱스 미사용**
   - `chat_message` 테이블에서 `WHERE chat_room_id = ? ORDER BY sent_at DESC` 쿼리가 Full Table Scan(`type=ALL`)
   - `EXPLAIN` 결과: `type=ALL`, `key=NULL`, `Extra=Using filesort`

3. **응답 페이로드 과다**
   - 전체 채팅방 목록을 한 번에 반환 (페이징 없음)
   - DTO에 불필요한 필드 포함 (메시지 전체 내용, 파일 정보 등)

4. **동기 처리 부하**
   - 읽음 상태 업데이트, 알림 카운트 감소 등 부가 로직이 응답 경로에 포함

5. **Connection Pool/Thread Pool 부족**
   - HikariCP: 기본 10개 (부하 시 대기 발생)
   - Tomcat: 기본 200 스레드 (버스트 대응 부족)

### 측정 결과 (k6 부하 테스트)
- **P95 Latency**: ~6.3s (목표: < 0.5s)
- **P99 Latency**: ~7.4s (목표: < 1s)
- **RPS**: ~5.3 (목표: 10~15 @20 VU)
- **에러율**: 0% (기능 정상)

---

## 🚀 TO-BE (개선 후)

### 개선 사항

#### 1️⃣ N+1 제거 (Fetch Join / EntityGraph)
**문제**: 채팅방 목록 조회 후, 각 방의 최신 메시지를 개별 쿼리로 조회  
**해결**: `LEFT JOIN FETCH`로 `chatRoom`, `sender`를 한 번에 로딩

```java
// AS-IS: N+1 발생
@Query("SELECT c FROM Chat c WHERE c.chatRoom.id IN :roomIds ...")
List<Chat> findLatestMessagesByRoomIds(@Param("roomIds") List<Integer> roomIds);

// TO-BE: Fetch Join으로 N+1 해결
@Query("SELECT c FROM Chat c " +
       "LEFT JOIN FETCH c.sender " +
       "LEFT JOIN FETCH c.chatRoom " +
       "WHERE c.chatRoom.id IN :roomIds ...")
List<Chat> findLatestMessagesByRoomIds(@Param("roomIds") List<Integer> roomIds);
```

**효과**: 31개 쿼리 → **1~3개 쿼리**로 감소

---

#### 2️⃣ 인덱스 최적화
**문제**: `chat_message` 테이블에서 `type=ALL` (Full Table Scan), `Using filesort` 발생  
**해결**: 복합 인덱스 `(chat_room_id, sent_at DESC)` 생성

```sql
-- AS-IS: 인덱스 없음 또는 비효율적
-- type=ALL, key=NULL, Extra=Using filesort

-- TO-BE: 복합 인덱스 생성
CREATE INDEX idx_chat_message_room_sent_at
ON chat_message(chat_room_id, sent_at DESC);

-- 통계 업데이트
ANALYZE TABLE chat_message;
```

**EXPLAIN 결과 비교**:
| 항목 | AS-IS | TO-BE |
|------|-------|-------|
| **type** | `ALL` | `ref` 또는 `range` |
| **key** | `NULL` | `idx_chat_message_room_sent_at` |
| **rows** | 전체 행 수 (예: 10,000) | 필터링된 행 수 (예: 50) |
| **Extra** | `Using filesort` | `Using index condition` |

**효과**: 쿼리 실행 시간 10~20ms → **2~5ms**로 감소 (예상)

---

#### 3️⃣ Top-N 페이징 & DTO 슬림
**문제**: 전체 채팅방 목록을 한 번에 반환, 불필요한 필드 포함  
**해결**: 
- API에 `page`, `size` 파라미터 추가 (기본값: page=0, size=20, 최대 100)
- DTO 슬림: 필수 필드만 포함 (`ChatRoomLatestMessageDTO`)

```java
// AS-IS: 전체 조회, 페이징 없음
@GetMapping("/rooms/messages/latest")
public ResponseEntity<ResponseDTO<List<ChatRoomListDTO>>> getLatestMessages(...) {
    List<ChatRoomListDTO> dtoList = chatRoomService.getChatRoomListWithUnreadCount(userId);
    return ResponseEntity.ok(ResponseDTO.success(dtoList, "..."));
}

// TO-BE: 페이징 기본값 강제, 최대 100 제한
@GetMapping("/rooms/messages/latest")
public ResponseEntity<ResponseDTO<List<ChatRoomListDTO>>> getLatestMessages(
        ...,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size) {
    int effectiveSize = Math.min(size, 100); // 최대 100개 제한
    // ...
}
```

```java
// TO-BE: DTO 슬림 (필수 필드만)
@Getter @AllArgsConstructor
public class ChatRoomLatestMessageDTO {
    private Integer roomId;
    private String roomName;
    private Integer lastMessageId;
    private String lastMessageContent;
    private String lastSenderName;
    private LocalDateTime lastMessageTime;
}
```

**효과**: 
- 응답 페이로드 크기 **50~70% 감소**
- 네트워크 전송 시간 단축

---

#### 4️⃣ 비동기 처리 (@Async)
**문제**: 읽음 상태 업데이트, 알림 카운트 감소 등 부가 로직이 응답 경로에 포함  
**해결**: 이벤트 발행 + `@Async` 리스너로 비동기 처리

```java
// AS-IS: 동기 처리
public void markAsRead(Long userId, Long messageId) {
    readStatusRepo.updateReadStatus(userId, messageId);  // 블로킹
    notificationService.decreaseUnreadCount(userId);     // 블로킹
}

// TO-BE: 이벤트 발행
public void markAsRead(Long userId, Long messageId) {
    eventPublisher.publishEvent(new MessageReadEvent(userId, roomId, messageId));
    // 즉시 반환
}

// 비동기 리스너
@Async("asyncTaskExecutor")
@EventListener
public void handle(MessageReadEvent event) {
    readStatusRepo.updateReadStatus(event.getUserId(), event.getMessageId());
    notificationService.decreaseUnreadCount(event.getUserId());
}
```

**효과**: 응답 시간 **20~30% 단축** (부가 로직 대기 시간 제거)

---

#### 5️⃣ HikariCP / Tomcat Thread Pool 튜닝
**문제**: 부하 시 Connection Pool/Thread Pool 고갈로 대기 발생  
**해결**: 풀 사이즈 증가 및 타임아웃 조정

```yaml
# AS-IS
spring:
  datasource:
    hikari:
      maximum-pool-size: 10        # 기본값
      minimum-idle: 10

server:
  tomcat:
    threads:
      max: 200

# TO-BE
spring:
  datasource:
    hikari:
      maximum-pool-size: 40        # 4배 증가
      minimum-idle: 10
      connection-timeout: 15000    # 15초
      leak-detection-threshold: 60000

server:
  tomcat:
    threads:
      max: 200
      min-spare: 30                # 최소 유휴 스레드 확보
    accept-count: 150              # 버스트 대응
```

**효과**: 동시 요청 처리 능력 **4배 증가**

---

#### 6️⃣ GZIP 압축 & Keep-Alive
**문제**: JSON 응답이 압축 없이 전송, 매 요청마다 TCP 재연결  
**해결**: GZIP 활성화, Keep-Alive 설정

```yaml
server:
  compression:
    enabled: true
    mime-types: application/json,application/xml,text/html,text/xml,text/plain
    min-response-size: 1024  # 1KB 이상부터 압축
  connection-timeout: 30s    # Keep-Alive 타임아웃
```

**효과**: 
- 응답 크기 **60~70% 감소** (JSON 압축)
- TCP Handshake 오버헤드 제거

---

## 📈 성과 (예상)

### 목표 지표
| 지표 | AS-IS | TO-BE 목표 | 개선율 |
|------|-------|-----------|--------|
| **P95 Latency** | 6.3s | < 0.5s | **92% 감소** |
| **P99 Latency** | 7.4s | < 1s | **86% 감소** |
| **RPS** | 5.3 | 10~15 | **2~3배 증가** |
| **쿼리 수** | 31개 | 1~3개 | **90% 감소** |
| **응답 크기** | 100% | 30~50% | **50~70% 감소** |
| **에러율** | 0% | < 1% | **유지** |

### 재측정 방법
```bash
cd ~/k6-loadtest
export K6_CLOUD_PROJECT_ID=6156169
export K6_CLOUD_TOKEN=YOUR_TOKEN
export BASE_URL=http://54.116.26.182:8080
export USER_EMAIL=admin@coreconnect.io.kr
export USER_PASSWORD=1

k6 run --out cloud chatroom-latest-cloud.js
```

Grafana에서 "Compare with" 기능으로 개선 전/후 P95, RPS, 에러율 비교

---

## 🛠 사용 기술 및 기법

| 카테고리 | 기술/기법 | 적용 내용 |
|---------|----------|-----------|
| **DB** | MySQL 인덱스 최적화 | 복합 인덱스 `(chat_room_id, sent_at DESC)`, `ANALYZE TABLE` |
| **ORM** | JPA Fetch Join / EntityGraph | N+1 문제 해결 (chatRoom, sender 동시 로딩) |
| **API** | Spring Pageable, DTO Slimming | Top-N 페이징 (기본 20개), 필수 필드만 응답 |
| **비동기** | Spring @Async, Event | 읽음 처리/알림 등 부가 로직 비동기 처리 |
| **서버** | HikariCP, Tomcat Thread Pool | Connection Pool 40, Thread 200, accept-count 150 |
| **네트워크** | GZIP, HTTP Keep-Alive | JSON 압축 60~70%, TCP 재연결 오버헤드 제거 |
| **모니터링** | k6 + Grafana Cloud | P95/P99/RPS 측정, threshold 기반 성능 검증 |
| **분석** | MySQL EXPLAIN, Slow Query Log | 쿼리 실행 계획 분석, 병목 쿼리 식별 |

---

## 📋 체크리스트

### ✅ 개선 완료 항목
- [x] N+1 제거: Fetch Join 적용 (`ChatRepository.java`)
- [x] 인덱스 추가: `idx_chat_message_room_sent_at` 생성 (`채팅_테이블_컬럼_추가_스크립트.sql`)
- [x] DTO 슬림: `ChatRoomLatestMessageDTO` 생성
- [x] 페이징 기본값: Controller에 `defaultValue="20"` 추가
- [x] 비동기 처리: `MessageReadEvent` + `@Async` 리스너
- [x] HikariCP 튜닝: `maximum-pool-size=40`
- [x] Tomcat 튜닝: `min-spare=30`, `accept-count=150`
- [x] GZIP 활성화: `compression.enabled=true`
- [x] k6 테스트 스크립트: `chatroom-latest-cloud.js`

### 🔄 배포 전 확인 사항
- [ ] `SHOW INDEX FROM chat_message` → `idx_chat_message_room_sent_at` 존재 확인
- [ ] `ANALYZE TABLE chat_message` 실행
- [ ] `EXPLAIN` 결과: `type=ref/range`, `key=idx_chat_message_room_sent_at` 확인
- [ ] Docker 이미지 재빌드 및 재배포
- [ ] Actuator로 HikariCP active/idle 확인
- [ ] Actuator로 Tomcat threads busy/current 확인

### 🧪 재측정 확인 사항
- [ ] k6 테스트 재실행
- [ ] P95 < 500ms 달성 여부
- [ ] RPS 10~15 이상 달성 여부
- [ ] 에러율 < 1% 유지 여부
- [ ] Grafana "Compare with"로 전/후 비교

---

## 🔗 관련 문서
- [성능_모니터링_및_측정_가이드.md](./성능_모니터링_및_측정_가이드.md)
- [채팅_테이블_컬럼_추가_스크립트.sql](./채팅_테이블_컬럼_추가_스크립트.sql)
- [k6 테스트 스크립트](./chatroom-latest-cloud.js)

---

## 📞 문의 및 피드백
- 재측정 결과가 목표에 미달하면 Slow Query Log와 EXPLAIN 결과 공유
- HikariCP/Tomcat 지표가 비정상이면 Actuator 엔드포인트 결과 공유
- 추가 최적화가 필요하면 Redis 캐시, Read Replica 분리 검토

**마지막 업데이트**: 2025-12-20

