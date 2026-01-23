# 채팅 시스템 부하 테스트 계획서

## 📋 테스트 개요

**목적:** Redis Pub/Sub 및 Kafka 도입 전후 성능 비교 및 개선 효과 측정

**대상 시스템:**
- 채팅 서비스 (WebSocket 기반)
- 알림 서비스 (실시간 Push)

**테스트 환경:**
- Kubernetes 3 Pods
- CPU: 200m request, 1000m limit
- Memory: 512Mi request, 1Gi limit

---

## 🎯 핵심 성능 지표 (KPI)

### 1. 처리량 (Throughput)

| 지표 | 측정 항목 | 목표 (Redis 전) | 목표 (Redis 후) | 목표 (Kafka 후) |
|------|----------|----------------|----------------|----------------|
| **메시지 TPS** | 초당 메시지 전송 수 | 500 TPS | 2,000 TPS | 10,000 TPS |
| **알림 TPS** | 초당 알림 발송 수 | 200 TPS | 1,000 TPS | 5,000 TPS |
| **동시 WebSocket 연결** | 활성 연결 수 | 1,500개 | 3,000개 | 10,000개 |
| **채팅방 생성/초** | 초당 생성 수 | 10/s | 50/s | 200/s |

**측정 방법:**
```bash
# k6 스크립트
export let TPS = new Counter('messages_per_second');

export default function() {
    ws.send(JSON.stringify(message));
    TPS.add(1);
}
```

---

### 2. 응답 시간 (Latency)

| 지표 | 측정 항목 | 목표 (Redis 전) | 목표 (Redis 후) | 목표 (Kafka 후) |
|------|----------|----------------|----------------|----------------|
| **메시지 전송 → 저장** | End-to-End 시간 | 50-100ms | 5-10ms | 5-10ms |
| **메시지 전송 → 수신** | 실시간 전달 시간 | 100-200ms | 10-20ms | 15-25ms |
| **알림 발송 지연** | 이벤트 → 알림 도달 | 200-500ms | 50-100ms | 20-50ms |
| **채팅방 목록 조회** | API 응답 시간 | 50-100ms | 5-10ms | 5-10ms |
| **메시지 히스토리 조회** | 100개 메시지 로드 | 100-200ms | 10-20ms | 10-20ms |

**측정 항목 (백분위수):**
- **P50 (중간값)**: 50%의 요청이 이 시간 이하
- **P95**: 95%의 요청이 이 시간 이하
- **P99**: 99%의 요청이 이 시간 이하
- **Max**: 최대 지연 시간

**측정 방법:**
```javascript
// k6 스크립트
import { Trend } from 'k6/metrics';
let messageSendTime = new Trend('message_send_duration');

export default function() {
    let start = Date.now();
    ws.send(message);
    // ... 응답 대기
    messageSendTime.add(Date.now() - start);
}
```

**목표:**
```
P50: < 10ms
P95: < 50ms
P99: < 100ms
Max: < 500ms
```

---

### 3. 안정성 (Reliability)

| 지표 | 측정 항목 | 목표 (Redis 전) | 목표 (Redis 후) | 목표 (Kafka 후) |
|------|----------|----------------|----------------|----------------|
| **메시지 유실률** | 전송 vs 수신 비율 | < 1% | < 0.1% | < 0.001% |
| **에러율** | 실패한 요청 비율 | < 5% | < 1% | < 0.5% |
| **타임아웃률** | 30초 초과 요청 | < 3% | < 0.5% | < 0.1% |
| **WebSocket 재연결률** | 연결 끊김 비율 | < 10% | < 2% | < 1% |

**측정 방법:**
```javascript
let successCount = 0;
let failureCount = 0;
let lostMessages = 0;

export default function() {
    try {
        ws.send(message);
        successCount++;
        
        // 수신 확인
        if (!receivedMessageIds.has(messageId)) {
            lostMessages++;
        }
    } catch (e) {
        failureCount++;
    }
}

export function handleSummary(data) {
    let errorRate = (failureCount / (successCount + failureCount)) * 100;
    let lossRate = (lostMessages / successCount) * 100;
    
    console.log(`Error Rate: ${errorRate}%`);
    console.log(`Message Loss Rate: ${lossRate}%`);
}
```

