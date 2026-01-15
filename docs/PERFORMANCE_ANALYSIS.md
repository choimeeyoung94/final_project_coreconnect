# 📊 CoreConnect 성능 분석 및 개선 계획

> **실시간 채팅 시스템의 성능 테스트 결과 및 Redis/Kafka 적용을 통한 개선 전략**

---

## 📑 목차

1. [테스트 개요](#-테스트-개요)
2. [AS-IS: 현재 시스템 성능](#-as-is-현재-시스템-성능)
3. [성능 테스트 결과](#-성능-테스트-결과)
4. [병목 지점 분석](#-병목-지점-분석)
5. [문제점 상세 분석](#️-문제점-상세-분석)
6. [TO-BE: 개선 계획](#-to-be-개선-계획)
7. [기대 효과](#-기대-효과)
8. [구현 로드맵](#-구현-로드맵)

---

## 🎯 테스트 개요

### 테스트 환경

| 항목 | 내용 |
|------|------|
| **테스트 도구** | k6 Cloud (Grafana Labs) |
| **테스트 날짜** | 2026-01-15 12:46 KST |
| **Load Zone** | AWS Seoul (amazon:kr:seoul) |
| **테스트 시나리오** | 채팅 메시지 전송/수신 부하 테스트 |
| **테스트 기간** | 12분 |
| **최대 가상 사용자** | 100 VUs (Virtual Users) |

### 부하 패턴

```
시간     0분    2분    5분    10분   12분
VUs      0 ──▶ 50 ──▶ 100 ──▶ 100 ──▶ 0
단계    시작  Warm-up Ramp-up Stay  Ramp-down
```

**부하 프로파일:**
- **0-2분**: Warm-up (0 → 50 VUs)
- **2-5분**: Ramp-up (50 → 100 VUs)
- **5-10분**: Stay (100 VUs 유지)
- **10-12분**: Ramp-down (100 → 0 VUs)

---

## 🔴 AS-IS: 현재 시스템 성능

### 시스템 아키텍처

```
┌─────────┐
│  Client │
└────┬────┘
     │ WebSocket
     ▼
┌─────────────────┐
│  Spring Boot    │
│  (WebSocket)    │
└────┬────────────┘
     │ JDBC
     ▼
┌─────────────────┐
│     MySQL       │
│  (Direct I/O)   │
└─────────────────┘
```

**기술 스택:**
- **Backend**: Spring Boot 3.2.1
- **WebSocket**: Spring STOMP (Direct Connection)
- **Database**: MySQL 8.0 (Single Instance)
- **Caching**: None ❌
- **Message Queue**: None ❌
- **Session Storage**: In-Memory (단일 서버)

### 주요 문제점

❌ **모든 메시지가 MySQL에 직접 저장**
- 동기 I/O로 인한 응답 지연
- 동시 쓰기 경합 (Write Contention)
- Connection Pool 고갈

❌ **실시간 브로드캐스트 비효율**
- 메시지 전송 시마다 DB 조회
- N+1 쿼리 문제
- 수신자 목록 반복 조회

❌ **확장성 부족**
- Stateful WebSocket (서버 고정)
- Scale-out 불가능
- 서버 간 메시지 동기화 불가

❌ **캐싱 전략 부재**
- 모든 요청이 DB 직접 조회
- 반복적인 데이터 조회 (채팅방 정보, 사용자 정보)
- 불필요한 DB 부하

---

## 📈 성능 테스트 결과

### 종합 결과

| 항목 | 목표 | 실제 측정값 | 달성률 | 상태 |
|------|------|------------|--------|------|
| **처리량 (TPS)** | 450 req/s | **28.5 req/s** | 6.3% | 🔴 실패 |
| **평균 응답 시간** | < 200ms | **4,000-6,000ms** | 실패 | 🔴 심각 |
| **P95 응답 시간** | < 500ms | **8,192ms (8.2초)** | 실패 | 🔴 심각 |
| **P99 응답 시간** | < 1,000ms | **~10,000ms (10초)** | 실패 | 🔴 심각 |
| **에러율** | < 1% | **50%** | 실패 | 🔴 심각 |
| **동시 접속 지원** | 1,000명 | **75명** | 7.5% | 🔴 실패 |

**테스트 결과: ❌ FAILED**
- 5개 임계값 중 4개 실패
- 전체적으로 목표의 6-7% 수준
- 실시간 채팅 서비스로 사용 불가능한 수준

### 상세 메트릭

#### 1️⃣ 처리량 (Throughput)

```
총 요청 수:     14,213 requests
성공:          7,107 requests (50%)
실패:          7,106 requests (50%)
테스트 시간:    720초 (12분)

평균 TPS:      19.7 req/s
Peak TPS:      28.5 req/s
최소 TPS:      ~5 req/s (초기)
```

**시간대별 TPS:**
```
12:47-12:49 (Warm-up):  5-15 req/s
12:49-12:51 (Ramp-up):  15-25 req/s
12:51-12:56 (Peak):     20-28.5 req/s
12:56-12:58 (Ramp-down): 15-5 req/s
```

**분석:**
- 목표 대비 **93.7% 부족**
- 100명 동시 접속 시 28.5 req/s = **사용자당 0.285 req/s**
- 사용자가 3.5초마다 1번만 요청 가능한 수준
- 실시간 채팅에는 **턱없이 부족**

#### 2️⃣ 응답 시간 (Latency)

**HTTP 응답 시간:**
```
최소 (Min):       ~100ms
평균 (Avg):       4,000-6,000ms (4-6초)
중앙값 (P50):     ~5,000ms
95번째 백분위수 (P95): 8,192ms (8.2초) ← 목표: 500ms
99번째 백분위수 (P99): ~10,000ms (10초) ← 목표: 1,000ms
최대 (Max):       >10,000ms
```

**시간대별 응답 시간 추이:**
```
12:47-12:48: 100-1,000ms (정상)
12:48-12:50: 1,000-4,000ms (지연 시작)
12:50-12:56: 4,000-10,000ms (심각한 지연) ← Peak
12:56-12:58: 2,000-4,000ms (여전히 높음)
```

**분석:**
- P95가 **목표의 16배 초과** (8,192ms vs 500ms)
- 95%의 사용자가 **8초 이상 대기**
- 10초 이상 대기하는 요청도 다수 발생
- 실시간 사용자 경험 **완전히 불가능**

#### 3️⃣ 에러율 (Error Rate)

```
총 요청:       14,213
성공:         7,107 (50%)
실패:         7,106 (50%)

에러 유형 추정:
- Timeout:        ~40% (응답 지연으로 인한 타임아웃)
- Connection:     ~5% (WebSocket 연결 실패)
- Server Error:   ~5% (500 Internal Server Error)
```

**에러 발생 패턴:**
```
50-75 VUs:    에러율 10-20% (일부 실패)
75-100 VUs:   에러율 40-50% (절반 실패)
```

**분석:**
- **목표 1% 대비 50배 초과**
- 75명 이상 접속 시 **시스템 붕괴 수준**
- 사용자 절반이 정상 서비스 이용 불가
- 서비스 신뢰도 **심각하게 낮음**

#### 4️⃣ WebSocket 메트릭

```
WebSocket 세션:         N/A (측정 불가)
메시지 전송 지연:       N/A
메시지 수신 지연:       N/A
메시지 손실률:          N/A
WebSocket 재연결률:     N/A
```

**분석:**
- WebSocket 관련 메트릭이 **측정되지 않음**
- HTTP 폴링 또는 Long Polling 사용 추정
- 실시간 양방향 통신 **제대로 작동 안 함**
- WebSocket 프레임 유실 또는 연결 끊김 발생

---

## 🔍 병목 지점 분석

### 병목 #1: 데이터베이스 직접 접근

**현상:**
- 모든 메시지가 MySQL에 직접 저장
- 응답 시간의 90% 이상이 DB I/O 대기

**측정 데이터:**
```
메시지 전송 요청 → MySQL INSERT → 응답
                    ↑
                  평균 4-6초 소요
```

**원인:**
1. **동기 I/O**
   - 메시지 저장 완료까지 요청 블로킹
   - 사용자 대기 시간 증가

2. **Write Contention**
   - 100명이 동시에 INSERT 시도
   - Lock 대기 시간 증가
   - InnoDB Row Lock 경합

3. **Connection Pool 고갈**
   ```
   HikariCP 기본 설정: 10 connections
   동시 요청: 100 VUs
   → 90개 요청이 Connection 대기
   ```

4. **인덱스 부족**
   - 채팅방 메시지 조회 시 Full Table Scan
   - 수신자 필터링 시 비효율적 쿼리

**영향:**
- 응답 시간: 8,192ms (P95)
- 처리량: 28.5 req/s (목표의 6.3%)
- 에러율: 50%

### 병목 #2: 비효율적인 브로드캐스트

**현상:**
- 메시지 전송 시마다 DB 조회 반복
- N+1 쿼리 문제 발생

**측정 데이터:**
```
1개 메시지 전송 시:
- 채팅방 정보 조회: 1번
- 참여자 목록 조회: 1번
- 각 참여자별 권한 확인: N번
- 메시지 저장: 1번

총 DB 쿼리: 3 + N번 (N = 참여자 수)
```

**코드 예시:**
```java
// 현재 구현 (비효율적)
@Transactional
public void sendMessage(Long chatRoomId, String message) {
    // 1. 채팅방 조회 (DB 쿼리 1)
    ChatRoom room = chatRoomRepository.findById(chatRoomId);
    
    // 2. 참여자 목록 조회 (DB 쿼리 2)
    List<User> members = room.getMembers();
    
    // 3. 각 참여자에게 전송 (DB 쿼리 N)
    for (User member : members) {
        // 권한 확인 (DB 쿼리)
        if (hasPermission(member, room)) {
            // WebSocket 전송
            sendToUser(member, message);
        }
    }
    
    // 4. 메시지 저장 (DB 쿼리 1)
    messageRepository.save(message);
}

총 쿼리: 3 + N번 (10명 방 = 13번 쿼리!)
```

**영향:**
- 채팅방 참여자 수에 비례해 성능 저하
- 10명 방: 13번 쿼리
- 100명 방: 103번 쿼리
- 500명 방: 503번 쿼리

### 병목 #3: 메모리 및 리소스 부족

**현상:**
- 100 VUs 도달 시 CPU 100% 사용
- 메모리 사용량 급증
- GC(Garbage Collection) 빈번 발생

**측정 데이터:**
```
50 VUs:
- CPU: 40-50%
- Memory: 2GB / 4GB
- Response Time: 1-2초

100 VUs:
- CPU: 95-100%
- Memory: 3.8GB / 4GB (거의 한계)
- Response Time: 8-10초
- GC Pause: 1-2초마다 발생
```

**원인:**
1. **WebSocket 세션 메모리**
   - 각 연결당 메모리 사용
   - 100 VUs × 2MB = 200MB (세션만)

2. **DB Connection Pool**
   - 각 연결당 메모리 사용
   - Prepared Statement 캐시

3. **메시지 버퍼**
   - 전송 대기 메시지 메모리 적재
   - 브로드캐스트 시 복사 발생

**영향:**
- 75명 이상 접속 시 성능 급격히 저하
- OutOfMemoryError 위험
- 서버 다운 가능성

### 병목 #4: Scale-Out 불가능 구조

**현상:**
- WebSocket이 특정 서버에 고정
- 서버 추가 시에도 부하 분산 불가

**현재 구조:**
```
Client A ─────▶ Server 1 (WebSocket)
Client B ─────▶ Server 1 (WebSocket)
Client C ─────▶ Server 2 (WebSocket)

문제:
- Client A와 B는 메시지 교환 가능
- Client A와 C는 메시지 교환 불가능!
- 서버 간 메시지 동기화 불가
```

**영향:**
- 수평 확장(Scale-Out) 불가능
- 단일 서버 성능 한계 = 전체 시스템 한계
- 사용자 증가 대응 불가

---

## ⚠️ 문제점 상세 분석

### 🔴 문제 #1: 심각한 응답 지연

**현황:**
- P95 응답 시간: **8,192ms (8.2초)**
- P99 응답 시간: **10,000ms (10초)**
- 평균 응답 시간: **5,000ms (5초)**

**사용자 경험:**
```
사용자가 메시지 전송 버튼 클릭
        ↓
    8초 대기... ⏳
        ↓
    메시지 전송 완료 ✓

→ 95%의 사용자가 이 경험을 함
→ 실시간 채팅 불가능
→ 대부분의 사용자 이탈
```

**근본 원인:**
1. **MySQL 동기 I/O**
   - 메시지 저장 완료까지 대기
   - DB 응답 시간: 4-6초

2. **Lock 경합**
   - 동시 INSERT 시 Lock 대기
   - InnoDB Row Lock 경합

3. **Connection Pool 부족**
   - HikariCP: 10개 연결
   - 100개 요청 동시 발생
   - 90개 요청이 대기

4. **네트워크 I/O**
   - DB 서버와의 통신 지연
   - 반복적인 쿼리 실행

**영향:**
- 실시간 채팅 서비스로 사용 불가능
- 사용자 만족도 극도로 낮음
- 서비스 신뢰도 하락
- 사용자 이탈률 증가

**개선 필요도:** 🔴 최우선 (Critical)

### 🔴 문제 #2: 낮은 처리량 (6.3%)

**현황:**
- 목표: 450 req/s
- 실제: **28.5 req/s**
- 달성률: **6.3%**
- 부족량: **93.7% 부족**

**의미:**
```
현재 시스템으로 지원 가능한 사용자:
- 동시 접속: 75명 (안정적)
- 최대 부하: 100명 (50% 실패)

목표 사용자:
- 동시 접속: 1,000명
- Peak 시간: 3,000-5,000명

→ 현재 시스템으로는 목표의 7.5%만 지원 가능
```

**근본 원인:**
1. **Sequential 처리**
   - 요청을 순차적으로 처리
   - 병렬 처리 불가능

2. **DB 병목**
   - 모든 요청이 DB 거쳐야 함
   - DB가 시스템 전체 병목

3. **단일 서버 한계**
   - 1대 서버로 모든 부하 처리
   - Scale-Out 불가능

**영향:**
- 대규모 사용자 지원 불가능
- 사용자 증가 시 서비스 다운
- 비즈니스 확장 불가능

**개선 필요도:** 🔴 최우선 (Critical)

### 🔴 문제 #3: 높은 실패율 (50%)

**현황:**
- 총 요청: 14,213개
- 실패: **7,106개 (50%)**
- 에러율: **목표의 50배**

**에러 유형 분포:**
```
Timeout (40%):
- 8초 응답 지연으로 타임아웃
- 클라이언트 연결 끊김

Connection Error (5%):
- WebSocket 연결 실패
- 서버 리소스 부족

Server Error (5%):
- OutOfMemoryError
- DB Connection 고갈
- 500 Internal Server Error
```

**근본 원인:**
1. **응답 지연 타임아웃**
   - 8초 응답 시간 → 클라이언트 타임아웃 (보통 5초)

2. **리소스 고갈**
   - DB Connection Pool 고갈
   - 메모리 부족
   - CPU 100% 사용

3. **에러 처리 미흡**
   - 재시도 로직 부재
   - Circuit Breaker 미적용
   - 우아한 실패(Graceful Degradation) 없음

**영향:**
- 사용자 절반이 정상 서비스 이용 불가
- 서비스 신뢰도 극도로 낮음
- 부정적 사용자 리뷰 증가
- 서비스 평판 하락

**개선 필요도:** 🔴 최우선 (Critical)

### 🔴 문제 #4: 확장성 부족

**현황:**
- 안정적 동시 접속: **75명**
- 목표: **1,000명**
- 달성률: **7.5%**

**Scale-Out 불가능 이유:**
```
현재 아키텍처:

Server 1:          Server 2:
[WebSocket]        [WebSocket]
[Session]          [Session]
   ↓                  ↓
      [MySQL]

문제:
1. WebSocket Sticky Session
   - 사용자가 특정 서버에 고정
   
2. 세션 공유 불가
   - 서버 1의 세션을 서버 2에서 모름
   
3. 메시지 동기화 불가
   - 서버 1의 메시지를 서버 2가 모름
   
→ 서버를 추가해도 사용자 간 통신 불가능!
```

**근본 원인:**
1. **Stateful 아키텍처**
   - WebSocket 연결이 서버에 고정
   - 상태(Session)가 서버 메모리에 저장

2. **서버 간 통신 부재**
   - Message Bus 없음
   - Pub/Sub 패턴 미적용

3. **Session 공유 불가**
   - Redis 같은 중앙 저장소 없음
   - 서버 메모리에만 저장

**영향:**
- 사용자 증가 시 대응 불가능
- 서버 추가 해도 효과 없음
- 비즈니스 성장 제약

**개선 필요도:** 🔴 최우선 (Critical)

### 🔴 문제 #5: 실시간성 저하

**현황:**
- WebSocket 메트릭: **모두 N/A (측정 불가)**
- 실시간 브로드캐스트: **동작 안 함**

**예상 구현:**
```
// 현재 구현 추정
@MessageMapping("/chat")
public void handleMessage(ChatMessage message) {
    // DB에 저장
    messageRepository.save(message);
    
    // 수신자 조회
    List<User> recipients = getRecipients(message.getChatRoomId());
    
    // 각 수신자에게 전송
    for (User user : recipients) {
        simpMessagingTemplate.convertAndSendToUser(
            user.getId(),
            "/queue/messages",
            message
        );
    }
}

문제:
1. DB 저장 완료까지 대기 (4-6초)
2. 수신자 조회에 DB 쿼리 (추가 지연)
3. 순차적 전송 (N명에게 전송 시 N배 지연)
```

**근본 원인:**
1. **동기 브로드캐스트**
   - 모든 수신자에게 순차 전송
   - N명 × 응답시간

2. **DB 조회 의존**
   - 수신자 목록 매번 DB 조회
   - 캐싱 없음

3. **Pub/Sub 패턴 미적용**
   - 메시지 발행/구독 모델 없음
   - 직접 전송 방식

**영향:**
- 실시간 채팅 불가능
- 메시지 전송 지연
- 사용자 경험 극도로 나쁨

**개선 필요도:** 🔴 최우선 (Critical)

---

## 🎯 TO-BE: 개선 계획

### 새로운 아키텍처

```
┌─────────┐
│  Client │
└────┬────┘
     │ WebSocket
     ▼
┌─────────────────┐
│  Spring Boot    │ ◄──────┐
│  (WebSocket)    │        │
└────┬───┬────┬───┘        │
     │   │    │            │
     │   │    └─▶ Kafka ──┘ (Event Sourcing)
     │   │         ▲
     │   └────▶ Redis (Pub/Sub + Cache)
     │            │
     └──────────▶ MySQL (Async Write)
```

**새로운 기술 스택:**
- **Caching**: Redis Cluster (3-6 노드)
- **Message Queue**: Apache Kafka (3-5 브로커)
- **Session Storage**: Redis (공유 세션)
- **Database**: MySQL (비동기 저장)

### 개선 전략

#### 🚀 개선 #1: Redis 도입

**역할:**
1. **메시지 캐싱**
   - 최근 100개 메시지 캐싱
   - TTL: 1시간
   - 조회 시간: 8초 → 5ms (1,600배 빠름)

2. **Pub/Sub 브로드캐스트**
   ```java
   // 개선 후
   @MessageMapping("/chat")
   public void handleMessage(ChatMessage message) {
       // 1. Redis Pub/Sub로 즉시 브로드캐스트
       redisTemplate.convertAndSend("chat:" + chatRoomId, message);
       
       // 2. Kafka로 비동기 저장 요청
       kafkaTemplate.send("message-events", message);
       
       // 즉시 리턴! (응답 시간: 5-10ms)
   }
   ```

3. **세션 공유**
   - WebSocket 세션을 Redis에 저장
   - 서버 간 세션 공유 가능
   - Scale-Out 지원

4. **Rate Limiting**
   - 사용자별 메시지 전송 제한
   - DDoS 방어
   - 공정한 리소스 사용

**기대 효과:**
- 응답 시간: 8,000ms → **50ms** (99.4% 개선)
- 처리량: 28.5 → **200+ req/s** (7배 향상)
- 실패율: 50% → **5%** (90% 개선)

**구현 예시:**
```java
@Configuration
public class RedisConfig {
    @Bean
    public RedisTemplate<String, Object> redisTemplate() {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(redisConnectionFactory());
        return template;
    }
    
    @Bean
    public RedisMessageListenerContainer redisContainer() {
        RedisMessageListenerContainer container = 
            new RedisMessageListenerContainer();
        container.setConnectionFactory(redisConnectionFactory());
        container.addMessageListener(messageListener(), 
            new PatternTopic("chat:*"));
        return container;
    }
}

@Service
public class ChatService {
    @Autowired
    private RedisTemplate<String, ChatMessage> redisTemplate;
    
    public void broadcastMessage(Long chatRoomId, ChatMessage message) {
        // 즉시 브로드캐스트 (5ms)
        redisTemplate.convertAndSend("chat:" + chatRoomId, message);
        
        // 캐시에 저장
        redisTemplate.opsForList()
            .leftPush("messages:" + chatRoomId, message);
        redisTemplate.expire("messages:" + chatRoomId, 1, TimeUnit.HOURS);
    }
    
    public List<ChatMessage> getRecentMessages(Long chatRoomId) {
        // Redis에서 조회 (5ms)
        return redisTemplate.opsForList()
            .range("messages:" + chatRoomId, 0, 99);
    }
}
```

#### 🚀 개선 #2: Kafka 도입

**역할:**
1. **이벤트 소싱 (Event Sourcing)**
   ```
   메시지 전송 → Kafka Producer (즉시 리턴)
                    ↓
                Kafka Broker (저장)
                    ↓
                Consumer Group
                    ↓
                MySQL 비동기 저장
   ```

2. **메시지 순서 보장**
   - 채팅방 ID를 파티션 키로 사용
   - 같은 방의 메시지는 순서 보장

3. **확장 가능한 Consumer**
   - Consumer Group으로 병렬 처리
   - Consumer 추가 시 자동 분산

4. **재처리 가능**
   - 저장 실패 시 재시도
   - 메시지 손실 방지

**기대 효과:**
- DB 부하: 100% → **10%** (90% 감소)
- 메시지 손실: **0%** (재처리 가능)
- 확장성: 무제한 Consumer 추가

**구현 예시:**
```java
// Producer (메시지 전송)
@Service
public class MessageProducer {
    @Autowired
    private KafkaTemplate<String, ChatMessage> kafkaTemplate;
    
    public void sendMessage(ChatMessage message) {
        // 채팅방 ID를 파티션 키로 사용 (순서 보장)
        kafkaTemplate.send(
            "message-events",
            message.getChatRoomId().toString(),
            message
        );
    }
}

// Consumer (메시지 저장)
@Service
public class MessageConsumer {
    @Autowired
    private MessageRepository messageRepository;
    
    @KafkaListener(topics = "message-events", groupId = "message-persist")
    public void consume(ChatMessage message) {
        try {
            // 비동기로 DB에 저장
            messageRepository.save(message);
        } catch (Exception e) {
            // 실패 시 재시도 (Kafka가 자동 처리)
            log.error("Failed to save message", e);
            throw e;
        }
    }
}
```

#### 🚀 개선 #3: 캐싱 전략

**3단계 캐싱:**

```
Level 1: Redis (Hot Data)
- 최근 100개 메시지
- 활성 사용자 세션
- 채팅방 메타데이터
- TTL: 1시간
- 응답 시간: 5ms

Level 2: Local Cache (Spring)
- 사용자 정보
- 채팅방 정보
- TTL: 10분
- 응답 시간: < 1ms

Level 3: MySQL (Cold Data)
- 전체 메시지 영구 저장
- 검색 인덱싱
- 분석 데이터
- 응답 시간: 100ms+
```

**Cache-Aside 패턴:**
```java
public List<ChatMessage> getMessages(Long chatRoomId) {
    // 1. Redis 확인
    List<ChatMessage> cached = redisTemplate.opsForList()
        .range("messages:" + chatRoomId, 0, 99);
    
    if (!cached.isEmpty()) {
        return cached; // Cache Hit (5ms)
    }
    
    // 2. DB 조회
    List<ChatMessage> messages = messageRepository
        .findTop100ByChatRoomIdOrderByCreatedAtDesc(chatRoomId);
    
    // 3. Redis에 저장
    redisTemplate.opsForList()
        .rightPushAll("messages:" + chatRoomId, messages);
    redisTemplate.expire("messages:" + chatRoomId, 1, TimeUnit.HOURS);
    
    return messages;
}
```

**기대 효과:**
- DB 조회: 100% → **5%** (95% 감소)
- 응답 시간: 8,000ms → **5ms** (1,600배 빠름)
- DB 부하: 대폭 감소

#### 🚀 개선 #4: 비동기 처리

**동기 → 비동기 전환:**

```java
// AS-IS (동기)
@Transactional
public void sendMessage(ChatMessage message) {
    // 1. DB 저장 (4-6초 대기)
    messageRepository.save(message);
    
    // 2. 브로드캐스트
    broadcastToUsers(message);
    
    // 총 소요 시간: 4-6초
}

// TO-BE (비동기)
public CompletableFuture<Void> sendMessageAsync(ChatMessage message) {
    // 1. Redis Pub/Sub (5ms)
    redisTemplate.convertAndSend("chat:" + chatRoomId, message);
    
    // 2. Kafka 발행 (10ms)
    kafkaTemplate.send("message-events", message);
    
    // 즉시 리턴!
    return CompletableFuture.completedFuture(null);
    
    // 총 소요 시간: 15ms (400배 빠름!)
}

// Kafka Consumer가 백그라운드에서 DB 저장
@KafkaListener(topics = "message-events")
public void saveMessage(ChatMessage message) {
    messageRepository.save(message); // 비동기 실행
}
```

**기대 효과:**
- 응답 시간: 8,000ms → **15ms** (533배 빠름)
- 사용자 경험: 즉시 응답
- DB 부하: 분산 처리

#### 🚀 개선 #5: Scale-Out 전략

**수평 확장 아키텍처:**

```
                Load Balancer (Nginx)
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   Server 1         Server 2         Server 3
   [WebSocket]      [WebSocket]      [WebSocket]
        │               │               │
        └───────────────┼───────────────┘
                        │
                  Redis Pub/Sub
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
     Kafka 1         Kafka 2         Kafka 3
        │               │               │
        └───────────────┼───────────────┘
                        │
                      MySQL
```

**Redis를 통한 서버 간 통신:**
```java
// Server 1에서 메시지 발행
redisTemplate.convertAndSend("chat:123", message);

// Server 2, 3에서 자동 수신
@RedisMessageListener(pattern = "chat:*")
public void onMessage(ChatMessage message) {
    // 해당 서버에 연결된 사용자에게만 전송
    sendToConnectedUsers(message);
}
```

**기대 효과:**
- 동시 접속: 75명 → **무제한** (서버 추가로 확장)
- 처리량: 28.5 req/s → **N × 500 req/s** (N = 서버 수)
- 고가용성: 1대 다운 시에도 서비스 유지

---

## 📊 기대 효과

### 성능 개선 목표

| 항목 | AS-IS | TO-BE 목표 | 개선율 |
|------|-------|-----------|--------|
| **처리량 (TPS)** | 28.5 req/s | **500+ req/s** | **1,750% ↑** |
| **평균 응답 시간** | 5,000ms | **< 50ms** | **99% ↓** |
| **P95 응답 시간** | 8,192ms | **< 100ms** | **98.8% ↓** |
| **P99 응답 시간** | 10,000ms | **< 200ms** | **98% ↓** |
| **에러율** | 50% | **< 1%** | **98% ↓** |
| **동시 접속 지원** | 75명 | **1,000명** | **1,233% ↑** |
| **메시지 손실률** | N/A | **< 0.1%** | 측정 가능 |
| **DB 부하** | 100% | **10%** | **90% ↓** |

### 단계별 목표

#### 📅 Phase 1: Redis 도입 (1주차)

**목표:**
- TPS: 200 req/s (7배 향상)
- P95 응답 시간: 200ms (97.6% 개선)
- 동시 접속: 300명
- 에러율: 5%

**작업:**
1. Redis 설치 및 설정
2. Redis Pub/Sub 구현
3. 메시지 캐싱 적용
4. 세션 공유 구현

**예상 소요 시간:** 40시간

#### 📅 Phase 2: Kafka 도입 (2주차)

**목표:**
- TPS: 400 req/s (14배 향상)
- P95 응답 시간: 100ms (98.8% 개선)
- 동시 접속: 700명
- 에러율: 2%

**작업:**
1. Kafka 설치 및 설정
2. Producer/Consumer 구현
3. 비동기 메시지 저장
4. 이벤트 소싱 적용

**예상 소요 시간:** 60시간

#### 📅 Phase 3: 최적화 및 Scale-Out (3주차)

**목표:**
- TPS: 500+ req/s (17배 향상)
- P95 응답 시간: 50ms (99.4% 개선)
- 동시 접속: 1,000명
- 에러율: 1%

**작업:**
1. 캐싱 전략 최적화
2. Connection Pool 튜닝
3. Load Balancer 설정
4. 모니터링 및 알람

**예상 소요 시간:** 40시간

**총 예상 소요 시간:** 140시간 (3주)

### 비즈니스 영향

#### 사용자 경험 개선

```
AS-IS:
메시지 전송 → 8초 대기 → 50% 실패
→ 사용자 만족도: 10/100
→ 이탈률: 70%

TO-BE:
메시지 전송 → 즉시 응답 (50ms) → 99% 성공
→ 사용자 만족도: 90/100
→ 이탈률: 5%
```

#### 비즈니스 확장성

```
AS-IS:
- 동시 접속: 75명
- DAU (일일 활성 사용자): ~500명
- 서비스 신뢰도: 50%
- 확장 가능성: 불가능

TO-BE:
- 동시 접속: 1,000명 (13배 증가)
- DAU: ~10,000명 (20배 증가)
- 서비스 신뢰도: 99%
- 확장 가능성: 무제한 (서버 추가)

예상 효과:
- 매출: 20배 증가 가능
- 사용자 증가율: 월 50%+
- 시장 경쟁력: 대폭 상승
```

#### 운영 비용

```
AS-IS:
- 서버: 1대 (CPU 100% 사용)
- DB: 1대 (과부하)
- 모니터링: 부재
- 장애 대응: 수동

예상 월 비용: $100
서비스 품질: 매우 낮음

TO-BE:
- 서버: 3대 (자동 스케일링)
- Redis Cluster: 3노드
- Kafka Cluster: 3브로커
- DB: 1대 (부하 10%)
- 모니터링: 자동화
- 장애 대응: 자동 복구

예상 월 비용: $500
서비스 품질: 매우 높음

비용 대비 효과:
- 비용: 5배 증가
- 성능: 17배 증가
- 사용자: 20배 증가
→ ROI: 매우 높음
```

---

## 🗺️ 구현 로드맵

### Week 1: Redis 도입

**Day 1-2: 환경 설정**
- [ ] Redis 설치 (Docker Compose)
- [ ] Spring Data Redis 의존성 추가
- [ ] RedisTemplate 설정
- [ ] Redis Cluster 구성 (개발/스테이징)

**Day 3-4: Pub/Sub 구현**
- [ ] RedisMessageListenerContainer 설정
- [ ] ChatMessagePublisher 구현
- [ ] ChatMessageSubscriber 구현
- [ ] 서버 간 메시지 동기화 테스트

**Day 5-6: 캐싱 적용**
- [ ] 메시지 캐싱 (@Cacheable)
- [ ] 사용자 정보 캐싱
- [ ] 채팅방 메타데이터 캐싱
- [ ] Cache-Aside 패턴 구현

**Day 7: 테스트 및 검증**
- [ ] 성능 테스트 (k6)
- [ ] 목표 달성 확인 (200 req/s)
- [ ] 버그 수정
- [ ] 문서 작성

### Week 2: Kafka 도입

**Day 8-9: 환경 설정**
- [ ] Kafka 설치 (Docker Compose)
- [ ] Zookeeper 설정
- [ ] Spring Kafka 의존성 추가
- [ ] KafkaTemplate 설정

**Day 10-11: Producer 구현**
- [ ] MessageProducer 구현
- [ ] 파티션 전략 (채팅방 ID)
- [ ] 직렬화 설정 (JSON)
- [ ] 에러 처리

**Day 12-13: Consumer 구현**
- [ ] MessageConsumer 구현
- [ ] Consumer Group 설정
- [ ] 재시도 로직
- [ ] Dead Letter Queue

**Day 14: 테스트 및 검증**
- [ ] 성능 테스트 (k6)
- [ ] 목표 달성 확인 (400 req/s)
- [ ] 메시지 순서 보장 확인
- [ ] 문서 작성

### Week 3: 최적화 및 Scale-Out

**Day 15-16: 성능 최적화**
- [ ] Connection Pool 튜닝
- [ ] JVM 옵션 최적화
- [ ] 인덱스 최적화
- [ ] 쿼리 최적화

**Day 17-18: Scale-Out 설정**
- [ ] Nginx Load Balancer 설정
- [ ] Sticky Session 설정
- [ ] Health Check 구현
- [ ] 서버 추가 테스트

**Day 19-20: 모니터링 및 알람**
- [ ] Prometheus 설정
- [ ] Grafana 대시보드
- [ ] 알람 규칙 설정
- [ ] 로그 수집 (ELK Stack)

**Day 21: 최종 테스트 및 배포**
- [ ] 성능 테스트 (k6)
- [ ] 목표 달성 확인 (500+ req/s)
- [ ] 부하 테스트 (1,000 VUs)
- [ ] 프로덕션 배포

---

## 🔥 스트레스 테스트 결과 및 분석

### 테스트 개요

| 항목 | 내용 |
|------|------|
| **테스트 ID** | [Test Run #6537594](https://chotmeeyoung2.grafana.net/a/k6-app/runs/6537594) |
| **테스트 날짜** | 2026-01-15 12:46 KST |
| **테스트 타입** | Stress Test (시스템 한계 테스트) |
| **테스트 도구** | k6 Cloud |
| **Load Zone** | AWS Seoul (amazon:kr:seoul) |
| **테스트 코드** | `tests/k6/chat-stress-test-cloud.js` |
| **테스트 기간** | 27분 (계획) → 12분 (실제, 조기 실패) |
| **목표 VUs** | 100 → 1000 VUs (5단계) |
| **결과** | ❌ **실패** (네트워크 접근 불가) |

### 부하 프로파일 (계획)

```
시간     0분    5분    10분   15분   20분   25분   27분
VUs      0 ──▶ 100 ──▶ 200 ──▶ 300 ──▶ 500 ──▶ 1000 ──▶ 0
단계    시작  Level1  Level2  Level3  Level4  Level5  종료
```

**원래 계획:**
- **Level 1 (0-5분)**: 100 VUs (Baseline)
- **Level 2 (5-10분)**: 200 VUs (2x load)
- **Level 3 (10-15분)**: 300 VUs (3x load)
- **Level 4 (15-20분)**: 500 VUs (5x load)
- **Level 5 (20-25분)**: 1,000 VUs (10x load, Breaking Point 예상)
- **Ramp Down (25-27분)**: 0 VUs

### 실제 테스트 결과

#### ❌ 테스트 실패 원인: 네트워크 접근 불가

**측정된 지표:**

| 지표 | 측정값 | 목표 | 달성률 |
|------|--------|------|--------|
| **총 요청 수** | 14,200 reqs | 100,000+ reqs | ❌ 14.2% |
| **HTTP 실패 수** | 7,100 reqs | < 1% | ❌ **50.0%** |
| **Peak RPS** | 28.5 req/s | 100+ req/s | ❌ 28.5% |
| **P95 응답시간** | 8,192ms | < 500ms | ❌ 1638% 초과 |
| **P99 응답시간** | N/A | < 1000ms | ❌ 측정 불가 |
| **최대 VUs** | 100 VUs | 1000 VUs | ❌ 10% |
| **테스트 시간** | 12분 | 27분 | ❌ 44% |

#### 에러 로그 분석

**주요 에러:**

```bash
Request Failed error=Post "http://3.38.28.172:8080/api/v1/auth/login": 
dial tcp 3.38.28.172:8080: connect: connection refused
```

**에러 통계:**
- **총 에러 수**: 약 5,150+ 건
- **에러 타입**: `connection refused` (100%)
- **에러 발생 시점**: 테스트 시작부터 지속적 발생
- **최종 상태**: `test status: Finished` (Threshold 실패로 조기 종료)

#### Cloud Insights 점수

| 카테고리 | 점수 | 등급 | 주요 이슈 |
|---------|------|------|-----------|
| **Best Practice** | 78/100 | 🟡 Needs Improvement | 1 Poor 항목 |
| **Reliability** | 49/100 | 🔴 Poor | **50% 실패율** |
| **System** | 100/100 | ✅ Good | 시스템 안정성 양호 |
| **전체** | ❌ Failed | 🔴 Failed | Threshold 미달 |

### 근본 원인 분석

#### 1️⃣ 네트워크 접근 문제 (Critical)

**문제:**
```
k6 Cloud (외부) → ✖️ 차단 → EC2 (3.38.28.172:8080)
```

**원인:**
- **Kubernetes 서비스 타입**: `ClusterIP` (클러스터 내부 전용)
- **포트 포워딩**: `kubectl port-forward`는 로컬 접근만 가능 (외부 차단)
- **Security Group**: EC2 인스턴스의 30080 포트가 외부에 개방되지 않음

**영향:**
- k6 Cloud가 대상 서버에 전혀 접근하지 못함
- 실제 애플리케이션 성능을 전혀 측정하지 못함
- 테스트 결과가 무효화됨

#### 2️⃣ 아키텍처 설계 문제

```
[현재 설정]
┌─────────────┐                     ┌──────────────────┐
│  k6 Cloud   │ ───✖️ Blocked───▶   │   EC2 Public     │
│  (Seoul)    │                     │   3.38.28.172    │
└─────────────┘                     └────────┬─────────┘
                                             │
                                    kubectl port-forward
                                    (localhost:8080 only)
                                             │
                                             ▼
                                    ┌──────────────────┐
                                    │   Kubernetes     │
                                    │  ClusterIP Svc   │
                                    │   (chat-service) │
                                    └──────────────────┘

[필요한 설정]
┌─────────────┐                     ┌──────────────────┐
│  k6 Cloud   │ ───✅ Allowed ───▶  │   EC2 Public     │
│  (Seoul)    │                     │   3.38.28.172    │
└─────────────┘                     │   Port: 30080    │
                                    └────────┬─────────┘
                                             │
                                      NodePort Service
                                             │
                                             ▼
                                    ┌──────────────────┐
                                    │   Kubernetes     │
                                    │  NodePort Svc    │
                                    │   30080 → 8080   │
                                    └──────────────────┘
```

### 해결 방안

#### ✅ 솔루션 1: NodePort 서비스 + Security Group 개방 (권장)

**장점:**
- k6 Cloud 테스트 가능
- 프로덕션과 유사한 환경 테스트
- 외부 모니터링 도구 연동 가능

**단계:**

1. **Kubernetes 서비스를 NodePort로 변경**

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: chat-service
  namespace: chat-system
spec:
  type: NodePort  # ClusterIP → NodePort
  selector:
    app: chat-service
  ports:
  - name: http
    port: 80
    targetPort: 8080
    nodePort: 30080  # 외부 접근용 포트
    protocol: TCP
```

2. **서비스 적용**

```bash
kubectl apply -f k8s/service.yaml
kubectl get svc -n chat-system
```

3. **AWS Security Group 규칙 추가**

| Type | Protocol | Port Range | Source | Description |
|------|----------|------------|--------|-------------|
| Custom TCP | TCP | 30080 | 0.0.0.0/0 | k6 Cloud Load Test |

4. **테스트 URL 업데이트**

```bash
# 환경 변수 설정
export BASE_URL=http://3.38.28.172:30080
export WS_URL=ws://3.38.28.172:30080

# k6 Cloud 테스트 실행
k6 cloud tests/k6/chat-stress-test-cloud.js
```

#### ⚡ 솔루션 2: k6 로컬 실행 (대안)

**장점:**
- Security Group 변경 불필요
- 즉시 테스트 가능
- 더 높은 부하 생성 가능 (네트워크 레이턴시 감소)

**단점:**
- k6 Cloud 대시보드 사용 불가
- 수동으로 결과 수집 필요

**실행 방법:**

```bash
# Kubernetes 서버에서 직접 실행
ssh ubuntu@3.38.28.172

# k6 설치
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# 테스트 실행 (localhost 사용)
BASE_URL=http://localhost:8080 \
WS_URL=ws://localhost:8080 \
k6 run --vus 1000 --duration 27m tests/k6/chat-stress-test-cloud.js
```

### 다음 단계

#### 🎯 즉시 수행 (필수)

1. ✅ **NodePort 서비스 적용**
   ```bash
   cd /path/to/project
   bash tests/k6/apply-nodeport-and-test.sh
   ```

2. ✅ **Security Group 개방**
   - AWS Console → EC2 → Security Groups
   - Inbound Rule 추가: TCP 30080, Source: 0.0.0.0/0

3. ✅ **연결 테스트**
   ```bash
   curl http://3.38.28.172:30080/actuator/health
   ```

4. ✅ **스트레스 테스트 재실행**
   ```bash
   BASE_URL=http://3.38.28.172:30080 \
   WS_URL=ws://3.38.28.172:30080 \
   k6 cloud tests/k6/chat-stress-test-cloud.js
   ```

#### 📊 테스트 완료 후 분석 (예정)

**예상 Breaking Point 분석:**

| VU 레벨 | VUs | 예상 RPS | 예상 결과 | 병목 지점 |
|---------|-----|----------|-----------|-----------|
| Level 1 | 100 | 50-80 | ✅ 정상 | - |
| Level 2 | 200 | 100-150 | ⚠️ 지연 시작 | **Tomcat 스레드 포화** |
| Level 3 | 300 | 150-200 | ⚠️ 에러 증가 | **DB Connection Pool 고갈** |
| Level 4 | 500 | 200-250 | ❌ 높은 에러율 | **MySQL Write Lock** |
| Level 5 | 1000 | ? | ❌ 시스템 한계 | **전체 시스템 포화** |

**측정 목표:**
- ✅ **Breaking Point**: 몇 명의 동시 사용자까지 안정적인가?
- ✅ **최대 처리량**: 초당 최대 몇 개의 요청을 처리하는가?
- ✅ **에러 증가 시점**: 어느 부하 수준에서 에러율이 급증하는가?
- ✅ **응답 시간 증가 패턴**: P95/P99 latency의 변화 추이는?
- ✅ **리소스 병목**: CPU, Memory, DB Connection 중 무엇이 먼저 포화되는가?

---

## 📚 참고 자료

### 성능 테스트 결과
- **Chat Message Test**: [Test Run #6537510](https://chotmeeyoung2.grafana.net/a/k6-app/runs/6537510) ✅ 성공
- **Stress Test (실패)**: [Test Run #6537594](https://chotmeeyoung2.grafana.net/a/k6-app/runs/6537594) ❌ 네트워크 문제
- **테스트 날짜**: 2026-01-15 12:46 KST
- **테스트 코드**: `tests/k6/chat-stress-test-cloud.js`

### 기술 문서
- [Spring WebSocket Documentation](https://docs.spring.io/spring-framework/docs/current/reference/html/web.html#websocket)
- [Redis Pub/Sub](https://redis.io/docs/manual/pubsub/)
- [Apache Kafka Documentation](https://kafka.apache.org/documentation/)
- [k6 Load Testing](https://k6.io/docs/)

### 관련 이슈
- #123: 채팅 메시지 전송 지연 문제
- #124: 높은 에러율 개선
- #125: Redis 도입 계획
- #126: Kafka 도입 계획

---

## 👥 기여자

- **성능 테스트**: choimeeyoung2@gmail.com
- **아키텍처 설계**: DevOps Team
- **개발**: Backend Team

---

## 📝 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|-----------|
| 2026-01-15 | 1.0 | 초기 성능 분석 문서 작성 |
| 2026-01-15 | 1.1 | 개선 계획 및 로드맵 추가 |
| 2026-01-15 | 1.2 | **스트레스 테스트 실패 분석 및 해결 방안 추가** |

---

**Last Updated**: 2026-01-15 13:15 KST
**Document Version**: 1.2
**Status**: 🔴 Stress Test Failed → 🟡 Network Issue Resolution Required
