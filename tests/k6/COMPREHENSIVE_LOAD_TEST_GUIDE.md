# CoreConnect 포괄적 부하 테스트 가이드

> **작성일**: 2026-01-18  
> **테스트 대상**: 채팅, 이메일, 알림 시스템  
> **전문가 관점**: 20년차 Spring 백엔드 개발자 (Redis/Kafka 전문)

---

## 📋 목차

1. [개요](#개요)
2. [테스트 파일 구성](#테스트-파일-구성)
3. [실행 방법](#실행-방법)
4. [메트릭 분석 방법](#메트릭-분석-방법)
5. [병목 지점 파악](#병목-지점-파악)
6. [최적화 권장사항](#최적화-권장사항)

---

## 🎯 개요

### 테스트 목적

이 부하 테스트는 CoreConnect의 핵심 기능(채팅, 이메일, 알림)에 대한 **처리량(Throughput)**, **지연시간(Latency)**, **병목지점(Bottleneck)**을 명확히 파악하기 위해 설계되었습니다.

### 전문가의 관점

**20년 경력 시니어 개발자의 성능 최적화 접근법:**

1. **측정 가능한 것만 개선 가능** - 정확한 메트릭 수집이 핵심
2. **병목은 하나씩** - 가장 큰 병목부터 해결
3. **인프라 레이어별 분석** - Redis/Kafka/DB 각각의 성능 파악
4. **실제 사용 패턴 반영** - 프로덕션 트래픽 패턴 시뮬레이션

### 기대 효과

- ✅ **처리량 분석**: 초당 처리 가능한 요청 수(TPS) 파악
- ✅ **지연시간 분석**: P95, P99 레이턴시 측정
- ✅ **병목 지점 파악**: 시스템의 약한 고리 식별
- ✅ **스케일링 전략 수립**: 수평/수직 확장 의사결정 근거

---

## 📂 테스트 파일 구성

### 1. Email Stress Test
**파일**: `email-stress-test-cloud.js`

```bash
# 테스트 대상
- 이메일 발송 성능
- 받은편지함 조회 (N+1 문제 체크)
- 이메일 상세 조회
```

**주요 메트릭**:
- `email_send_duration` - 이메일 발송 지연시간
- `email_inbox_duration` - 받은편지함 조회 지연시간
- `db_query_duration` - DB 쿼리 시간 (N+1 감지)
- `bottleneck_detected` - 병목 감지 횟수

**부하 패턴**:
```
50 → 100 → 200 → 400 → 800 → 1000 users
(점진적 증가로 병목 지점 파악)
```

**실행 시간**: 약 20분

---

### 2. Notification Stress Test
**파일**: `notification-stress-test-cloud.js`

```bash
# 테스트 대상
- 알림 발송 성능 (Kafka Producer)
- 알림 읽음 처리 (Redis Cache)
- 버스트 처리 능력
```

**주요 메트릭**:
- `notification_send_duration` - 알림 발송 지연시간
- `notification_burst_handling` - 버스트 처리 성능
- `messaging_layer_latency` - Kafka/Redis 레이턴시
- `cache_hit_rate` - Redis 캐시 히트율

**부하 패턴**:
```
50 → 200 → 1000(급증!) → 1000 → 200 → 500 → 1500 users
(버스트 시뮬레이션 - 알림 시스템 특성)
```

**실행 시간**: 약 12분

---

### 3. Chat Enhanced Stress Test
**파일**: `chat-enhanced-stress-test-cloud.js`

```bash
# 테스트 대상
- WebSocket 연결 안정성
- 메시지 송수신 성능
- 채팅방 조회 (N+1 문제)
- Redis Pub/Sub 성능
```

**주요 메트릭**:
- `ws_connection_duration` - WebSocket 연결 시간
- `message_send_duration` - 메시지 전송 지연시간
- `message_receive_duration` - 엔드-투-엔드 지연시간
- `message_loss_rate` - 메시지 손실률
- `messaging_latency` - Redis/Kafka 레이턴시

**부하 패턴**:
```
100 → 300 → 800 → 500 → 1200 → 1500 → 300 users
(실제 채팅 사용 패턴: 출근, 점심, 저녁 피크)
```

**실행 시간**: 약 20분

---

### 4. Integrated Stress Test (★ 가장 중요)
**파일**: `integrated-stress-test-cloud.js`

```bash
# 테스트 대상
- 채팅 + 이메일 + 알림 동시 사용
- 실제 사용자 시나리오 (40% 채팅, 25% 이메일, 15% 알림, 20% 혼합)
- 시스템 전체 건강도
```

**주요 메트릭**:
- `total_throughput` - 전체 시스템 처리량
- `system_health_score` - 시스템 건강도 점수
- `chat_bottleneck` / `email_bottleneck` / `notification_bottleneck` - 기능별 병목
- `redis_latency` / `kafka_latency` / `db_query_duration` - 인프라별 성능

**부하 패턴**:
```
200 → 500 → 800 → 400 → 1000 → 1500 → 600 → 100 users
(프로덕션 일일 패턴: 오전 → 점심 → 오후 → 저녁 → 심야)
```

**실행 시간**: 약 20분

---

## 🚀 실행 방법

### 사전 준비

1. **k6 설치**
```bash
# Windows (Chocolatey)
choco install k6

# macOS
brew install k6

# Linux
wget https://github.com/grafana/k6/releases/download/v0.48.0/k6-v0.48.0-linux-amd64.tar.gz
tar -xzf k6-v0.48.0-linux-amd64.tar.gz
sudo cp k6-v0.48.0-linux-amd64/k6 /usr/local/bin/
```

2. **k6 Cloud 로그인** (Dashboard 사용)
```bash
k6 login cloud
```

3. **환경 변수 설정** (선택사항)
```bash
# Windows (PowerShell)
$env:BASE_URL="http://your-server-ip:8080"
$env:WS_URL="ws://your-server-ip:8080"

# Linux/macOS
export BASE_URL="http://your-server-ip:8080"
export WS_URL="ws://your-server-ip:8080"
```

---

### 개별 테스트 실행

#### 1️⃣ Email 부하 테스트
```bash
cd tests/k6
k6 cloud email-stress-test-cloud.js
```

**예상 결과**:
- 총 요청 수: ~10,000-15,000 requests
- 평균 TPS: 50-100 req/sec
- P95 지연시간: < 5초

---

#### 2️⃣ Notification 부하 테스트
```bash
cd tests/k6
k6 cloud notification-stress-test-cloud.js
```

**예상 결과**:
- 총 요청 수: ~15,000-20,000 requests
- 평균 TPS: 100-200 req/sec
- P95 지연시간: < 2초
- 버스트 처리: 1000+ concurrent users

---

#### 3️⃣ Chat 부하 테스트
```bash
cd tests/k6
k6 cloud chat-enhanced-stress-test-cloud.js
```

**예상 결과**:
- WebSocket 연결 수: ~1,500
- 총 메시지 수: ~20,000-30,000 messages
- 메시지 손실률: < 1%
- P95 메시지 지연시간: < 2초

---

#### 4️⃣ 통합 부하 테스트 (★ 권장)
```bash
cd tests/k6
k6 cloud integrated-stress-test-cloud.js
```

**예상 결과**:
- 총 요청 수: ~30,000-50,000 requests
- 평균 TPS: 200-400 req/sec
- 시스템 건강도: > 0.8
- 전체 성공률: > 95%

---

### 로컬 테스트 (k6 Cloud 없이)

```bash
# 로컬 실행 (간단한 출력)
k6 run email-stress-test-cloud.js

# HTML 리포트 생성
k6 run --out json=results.json email-stress-test-cloud.js
k6 report results.json --output results.html
```

---

## 📊 메트릭 분석 방법

### k6 Cloud Dashboard 확인

1. **테스트 실행 후 URL 클릭**
```
Test running at: https://app.k6.io/runs/XXXXX
```

2. **주요 탭 확인**
   - **Performance** - 전체 성능 개요
   - **Thresholds** - 임계값 통과 여부
   - **HTTP** - HTTP 요청 분석
   - **WebSocket** - WebSocket 메트릭 (채팅 테스트)
   - **Custom Metrics** - 커스텀 메트릭 (병목 분석 핵심!)

---

### 핵심 메트릭 해석

#### 1. 처리량 (Throughput)

**측정 지표**:
- `http_reqs` - 초당 HTTP 요청 수
- `messages_per_second` - 초당 메시지 수 (채팅)
- `notification_throughput` - 초당 알림 발송 수

**목표 값**:
- Email: 50-100 req/sec
- Notification: 100-200 req/sec
- Chat: 500+ messages/sec

**분석**:
```
처리량이 낮다면?
→ Application Server CPU 사용률 확인
→ Database Connection Pool 크기 확인
→ Kafka Producer 설정 확인 (batch.size, linger.ms)
```

---

#### 2. 지연시간 (Latency)

**측정 지표**:
- `http_req_duration` (p95, p99)
- `message_receive_duration` (end-to-end)
- `email_inbox_duration`
- `notification_send_duration`

**목표 값**:
- P95 < 3초 (대부분의 요청)
- P99 < 5초 (최악의 경우)

**분석**:
```
P95와 P99 차이가 크다면?
→ 일부 요청에서만 심각한 지연 발생
→ N+1 문제 의심
→ DB Slow Query 로그 확인
```

---

#### 3. 병목 지점 (Bottleneck)

**측정 지표**:
- `bottleneck_detected` - 병목 감지 횟수
- `chat_bottleneck` / `email_bottleneck` / `notification_bottleneck`
- `high_latency_requests` - 고지연 요청 수

**분석 방법**:

##### Step 1: 병목 기능 식별
```javascript
// k6 Cloud Dashboard에서 확인
if (chat_bottleneck > email_bottleneck && chat_bottleneck > notification_bottleneck) {
    병목 = "채팅 시스템";
}
```

##### Step 2: 인프라 레이어 분석
```javascript
// 병목이 채팅이라면
redis_latency 확인 → Redis Pub/Sub 병목?
kafka_latency 확인 → Kafka Producer 병목?
ws_connection_duration 확인 → WebSocket 연결 제한?
```

##### Step 3: 근본 원인 파악
```bash
# Redis 성능 확인
redis-cli --latency
redis-cli --stat

# Kafka 성능 확인
kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --all-groups

# Database 성능 확인
SHOW PROCESSLIST;
SHOW ENGINE INNODB STATUS;
```

---

#### 4. N+1 문제 감지

**측정 지표**:
- `db_query_duration` - 쿼리당 평균 시간
- `email_inbox_size` - 받은편지함 이메일 수

**분석**:
```
이메일 개수가 증가할수록 응답 시간이 선형 증가한다면?
→ N+1 문제!

예시:
- 10개 이메일: 500ms
- 20개 이메일: 1000ms
- 30개 이메일: 1500ms

해결:
- @EntityGraph 또는 JOIN FETCH 사용
- Batch Size 설정
```

---

#### 5. Redis 성능 분석

**측정 지표**:
- `redis_latency` - Redis 작업 지연시간
- `cache_hit_rate` - 캐시 히트율

**목표 값**:
- Redis latency: < 10ms (평균), < 50ms (p95)
- Cache hit rate: > 70%

**분석**:
```
캐시 히트율이 낮다면?
→ 캐시 TTL 증가 고려
→ 자주 조회되는 데이터 식별 후 캐싱

Redis 레이턴시가 높다면?
→ Redis 메모리 사용률 확인
→ Redis Slowlog 확인
→ Redis Cluster 고려 (Sharding)
```

---

#### 6. Kafka 성능 분석

**측정 지표**:
- `kafka_latency` - Kafka publish 지연시간
- `messaging_layer_latency` - 메시징 레이어 전체 지연시간

**목표 값**:
- Kafka latency: < 50ms (평균), < 200ms (p95)

**분석**:
```
Kafka 레이턴시가 높다면?
→ Producer 설정 최적화
  - acks=1 (acks=all은 느림)
  - batch.size=16384 이상
  - linger.ms=10-50 (배치 대기 시간)
→ Partition 수 증가 (병렬 처리)
→ Broker 수 증가 (Horizontal Scaling)
```

---

## 🔍 병목 지점 파악

### 병목 분석 프로세스 (시니어 개발자 접근법)

#### Phase 1: 증상 파악 (Symptoms)
```
1. k6 Cloud Dashboard에서 임계값 실패 확인
2. 어느 시점(VU 수)에서 성능 저하가 시작되는지 확인
3. 실패율이 높은 요청 식별
```

#### Phase 2: 병목 레이어 식별 (Layer Identification)
```
Application Layer?
→ CPU 사용률 > 80%?
→ Thread Pool 고갈?

Database Layer?
→ db_query_duration > 1초?
→ Connection Pool 고갈?

Messaging Layer?
→ kafka_latency > 200ms?
→ redis_latency > 50ms?

Network Layer?
→ http_req_duration의 대부분이 waiting 시간?
```

#### Phase 3: 세부 원인 파악 (Root Cause)
```
Application:
→ Profiling (JProfiler, VisualVM)
→ Thread Dump 분석
→ GC 로그 분석

Database:
→ Slow Query Log
→ EXPLAIN 분석
→ Index 누락 확인

Messaging:
→ Kafka Consumer Lag
→ Redis Memory Usage
→ Message Queue Depth
```

#### Phase 4: 해결 방안 수립 (Solution)
```
Quick Win (1주일 이내):
→ Index 추가
→ N+1 쿼리 수정
→ Redis 캐싱 추가

Medium Term (1개월):
→ Database Connection Pool 튜닝
→ Kafka Partition 증가
→ Read Replica 추가

Long Term (3개월):
→ Horizontal Scaling (Pod/Instance 증가)
→ Sharding
→ CQRS 패턴 적용
```

---

## 💡 최적화 권장사항

### 1. 채팅 시스템 (Chat)

#### 병목: WebSocket 연결 수 제한
**증상**: `ws_connection_duration` 증가, `connection_drop_rate` 증가

**해결책**:
```yaml
# Nginx 설정
worker_connections 10000;  # 기본 1024 → 10000

# Application 설정 (Spring Boot)
server:
  tomcat:
    max-connections: 20000
    threads:
      max: 500
```

**예상 효과**: 동시 연결 수 5배 증가

---

#### 병목: Redis Pub/Sub 처리량 부족
**증상**: `message_receive_duration` 증가, `messaging_latency` 증가

**해결책**:
```java
// Redis Cluster 구성 (Sharding)
@Configuration
public class RedisClusterConfig {
    @Bean
    public RedisConnectionFactory redisConnectionFactory() {
        RedisClusterConfiguration config = new RedisClusterConfiguration()
            .clusterNode("redis-node1", 6379)
            .clusterNode("redis-node2", 6379)
            .clusterNode("redis-node3", 6379);
        return new LettuceConnectionFactory(config);
    }
}
```

**예상 효과**: 메시지 처리량 3배 증가

---

#### 병목: 채팅방 목록 N+1 문제
**증상**: `chatroom_load_duration` 증가 (채팅방 개수에 비례)

**해결책**:
```java
// EntityGraph 사용
@EntityGraph(attributePaths = {"participants", "lastMessage"})
List<ChatRoom> findAllWithParticipantsAndLastMessage();

// 또는 Fetch Join
@Query("SELECT DISTINCT cr FROM ChatRoom cr " +
       "LEFT JOIN FETCH cr.participants " +
       "LEFT JOIN FETCH cr.lastMessage")
List<ChatRoom> findAllWithDetails();
```

**예상 효과**: 조회 시간 10배 감소 (1000ms → 100ms)

---

### 2. 이메일 시스템 (Email)

#### 병목: 받은편지함 N+1 문제
**증상**: `email_inbox_duration` 증가, `db_query_duration` 높음

**해결책**:
```java
// Batch Fetch Size 설정
@BatchSize(size = 20)
@OneToMany(mappedBy = "email")
private List<EmailRecipient> recipients;

// EntityGraph 사용
@EntityGraph(attributePaths = {"recipients", "sender", "attachments"})
Page<Email> findInboxEmails(String recipientEmail, Pageable pageable);
```

**예상 효과**: 조회 시간 20배 감소 (2000ms → 100ms)

---

#### 병목: 이메일 발송 속도
**증상**: `email_send_duration` 증가

**해결책**:
```java
// 비동기 처리 + 메시지 큐
@Async
public CompletableFuture<Void> sendEmailAsync(EmailDTO email) {
    kafkaTemplate.send("email-send-topic", email);
    return CompletableFuture.completedFuture(null);
}

// Consumer에서 배치 처리
@KafkaListener(topics = "email-send-topic", containerFactory = "batchFactory")
public void processEmailBatch(List<EmailDTO> emails) {
    emailService.sendBatch(emails);
}
```

**예상 효과**: 동시 발송 가능 메일 수 10배 증가

---

### 3. 알림 시스템 (Notification)

#### 병목: Kafka Producer 처리량 부족
**증상**: `kafka_latency` 증가, `notification_send_duration` 증가

**해결책**:
```yaml
# Kafka Producer 설정
spring:
  kafka:
    producer:
      batch-size: 32768      # 32KB (기본 16KB)
      linger-ms: 20          # 배치 대기 시간
      compression-type: snappy
      acks: 1                # all → 1 (속도 우선)
      buffer-memory: 67108864 # 64MB
```

**예상 효과**: 알림 발송 속도 5배 증가

---

#### 병목: 알림 읽음 처리 느림
**증상**: `notification_read_duration` 증가

**해결책**:
```java
// Redis 캐싱
@Cacheable(value = "notifications", key = "#notificationId")
public Notification getNotification(Integer notificationId) {
    return notificationRepository.findById(notificationId).orElseThrow();
}

@CacheEvict(value = "notifications", key = "#notificationId")
public void markAsRead(Integer notificationId) {
    // 읽음 처리 로직
}
```

**예상 효과**: 조회 시간 50배 감소 (500ms → 10ms)

---

### 4. 통합 시스템 최적화

#### Database Connection Pool
```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 50      # 기본 10 → 50
      minimum-idle: 20           # 최소 유지 연결 수
      connection-timeout: 30000  # 30초
      idle-timeout: 600000       # 10분
```

---

#### Application 서버 스케일 아웃
```bash
# Kubernetes Horizontal Pod Autoscaler
kubectl autoscale deployment coreconnect-api \
  --cpu-percent=70 \
  --min=3 \
  --max=10
```

---

#### Read Replica (읽기 부하 분산)
```yaml
spring:
  datasource:
    master:
      url: jdbc:mysql://master-db:3306/coreconnect
    slave:
      url: jdbc:mysql://slave-db:3306/coreconnect
      
# @Transactional(readOnly = true) → Slave로 자동 라우팅
```

---

## 📈 성능 개선 로드맵

### Phase 1: Quick Wins (1주일)
- [x] N+1 쿼리 수정 (채팅방, 이메일)
- [x] Index 추가 (email.created_at, notification.recipient_id)
- [x] Redis 캐싱 추가 (자주 조회되는 데이터)

**예상 효과**: 평균 응답 시간 50% 감소

---

### Phase 2: Infrastructure (1개월)
- [ ] Kafka Partition 증가 (3 → 10)
- [ ] Redis Cluster 구성 (3 nodes)
- [ ] Database Read Replica 추가 (1 master + 2 slaves)
- [ ] Connection Pool 튜닝

**예상 효과**: 처리량 3배 증가

---

### Phase 3: Architecture (3개월)
- [ ] Horizontal Scaling (Pod 3 → 10)
- [ ] API Gateway + Load Balancer
- [ ] CQRS 패턴 적용 (Command/Query 분리)
- [ ] Event Sourcing (이벤트 기반 아키텍처)

**예상 효과**: 10만 명 동시 접속 가능

---

## 🎓 전문가 팁

### 시니어 개발자의 성능 최적화 원칙

1. **측정 먼저, 최적화는 나중에**
   - 추측하지 말고 측정하라
   - 병목이 확실할 때만 최적화

2. **80/20 법칙**
   - 20%의 코드가 80%의 성능 문제를 일으킴
   - 가장 큰 병목부터 해결

3. **비용 대비 효과**
   - Quick Win → Medium Term → Long Term 순서로
   - ROI가 높은 것부터 우선순위

4. **모니터링은 필수**
   - 최적화 후 반드시 재측정
   - 지속적 모니터링 (Grafana + Prometheus)

5. **Scale-Up vs Scale-Out**
   - Stateless 서비스: Scale-Out (Horizontal)
   - Database: Scale-Up (Vertical) + Read Replica

---

## 📞 문의 및 지원

- **작성자**: 20년차 Spring 백엔드 시니어 개발자
- **전문 분야**: 성능 최적화, Redis, Kafka, 채팅/알림/메일 시스템
- **GitHub**: [Your GitHub]
- **Email**: [Your Email]

---

## 📚 참고 자료

- [k6 Documentation](https://k6.io/docs/)
- [Redis Performance Tuning](https://redis.io/docs/management/optimization/)
- [Kafka Performance Tuning](https://kafka.apache.org/documentation/#tuning)
- [Spring Boot Performance Tuning](https://docs.spring.io/spring-boot/docs/current/reference/html/production-ready-features.html)

---

**작성 완료일**: 2026-01-18  
**버전**: 1.0  
**다음 업데이트**: 테스트 실행 후 실제 결과 반영