---

### 4. 리소스 사용량 (Resource Utilization)

| 지표 | 측정 항목 | 허용 범위 | 알림 임계값 | 위험 임계값 |
|------|----------|----------|-----------|-----------|
| **CPU 사용률** | Pod CPU % | < 70% | 70% | 85% |
| **Memory 사용률** | Pod Memory % | < 80% | 80% | 90% |
| **DB Connection Pool** | 활성 연결 수 | < 80% | 24/30 | 28/30 |
| **Redis Memory** | 사용 메모리 | < 80% | 800MB/1GB | 950MB/1GB |
| **Network I/O** | 초당 전송량 | < 100MB/s | 80MB/s | 95MB/s |

**측정 방법:**
```bash
# Kubernetes Metrics
kubectl top pods -n chat-system -l app=chat-service

# Prometheus Query (설치 시)
rate(container_cpu_usage_seconds_total[5m])
container_memory_usage_bytes

# Application Metrics
curl http://pod-ip:8080/actuator/metrics/hikari.connections.active
curl http://pod-ip:8080/actuator/metrics/jvm.memory.used
```

---

### 5. 동시성 (Concurrency)

| 지표 | 측정 항목 | 목표 (Redis 전) | 목표 (Redis 후) | 목표 (Kafka 후) |
|------|----------|----------------|----------------|----------------|
| **동시 접속 사용자** | WebSocket 연결 | 1,500명 | 3,000명 | 10,000명 |
| **동시 채팅방 수** | 활성 채팅방 | 200개 | 500개 | 2,000개 |
| **채팅방당 동시 사용자** | 방별 최대 인원 | 50명 | 200명 | 1,000명 |
| **동시 메시지 전송** | 병렬 처리 수 | 500/s | 2,000/s | 10,000/s |

---

## 🧪 테스트 시나리오

### **시나리오 1: 일반 채팅 (Baseline Test)**

**목표:** 정상 상황에서의 기본 성능 측정

**설정:**
```yaml
Virtual Users: 1,000명
Duration: 10분
Ramp-up: 5분 (점진적 증가)

행동 패턴:
- 로그인
- 채팅방 3개 참여
- 5초마다 메시지 1개 전송
- 10초마다 채팅방 목록 조회
- 30초마다 메시지 히스토리 조회
```

**측정 지표:**
```
✅ P50/P95/P99 응답 시간
✅ 평균 TPS
✅ 에러율
✅ CPU/Memory 사용률
```

**k6 스크립트:**
```javascript
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

export let options = {
    vus: 1000,
    duration: '10m',
    rampingVus: [
        { duration: '5m', target: 1000 },
        { duration: '5m', target: 1000 },
    ],
};

let messageSendTime = new Trend('message_send_duration');
let messagesReceived = new Counter('messages_received');

export default function() {
    let url = 'ws://your-service/ws';
    
    ws.connect(url, {}, function(socket) {
        socket.on('open', () => {
            // 채팅방 참여
            socket.send(JSON.stringify({
                type: 'JOIN_ROOM',
                roomId: Math.floor(Math.random() * 100)
            }));
        });
        
        socket.on('message', (data) => {
            messagesReceived.add(1);
        });
        
        // 5초마다 메시지 전송
        socket.setInterval(() => {
            let start = Date.now();
            socket.send(JSON.stringify({
                type: 'SEND_MESSAGE',
                content: 'Test message'
            }));
            messageSendTime.add(Date.now() - start);
        }, 5000);
        
        socket.setTimeout(() => {
            socket.close();
        }, 600000); // 10분
    });
}
```

---

### **시나리오 2: 스트레스 테스트 (Stress Test)**

**목표:** 시스템 한계점 파악

