# CoreConnect k6 성능 테스트 가이드

이 디렉토리는 CoreConnect 프로젝트의 채팅, 알림, 이메일 기능에 대한 k6 부하 테스트 스크립트를 포함합니다.

## 목차
1. [사전 준비](#사전-준비)
2. [테스트 구조](#테스트-구조)
3. [테스트 실행 방법](#테스트-실행-방법)
4. [테스트 시나리오](#테스트-시나리오)
5. [성능 지표 분석](#성능-지표-분석)
6. [성능 개선 방법](#성능-개선-방법)
7. [문제 해결](#문제-해결)

---

## 사전 준비

### 1. k6 설치

#### Windows
```bash
# Chocolatey 사용
choco install k6

# 또는 winget 사용
winget install k6
```

#### macOS
```bash
brew install k6
```

#### Linux
```bash
# Debian/Ubuntu
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

설치 확인:
```bash
k6 version
```

### 2. 테스트 환경 설정

#### 2.1 테스트 사용자 생성
실제 테스트를 실행하기 전에 테스트용 사용자 계정을 생성해야 합니다.

`config.js` 파일의 `TEST_USERS` 배열을 실제 환경에 맞게 수정하세요:

```javascript
export const TEST_USERS = [
  { email: 'test1@coreconnect.com', password: 'password123' },
  { email: 'test2@coreconnect.com', password: 'password123' },
  // ... 더 많은 사용자 추가
];
```

#### 2.2 환경 변수 설정
테스트 대상 서버 URL을 설정합니다:

```bash
# Windows PowerShell
$env:BASE_URL="http://localhost:8080"
$env:WS_URL="ws://localhost:8080"

# Linux/macOS
export BASE_URL="http://localhost:8080"
export WS_URL="ws://localhost:8080"
```

#### 2.3 서버 준비
- 백엔드 서버가 실행 중이어야 합니다
- 데이터베이스가 정상 작동해야 합니다
- SendGrid 이메일 서비스가 설정되어 있어야 합니다 (이메일 테스트의 경우)

---

## 테스트 구조

```
performance-tests/
├── config.js                          # 공통 설정 (시나리오, 임계값, 테스트 사용자)
├── chat-test.js                       # 채팅 기능 부하 테스트
├── notification-test.js               # 알림 기능 부하 테스트
├── email-test.js                      # 이메일 기능 부하 테스트
├── chatroom-list-n-plus-1-test.js    # 📊 채팅방 목록 N+1 문제 측정 (NEW!)
├── run-chatroom-list-test.sh         # 채팅방 목록 테스트 실행 스크립트 (Linux/Mac)
├── run-chatroom-list-test.bat        # 채팅방 목록 테스트 실행 스크립트 (Windows)
├── 채팅방_목록_N+1_측정_빠른시작.md  # 3분 만에 AS-IS vs TO-BE 측정
└── README.md                          # 이 문서
```

### 주요 파일 설명

- **config.js**: 모든 테스트 스크립트에서 공유하는 설정
  - 테스트 시나리오 정의 (smoke, load, stress, spike)
  - 성능 임계값 (thresholds)
  - 테스트 사용자 정보
  - API URL 설정

- **chat-test.js**: 채팅 기능 테스트
  - REST API를 통한 채팅방 생성 및 메시지 전송
  - WebSocket STOMP를 통한 실시간 채팅
  - 메시지 조회 및 미읽은 메시지 개수 확인

- **notification-test.js**: 알림 기능 테스트
  - REST API를 통한 알림 조회 및 읽음 처리
  - WebSocket을 통한 실시간 알림 수신
  - 알림 발송 및 지연시간 측정

- **email-test.js**: 이메일 기능 테스트
  - 이메일 발송 (SendGrid)
  - 받은메일함/보낸메일함 조회
  - 임시저장, 휴지통, 중요 메일 관리

- **chatroom-list-n-plus-1-test.js**: 📊 채팅방 목록 N+1 문제 측정 (NEW!)
  - 채팅방 목록 조회 API 전용 부하 테스트
  - AS-IS (N+1 발생) vs TO-BE (Fetch Join 적용) 비교
  - 응답 시간, TPS, DB 쿼리 시간 측정
  - K6 Cloud Grafana 대시보드 자동 생성
  - **빠른 시작**: [채팅방_목록_N+1_측정_빠른시작.md](./채팅방_목록_N+1_측정_빠른시작.md)
  - **상세 가이드**: [채팅방_목록_N+1_K6_측정_가이드.md](../채팅방_목록_N+1_K6_측정_가이드.md)

---

## 테스트 실행 방법

### 1. 스모크 테스트 (Smoke Test)
가장 가벼운 부하로 시스템이 정상 작동하는지 확인합니다.

**설정**: 5명의 가상 사용자, 1분간 실행

```bash
# 채팅 기능 스모크 테스트
k6 run chat-test.js

# 알림 기능 스모크 테스트
k6 run notification-test.js

# 이메일 기능 스모크 테스트
k6 run email-test.js

# 📊 채팅방 목록 N+1 문제 측정 (NEW!)
./run-chatroom-list-test.sh cloud   # K6 Cloud로 실행
# 또는 Windows: run-chatroom-list-test.bat cloud
```

### 2. 부하 테스트 (Load Test)
예상되는 정상 부하에서 시스템 성능을 측정합니다.

**설정**: 0 → 50 → 100명까지 증가, 총 16분

```bash
k6 run chat-test.js
k6 run notification-test.js
k6 run email-test.js
```

### 3. 스트레스 테스트 (Stress Test)
시스템의 한계를 찾아냅니다.

**설정**: 0 → 100 → 200 → 300명까지 증가, 총 24분

먼저 `config.js`에서 시나리오를 변경:
```javascript
// chat-test.js, notification-test.js, email-test.js에서
scenarios: {
  test: SCENARIOS.stress,  // load → stress로 변경
}
```

그 후 실행:
```bash
k6 run chat-test.js
```

### 4. 스파이크 테스트 (Spike Test)
급격한 트래픽 증가에 대한 대응 능력을 테스트합니다.

**설정**: 10초 만에 500명까지 급증

`config.js`에서 시나리오 변경:
```javascript
scenarios: {
  test: SCENARIOS.spike,
}
```

### 5. 특정 가상 사용자 수로 테스트
명령줄에서 직접 VU 수를 지정할 수 있습니다:

```bash
# 100명의 사용자로 5분간 테스트
k6 run --vus 100 --duration 5m chat-test.js

# 환경 변수와 함께 실행
k6 run --vus 50 --duration 3m --env BASE_URL=http://production-server.com email-test.js
```

### 6. 결과를 파일로 저장
```bash
# JSON 형식으로 결과 저장
k6 run --out json=results.json chat-test.js

# CSV 형식으로 결과 저장
k6 run --out csv=results.csv chat-test.js

# InfluxDB로 결과 전송 (모니터링 대시보드 구축 시)
k6 run --out influxdb=http://localhost:8086/k6 chat-test.js
```

### 7. 통합 테스트 (모든 기능 동시 테스트)
세 개의 터미널에서 동시에 실행:

```bash
# 터미널 1
k6 run chat-test.js

# 터미널 2
k6 run notification-test.js

# 터미널 3
k6 run email-test.js
```

---

## 테스트 시나리오

### Smoke Test (스모크 테스트)
- **목적**: 시스템이 기본적으로 작동하는지 확인
- **VU**: 5명
- **Duration**: 1분
- **사용 시기**: 새로운 빌드 배포 후 즉시

### Load Test (부하 테스트)
- **목적**: 정상 부하 상태에서 성능 측정
- **VU**: 0 → 50 (2분) → 50 유지 (5분) → 100 (2분) → 100 유지 (5분) → 0 (2분)
- **Duration**: 16분
- **사용 시기**: 정기적인 성능 검증

### Stress Test (스트레스 테스트)
- **목적**: 시스템의 한계점 찾기
- **VU**: 0 → 100 → 200 → 300
- **Duration**: 24분
- **사용 시기**: 용량 계획 수립 시

### Spike Test (스파이크 테스트)
- **목적**: 급격한 트래픽 증가 대응 능력 확인
- **VU**: 10초 만에 100 → 500으로 급증
- **Duration**: 약 8분
- **사용 시기**: 이벤트 또는 프로모션 전

---

## 성능 지표 분석

### 1. 주요 메트릭

#### HTTP 요청 메트릭
- `http_reqs`: 총 요청 수
- `http_req_failed`: 실패한 요청 비율
- `http_req_duration`: 응답 시간
  - **avg**: 평균 응답 시간
  - **p(95)**: 95% 요청의 응답 시간 (목표: < 500ms)
  - **p(99)**: 99% 요청의 응답 시간 (목표: < 1000ms)

#### WebSocket 메트릭
- `ws_connecting`: WebSocket 연결 시간
- `ws_session_duration`: WebSocket 세션 지속 시간

#### 커스텀 메트릭

**채팅 테스트**:
- `chat_messages_sent`: 전송된 메시지 수
- `chat_messages_received`: 수신된 메시지 수
- `chat_rooms_created`: 생성된 채팅방 수
- `chat_message_latency`: 메시지 지연시간

**알림 테스트**:
- `notifications_sent`: 전송된 알림 수
- `notifications_received`: 수신된 알림 수
- `notification_latency`: 알림 지연시간
- `notification_read_operations`: 읽음 처리 작업 수

**이메일 테스트**:
- `emails_sent`: 발송된 이메일 수
- `emails_received`: 조회된 이메일 수
- `email_send_latency`: 이메일 발송 시간
- `email_send_success_rate`: 이메일 발송 성공률 (목표: > 95%)

### 2. 성능 목표 (Thresholds)

```javascript
// 모든 테스트 공통
http_req_failed: ['rate<0.01']        // 실패율 1% 미만
http_req_duration: ['p(95)<500']      // 95% 요청이 500ms 이내
http_req_duration: ['p(99)<1000']     // 99% 요청이 1000ms 이내

// 이메일 테스트 추가
email_send_latency: ['p(95)<2000']    // 95% 이메일이 2초 이내 발송
email_send_success_rate: ['rate>0.95'] // 95% 이상 발송 성공

// 알림 테스트 추가
notification_latency: ['p(95)<1000']  // 95% 알림이 1초 이내 전달
```

### 3. 결과 해석

#### 성공 예시
```
✓ http_req_duration..............: avg=234ms  p(95)=456ms  p(99)=789ms
✓ http_req_failed................: 0.12%
✓ chat_message_latency...........: avg=123ms  p(95)=345ms
```
→ 모든 지표가 목표를 만족하므로 성능 OK

#### 실패 예시
```
✗ http_req_duration..............: avg=1234ms  p(95)=2456ms  p(99)=5789ms
✗ http_req_failed................: 5.12%
✗ email_send_success_rate........: 87%
```
→ 응답 시간 초과, 실패율 높음, 이메일 발송 성공률 낮음 → 성능 개선 필요

---

## 성능 개선 방법

### 1. 데이터베이스 최적화

#### 인덱스 추가
```sql
-- 채팅 메시지 조회 성능 개선
CREATE INDEX idx_chat_room_id ON chat(chat_room_id);
CREATE INDEX idx_chat_send_at ON chat(send_at DESC);

-- 알림 조회 성능 개선
CREATE INDEX idx_notification_user_read ON notification(user_id, notification_read_yn);
CREATE INDEX idx_notification_sent_at ON notification(notification_sent_at DESC);

-- 이메일 조회 성능 개선
CREATE INDEX idx_email_recipient_read ON email_recipient(email, email_read_yn);
CREATE INDEX idx_email_sent_time ON email(email_sent_time DESC);
```

#### 쿼리 최적화
- N+1 문제 해결: `@EntityGraph` 또는 `JOIN FETCH` 사용
- 페이징 쿼리 최적화: `LIMIT`, `OFFSET` 대신 커서 기반 페이징 고려
- 불필요한 컬럼 조회 방지: `SELECT *` 대신 필요한 컬럼만 조회

### 2. 캐싱 전략

#### Redis 캐시 적용
```java
// 읽기가 많은 데이터에 캐싱 적용
@Cacheable(value = "chatRoom", key = "#roomId")
public ChatRoomResponseDTO getChatRoom(Long roomId) {
    // ...
}

@Cacheable(value = "unreadCount", key = "#userId")
public Integer getUnreadNotificationCount(Long userId) {
    // ...
}

// 쓰기 시 캐시 무효화
@CacheEvict(value = "chatRoom", key = "#roomId")
public void sendMessage(Long roomId, ChatMessage message) {
    // ...
}
```

### 3. 비동기 처리

#### 이메일 발송 비동기화
```java
@Async
public CompletableFuture<Void> sendEmailAsync(EmailSendRequestDTO request) {
    sendGridEmailSender.send(request);
    return CompletableFuture.completedFuture(null);
}
```

#### 알림 발송 비동기화
```java
@Async
@Transactional(propagation = Propagation.REQUIRES_NEW)
public void sendNotificationAsync(NotificationDTO notification) {
    // 알림 저장
    notificationRepository.save(notification);

    // WebSocket 전송
    webSocketDeliveryService.sendToUser(notification);
}
```

### 4. 커넥션 풀 최적화

#### application.yml 설정
```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20      # 동시 접속자 수에 맞게 조정
      minimum-idle: 5
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000
```

### 5. WebSocket 최적화

#### STOMP 메시지 브로커 설정
```java
@Override
public void configureMessageBroker(MessageBrokerRegistry config) {
    config.enableSimpleBroker("/topic", "/queue")
        .setTaskScheduler(taskScheduler())
        .setHeartbeatValue(new long[]{10000, 10000}); // 심박 간격 설정

    config.setApplicationDestinationPrefixes("/app");
}
```

#### WebSocket 세션 관리
```java
// 메모리 누수 방지: 연결 해제 시 세션 정리
@Override
public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
    String userId = extractUserId(session);
    userSessions.remove(userId);
}
```

### 6. 페이징 최적화

#### 무한 스크롤을 위한 커서 기반 페이징
```java
// Offset 기반 페이징 (느림)
SELECT * FROM email ORDER BY email_sent_time DESC LIMIT 20 OFFSET 1000;

// 커서 기반 페이징 (빠름)
SELECT * FROM email WHERE email_sent_time < ? ORDER BY email_sent_time DESC LIMIT 20;
```

### 7. 모니터링 및 로깅

#### 성능 메트릭 로깅
```java
// AOP를 이용한 메서드 실행 시간 측정
@Around("@annotation(PerformanceLog)")
public Object logPerformance(ProceedingJoinPoint joinPoint) throws Throwable {
    long start = System.currentTimeMillis();

    Object result = joinPoint.proceed();

    long duration = System.currentTimeMillis() - start;
    log.info("[METRICS] {}.{}() duration={}ms",
        joinPoint.getTarget().getClass().getSimpleName(),
        joinPoint.getSignature().getName(),
        duration);

    return result;
}
```

#### APM 도구 사용
- Spring Boot Actuator + Prometheus + Grafana
- New Relic, Datadog 등의 APM 서비스

### 8. 스케일 아웃

#### 로드 밸런서 구성
```
클라이언트
    ↓
Nginx/HAProxy (로드 밸런서)
    ↓
Spring Boot 인스턴스 1
Spring Boot 인스턴스 2
Spring Boot 인스턴스 3
```

#### 세션 클러스터링
```yaml
spring:
  session:
    store-type: redis  # Redis를 이용한 세션 공유
```

---

## 문제 해결

### 1. 토큰 인증 실패
**증상**: 모든 요청이 401 Unauthorized 에러

**해결**:
- `config.js`의 `getAuthToken()` 함수에서 토큰 추출 로직 확인
- API 응답 구조에 맞게 수정:
  ```javascript
  // 헤더에서 토큰을 받는 경우
  return response.headers['Authorization'];

  // Body에서 토큰을 받는 경우
  const body = JSON.parse(response.body);
  return body.token || body.accessToken;
  ```

### 2. WebSocket 연결 실패
**증상**: WebSocket 연결이 안 됨 (status != 101)

**해결**:
- CORS 설정 확인
- WebSocket URL 확인 (`ws://` vs `wss://`)
- 토큰 전달 방식 확인 (쿼리 파라미터 vs 헤더)
  ```javascript
  // 쿼리 파라미터로 토큰 전달
  const wsUrl = `${WS_URL}/ws/chat?token=${token}`;

  // 헤더로 토큰 전달
  const options = {
    headers: { 'Authorization': `Bearer ${token}` }
  };
  ws.connect(wsUrl, options, function (socket) { ... });
  ```

### 3. 테스트 사용자 부족
**증상**: 테스트 중 로그인 실패가 많이 발생

**해결**:
- `config.js`의 `TEST_USERS` 배열에 더 많은 사용자 추가
- 데이터베이스에 테스트 사용자 계정 생성

### 4. 채팅방 ID가 없음
**증상**: `채팅방 ID 없음, 테스트 중단` 에러

**해결**:
- 테스트 전에 미리 채팅방 생성
- `chat-test.js`에서 기본 roomId를 실제 존재하는 ID로 변경:
  ```javascript
  } else {
    roomId = 1; // 실제 존재하는 채팅방 ID로 변경
  }
  ```

### 5. 이메일 발송 실패
**증상**: 이메일 발송 성공률이 낮음

**해결**:
- SendGrid API 키 확인
- SendGrid 발송 제한 확인 (무료 플랜은 하루 100통)
- 테스트 시나리오에서 이메일 발송 확률 낮추기:
  ```javascript
  if (Math.random() < 0.1) {  // 30% → 10%로 낮춤
    sendEmail(...);
  }
  ```

### 6. 성능 목표 미달성
**증상**: 임계값(thresholds)을 충족하지 못함

**해결**:
1. 로그 분석: 어떤 API가 느린지 확인
2. 데이터베이스 쿼리 분석: Slow Query Log 확인
3. 서버 리소스 확인: CPU, 메모리 사용률
4. [성능 개선 방법](#성능-개선-방법) 섹션 참고

### 7. 메모리 부족
**증상**: 테스트 중 서버 메모리 부족

**해결**:
- JVM 힙 메모리 증가:
  ```bash
  java -Xms512m -Xmx2048m -jar app.jar
  ```
- 커넥션 풀 크기 조정
- 불필요한 객체 생성 줄이기

---

## 추가 리소스

### k6 공식 문서
- [k6 Docs](https://k6.io/docs/)
- [k6 Examples](https://k6.io/docs/examples/)
- [WebSocket Testing](https://k6.io/docs/using-k6/protocols/websockets/)

### 성능 테스트 모범 사례
- [Google SRE Book - Load Testing](https://sre.google/workbook/load-testing/)
- [Martin Fowler - Performance Testing](https://martinfowler.com/bliki/PerformanceTest.html)

### 모니터링 도구
- [Grafana k6 Dashboard](https://grafana.com/grafana/dashboards/2587)
- [Spring Boot Actuator](https://docs.spring.io/spring-boot/docs/current/reference/html/actuator.html)

---

## 연락처
성능 테스트 관련 문의: [담당자 이메일]