**설정:**
```yaml
Virtual Users: 100 → 5,000명 (점진적 증가)
Duration: 20분
Ramp-up: 계단식 증가

단계:
- 0-5분: 1,000명
- 5-10분: 2,000명
- 10-15분: 3,000명
- 15-20분: 5,000명

행동 패턴:
- 적극적 채팅 (초당 1개 메시지)
- 대규모 그룹 채팅 (100명 참여)
```

**측정 지표:**
```
✅ Breaking Point (시스템 한계점)
✅ 사용자 수별 응답 시간 변화
✅ 에러율 증가 추이
✅ Pod Auto-scaling 동작 여부
```

**k6 스크립트:**
```javascript
export let options = {
    stages: [
        { duration: '5m', target: 1000 },
        { duration: '5m', target: 2000 },
        { duration: '5m', target: 3000 },
        { duration: '5m', target: 5000 },
    ],
    thresholds: {
        'http_req_duration': ['p(95)<200', 'p(99)<500'],
        'ws_session_duration': ['avg<1000'],
        'messages_received': ['count>100000'],
    },
};
```

---

### **시나리오 3: 스파이크 테스트 (Spike Test)**

**목표:** 갑작스러운 트래픽 폭증 대응 능력 측정

**설정:**
```yaml
Virtual Users: 
- 평소: 500명
- 스파이크: 5,000명 (10배 증가)
- 지속: 2분
- 복귀: 500명

트리거 상황:
- 긴급 공지 발송
- 이벤트 시작
- 뉴스 알림
```

**측정 지표:**
```
✅ 스파이크 시 응답 시간 변화
✅ 복구 시간 (Recovery Time)
✅ 에러율 변화
✅ Auto-scaling 반응 속도
```

**k6 스크립트:**
```javascript
export let options = {
    stages: [
        { duration: '2m', target: 500 },   // 평소
        { duration: '1m', target: 5000 },  // 스파이크
        { duration: '2m', target: 5000 },  // 유지
        { duration: '1m', target: 500 },   // 복귀
        { duration: '2m', target: 500 },   // 안정화
    ],
};
```

---

### **시나리오 4: 지속성 테스트 (Endurance Test)**

**목표:** 장시간 운영 시 메모리 누수, 성능 저하 확인

**설정:**
```yaml
Virtual Users: 2,000명 (일정)
Duration: 2-4시간
행동 패턴: 일반 채팅
```

**측정 지표:**
```
✅ 시간별 응답 시간 변화
✅ 메모리 사용량 추이 (메모리 누수 확인)
✅ DB Connection Pool 안정성
✅ 성능 저하율 (Degradation Rate)
```

---

### **시나리오 5: 대규모 그룹 채팅 (Group Chat Test)**

**목표:** 1:N 메시지 브로드캐스트 성능 측정

**설정:**
```yaml
그룹 채팅방:
- 50명 참여 × 10개 방
- 100명 참여 × 5개 방
- 500명 참여 × 2개 방

메시지 전송:
- 각 방에서 초당 10개 메시지
```

**측정 지표:**
```
✅ 브로드캐스트 지연 시간
✅ 마지막 사용자 수신 시간
✅ 메시지 유실률 (특히 대규모 방)
✅ Pod별 부하 분산
```

**k6 스크립트:**
```javascript
export default function() {
    let roomSize = [50, 100, 500][Math.floor(Math.random() * 3)];
    let roomId = `large-room-${roomSize}`;
    
    ws.connect(url, {}, function(socket) {
        socket.send(JSON.stringify({
            type: 'JOIN_ROOM',
            roomId: roomId
        }));
        
        // 메시지 전송 및 수신 시간 측정
        let sentTimestamps = {};
        
        socket.setInterval(() => {
            let msgId = uuidv4();
            sentTimestamps[msgId] = Date.now();
            
            socket.send(JSON.stringify({
                type: 'SEND_MESSAGE',
                messageId: msgId,
                content: 'Test'
            }));
        }, Math.random() * 10000);
        
        socket.on('message', (data) => {
            let msg = JSON.parse(data);
            if (sentTimestamps[msg.id]) {
                let latency = Date.now() - sentTimestamps[msg.id];
                broadcastLatency.add(latency);
            }
        });
    });
}
```

---

### **시나리오 6: 알림 폭주 (Notification Burst)**

**목표:** 대량 알림 발송 시 성능 측정

**설정:**
```yaml
알림 유형:
- 1:1 메시지 알림 (5,000개/초)
- 그룹 멘션 알림 (100명 × 50회)
- 시스템 공지 (전체 사용자)

측정 포인트:
- 알림 생성 → 발송 시간
- 발송 → 도달 시간
- 총 처리 시간
```

---

## 📊 측정 도구 및 방법

### **1. 부하 생성 도구**

#### **k6 (권장)**
```bash
# 설치
choco install k6

# 실행
k6 run --vus 1000 --duration 10m chat-load-test.js

# 결과 수집
k6 run --out influxdb=http://localhost:8086/k6 test.js
```

**장점:**
- JavaScript 기반, 간단한 문법
- WebSocket 지원
- Grafana 연동 가능
- 클라우드 실행 가능

---

#### **JMeter**
```bash
# WebSocket Plugin 설치 필요
# GUI에서 테스트 계획 작성

jmeter -n -t chat-test.jmx -l results.jtl -e -o report/
```

**장점:**
- GUI 기반 시각적 구성
- 다양한 플러그인
- 상세한 리포트

---

#### **Gatling**
```scala
// Scala 기반
val scn = scenario("Chat Load Test")
    .exec(ws("Connect").connect("ws://..."))
    .exec(ws("Send Message").sendText("""{"type":"SEND"}"""))

setUp(scn.inject(rampUsers(1000) during (5.minutes)))
```

---

### **2. 모니터링 도구**

#### **Prometheus + Grafana**
```yaml
# 메트릭 수집
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
data:
  prometheus.yml: |
    scrape_configs:
    - job_name: 'chat-service'
      kubernetes_sd_configs:
      - role: pod
        namespaces:
          names: [chat-system]
      metrics_path: /actuator/prometheus
```

**수집 메트릭:**
```
✅ JVM 메모리 사용량
✅ HTTP 요청 수/응답 시간
✅ DB Connection Pool 상태
✅ Redis 명령어 수/응답 시간
✅ Custom Metrics (메시지 전송/수신 수)
```

---

#### **Application Metrics (Spring Boot Actuator)**
```java
@Component
public class ChatMetrics {
    private final MeterRegistry registry;
    
    public void recordMessageSent(String roomId) {
        registry.counter("chat.messages.sent", 
            "room", roomId).increment();
    }
    
    public void recordMessageLatency(long latency) {
        registry.timer("chat.message.latency")
            .record(latency, TimeUnit.MILLISECONDS);
    }
}
```

**엔드포인트:**
```
GET /actuator/metrics/chat.messages.sent
GET /actuator/metrics/chat.message.latency
GET /actuator/metrics/hikari.connections.active
```

---

## 📋 테스트 체크리스트

### **Before Test (사전 준비)**

- [ ] 테스트 환경 분리 (Production과 격리)
- [ ] 모니터링 도구 설치 (Prometheus, Grafana)
- [ ] 데이터베이스 백업
- [ ] Pod Auto-scaling 설정 (HPA)
- [ ] 알림 수신자 준비 (테스트 계정)
- [ ] 베이스라인 측정 (부하 없을 때 성능)

---

### **During Test (테스트 진행 중)**

- [ ] 실시간 메트릭 모니터링
- [ ] Pod 상태 확인 (`kubectl get pods -w`)
- [ ] 로그 수집 (`kubectl logs -f`)
- [ ] 에러 발생 시 즉시 기록
- [ ] 네트워크 트래픽 모니터링
- [ ] DB 쿼리 성능 모니터링

---

### **After Test (테스트 후)**

- [ ] 모든 메트릭 데이터 수집
- [ ] 로그 분석 (에러, 경고)
- [ ] 리소스 사용 추이 그래프 생성
- [ ] 병목 지점 식별
- [ ] 개선 방안 도출
- [ ] 리포트 작성

---

## 📈 성능 비교 리포트 템플릿

### **1. 처리량 비교**

| 시나리오 | Redis 전 (TPS) | Redis 후 (TPS) | Kafka 후 (TPS) | 개선율 |
|----------|---------------|---------------|---------------|--------|
| 일반 채팅 (1,000명) | 450 | 1,800 | 8,500 | 300% / 1,789% |
| 대규모 그룹 (500명) | 300 | 1,200 | 6,000 | 300% / 1,900% |
| 스파이크 (5,000명) | ❌ 실패 | 800 | 10,000 | N/A / N/A |

---

### **2. 응답 시간 비교 (P95)**

| 작업 | Redis 전 | Redis 후 | Kafka 후 | 개선율 |
|------|----------|----------|----------|--------|
| 메시지 전송 | 120ms | 15ms | 12ms | 87.5% / 90% |
| 메시지 수신 | 180ms | 25ms | 20ms | 86% / 89% |
| 채팅방 목록 | 90ms | 8ms | 8ms | 91% / 91% |
| 알림 발송 | 350ms | 80ms | 35ms | 77% / 90% |

---

### **3. 안정성 비교**

| 지표 | Redis 전 | Redis 후 | Kafka 후 |
|------|----------|----------|----------|
| 메시지 유실률 | 0.8% | 0.05% | 0.001% |
| 에러율 | 3.2% | 0.6% | 0.2% |
| 타임아웃률 | 2.1% | 0.3% | 0.1% |

---

### **4. 리소스 사용률 (1,000명 기준)**

| 리소스 | Redis 전 | Redis 후 | Kafka 후 |
|--------|----------|----------|----------|
| CPU (평균) | 75% | 45% | 40% |
| Memory (평균) | 70% | 60% | 65% |
| DB Connection | 25/30 (83%) | 8/30 (27%) | 5/30 (17%) |
| Network I/O | 40MB/s | 60MB/s | 80MB/s |

---

## 🎯 핵심 측정 지표 요약

### **반드시 측정해야 할 Top 10 지표**

| 순위 | 지표 | 중요도 | 이유 |
|------|------|--------|------|
| 1 | **메시지 전송 → 수신 지연 시간** | ⭐⭐⭐⭐⭐ | 사용자 체감 성능 |
| 2 | **초당 메시지 처리량 (TPS)** | ⭐⭐⭐⭐⭐ | 시스템 용량 |
| 3 | **메시지 유실률** | ⭐⭐⭐⭐⭐ | 서비스 신뢰성 |
| 4 | **동시 접속 최대 사용자 수** | ⭐⭐⭐⭐⭐ | 확장성 |
| 5 | **P95/P99 응답 시간** | ⭐⭐⭐⭐ | 사용자 경험 |
| 6 | **CPU/Memory 사용률** | ⭐⭐⭐⭐ | 리소스 효율 |
| 7 | **에러율** | ⭐⭐⭐⭐ | 안정성 |
| 8 | **DB 쿼리 수** | ⭐⭐⭐ | DB 부하 |
| 9 | **대규모 방 브로드캐스트 시간** | ⭐⭐⭐ | 확장성 |
| 10 | **Pod 재시작 시 복구 시간** | ⭐⭐⭐ | 장애 복구 |

---

## 📝 테스트 결과 문서화 템플릿

```markdown
# 채팅 시스템 부하 테스트 결과

## 테스트 정보
- 일시: 2026-01-XX
- 환경: Kubernetes 3 Pods
- 구성: [Redis 전 / Redis 후 / Kafka 후]

## 주요 성과

### 1. 처리량
- TPS: 500 → 2,000 (4배 향상)
- 동시 접속: 1,500 → 3,000명 (2배 향상)

### 2. 응답 시간
- P50: 80ms → 8ms (90% 단축)
- P95: 150ms → 18ms (88% 단축)
- P99: 300ms → 45ms (85% 단축)

### 3. 안정성
- 메시지 유실률: 0.8% → 0.05% (93.75% 개선)
- 에러율: 3.2% → 0.6% (81.25% 개선)

### 4. 리소스 효율
- CPU 사용률: 75% → 45% (40% 절감)
- DB 부하: 500 쿼리/s → 50 쿼리/s (90% 감소)

## 병목 지점
1. [식별된 병목]
2. [개선 방안]

## 결론 및 권장사항
- [결론]
- [다음 단계]
```

---

## 🔬 고급 측정 지표

### **메시지 전달 시간 세분화**

```
Phase 1: 클라이언트 → 서버 (네트워크)
  └─ 측정: WebSocket 전송 시간
  └─ 목표: < 5ms

Phase 2: 서버 수신 → Kafka/Redis (처리)
  └─ 측정: Producer 응답 시간
  └─ 목표: < 5ms

Phase 3: Kafka/Redis → Consumer (전파)
  └─ 측정: Consumer Lag
  └─ 목표: < 10ms

Phase 4: Consumer → 수신자 전달 (브로드캐스트)
  └─ 측정: WebSocket Push 시간
  └─ 목표: < 10ms

Total E2E: < 30ms (Redis 후)
```

---

## 💡 Redis vs Kafka 선택 가이드

### **Redis Pub/Sub을 선택해야 할 때:**

```
✅ 초저지연 필요 (< 10ms)
✅ 실시간성이 최우선
✅ 메시지 영속성 덜 중요
✅ 간단한 구조 선호
✅ 비용 최소화

예: 
- 실시간 채팅
- 온라인 상태 업데이트
- 타이핑 인디케이터
```

**예상 성능:**
- TPS: 10,000-100,000
- 지연: 1-5ms
- 메모리 사용: 중간

---

### **Kafka를 선택해야 할 때:**

```
✅ 메시지 영속성 필수
✅ 순서 보장 필요
✅ 대용량 처리 (10,000+ TPS)
✅ 이벤트 소싱
✅ 장애 복구 중요

예:
- 중요 메시지 (계약, 거래)
- 감사 로그
- 알림 히스토리
- 데이터 분석
```

**예상 성능:**
- TPS: 50,000-1,000,000
- 지연: 5-20ms
- 디스크 사용: 높음

---

### **Redis + Kafka 조합 (Best Practice):**

```
실시간 경로 (Redis):
사용자 → Kafka (영속화) → Redis Pub/Sub → 수신자
           ↓ (5ms)          ↓ (5ms)
        안전 보관        실시간 전달
        
총 지연: 10-15ms
안정성: 99.999%
```

---

## 🎓 테스트 결과 활용

### **포트폴리오 작성:**

```markdown
## 성능 테스트 결과

### Before (Redis 도입 전)
- 동시 접속: 1,500명
- TPS: 500
- P95 지연: 150ms
- 메시지 유실률: 0.8%

### After (Redis 도입 후)
- 동시 접속: 3,000명 (2배 ↑)
- TPS: 2,000 (4배 ↑)
- P95 지연: 18ms (88% ↓)
- 메시지 유실률: 0.05% (93.75% ↓)

### 핵심 성과
✅ 실시간성 88% 향상
✅ DB 부하 90% 감소
✅ 확장성 2배 증가
```

---

## 🚀 실행 계획

### **Week 1: 베이스라인 측정**
```
Day 1-2: k6 스크립트 작성
Day 3-4: 일반 채팅 테스트 (시나리오 1)
Day 5: 스트레스 테스트 (시나리오 2)
```

### **Week 2: Redis 도입 및 재측정**
```
Day 1-3: Redis Pub/Sub 구현
Day 4-5: 동일 시나리오 재테스트
Day 6-7: 결과 분석 및 비교
```

### **Week 3-4: Kafka 도입 및 최종 측정**
```
Day 1-5: Kafka 클러스터 구축 및 통합
Day 6-10: 전체 시나리오 재테스트
Day 11-14: 최종 분석 및 리포트 작성
```

---

**이 계획대로 진행하면 완벽한 성능 비교 데이터를 얻을 수 있습니다!** 📊

테스트 스크립트 작성이 필요하시면 말씀해주세요! 🚀