# k6 부하 테스트 가이드

## 📋 개요

LOAD_TEST_PLAN.md에 정의된 6가지 시나리오를 모두 측정할 수 있는 k6 테스트 코드입니다.

---

## ⚡ 빠른 시작 (k6 Cloud 권장!)

**복잡한 설정 없이 5분 안에 부하 테스트 시작!**

> **⚠️ 중요**: k6 Cloud 테스트를 위해서는 **반드시 아래 사전 설정**이 필요합니다!

### 🔧 사전 설정 (필수!)

k6 Cloud는 외부 클라우드 서비스이므로, EC2 인스턴스에 외부에서 접근할 수 있어야 합니다.

```bash
# 1. NodePort 서비스 설정 및 Security Group 개방 (자동 스크립트)
cd /path/to/project
bash tests/k6/apply-nodeport-and-test.sh

# 2. 연결 테스트
curl http://3.38.28.172:30080/actuator/health
# 응답: {"status":"UP"} 확인!
```

**수동 설정 방법:**
1. **Kubernetes 서비스를 NodePort로 변경**: `kubectl apply -f k8s/service.yaml`
2. **AWS Security Group 개방**: TCP 30080 포트를 0.0.0.0/0에 개방
3. **연결 테스트**: `curl http://<EC2-PUBLIC-IP>:30080/actuator/health`

### 1️⃣ k6 Cloud 계정 생성 (무료)
```
https://app.k6.io/account/register
```

### 2️⃣ API 토큰 발급
```
Settings → API Token → Generate New Token
```

### 3️⃣ 테스트 실행
```bash
# Kubernetes 서버에 SSH 접속
ssh ubuntu@3.38.28.172
cd ~/k6-tests

# 토큰 설정
export K6_CLOUD_TOKEN="your_token_here"

# 환경 변수 설정 (NodePort 사용)
export BASE_URL=http://3.38.28.172:30080
export WS_URL=ws://3.38.28.172:30080

# 테스트 실행!
k6 cloud chat-stress-test-cloud.js
```

### 4️⃣ 결과 확인
```
출력되는 URL 클릭 → 실시간 대시보드에서 모든 메트릭 확인!
```

**상세 가이드**: 📖 [K6_CLOUD_GUIDE.md](./K6_CLOUD_GUIDE.md)

---

## 🚨 트러블슈팅

### ❌ `connection refused` 에러 발생 시

**증상:**
```
Request Failed error=Post "http://3.38.28.172:8080/api/v1/auth/login": 
dial tcp 3.38.28.172:8080: connect: connection refused
```

**원인:**
- Kubernetes 서비스가 `ClusterIP`로 설정되어 외부 접근 차단
- Security Group에서 30080 포트가 개방되지 않음

**해결:**
```bash
# 1. NodePort 서비스 적용
kubectl apply -f k8s/service.yaml

# 2. Security Group 개방 (AWS Console)
EC2 → Security Groups → Inbound Rules → Edit
Type: Custom TCP, Port: 30080, Source: 0.0.0.0/0

# 3. 연결 테스트
curl http://3.38.28.172:30080/actuator/health

# 4. 테스트 재실행
BASE_URL=http://3.38.28.172:30080 WS_URL=ws://3.38.28.172:30080 k6 cloud chat-stress-test-cloud.js
```

**상세 분석**: 📊 [PERFORMANCE_ANALYSIS.md - 스트레스 테스트 실패 분석](../../docs/PERFORMANCE_ANALYSIS.md#-스트레스-테스트-결과-및-분석)

---

## 📁 파일 구조

```
tests/k6/
├── common/
│   ├── test-users.js          # 테스트 사용자 관리
│   ├── api-client.js          # API 클라이언트 (로그인, HTTP 요청)
│   └── metrics.js             # Custom Metrics 정의
├── scenario1-baseline-chat.js          # 시나리오 1: 일반 채팅
├── scenario2-stress-test.js            # 시나리오 2: 스트레스 테스트
├── scenario3-spike-test.js             # 시나리오 3: 스파이크 테스트
├── scenario4-endurance-test.js         # 시나리오 4: 지속성 테스트
├── scenario5-large-group-chat.js       # 시나리오 5: 대규모 그룹 채팅
├── scenario6-notification-burst.js     # 시나리오 6: 알림 폭주
└── README.md                           # 본 파일
```

---

## 🎯 6가지 시나리오

| 시나리오 | 사용자 수 | 기간 | 목적 |
|---------|----------|------|------|
| **1. 일반 채팅** | 1,000명 | 10분 | 베이스라인 성능 측정 |
| **2. 스트레스** | 1,000→5,000명 | 20분 | 시스템 한계점 파악 |
| **3. 스파이크** | 500→5,000명 | 8분 | 급격한 트래픽 대응 |
| **4. 지속성** | 2,000명 | 4시간 | 장시간 운영 안정성 |
| **5. 대규모 그룹** | 1,500명 | 15분 | 브로드캐스트 성능 |
| **6. 알림 폭주** | 10,000명 | 5분 | 대량 알림 처리 |

---

## 🚀 사전 준비

### **1. k6 설치**

#### Windows
```bash
choco install k6
```

#### Mac
```bash
brew install k6
```

#### Linux
```bash
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

---

### **2. 테스트 사용자 생성**

MySQL에서 10,000명의 테스트 사용자 생성:

```bash
# MySQL 접속
mysql -h 127.0.0.1 -P 3307 -u admin -p db_coreconnect

# 사용자 생성 (scripts/create-10000-users-simple.sql 실행)
source scripts/create-10000-users-simple.sql
```

---

### **3. 환경 변수 설정**

테스트 실행 전 환경 변수 설정:

```bash
# Windows (PowerShell)
$env:BASE_URL="http://your-service.com"
$env:WS_URL="ws://your-service.com/ws"

# Linux/Mac
export BASE_URL="http://your-service.com"
export WS_URL="ws://your-service.com/ws"
```

또는 k6 실행 시 직접 지정:

```bash
k6 run -e BASE_URL=http://localhost:8080 -e WS_URL=ws://localhost:8080/ws scenario1-baseline-chat.js
```

---

## 📊 시나리오별 실행 방법

### **시나리오 1: 일반 채팅 (Baseline)**

```bash
cd tests/k6

# 실행
k6 run scenario1-baseline-chat.js

# 결과 파일
# - results/scenario1-baseline-chat.json (상세 데이터)
# - results/scenario1-baseline-chat.txt (요약)
```

**예상 소요 시간**: 10분
**필요 사용자**: 1,000명
**목표**:
- TPS: 450+
- P95 지연: < 50ms
- 유실률: < 0.1%

---

### **시나리오 2: 스트레스 테스트**

```bash
k6 run scenario2-stress-test.js
```

**예상 소요 시간**: 20분
**필요 사용자**: 5,000명
**목표**:
- Breaking Point 파악
- 3,000명 이상 처리 가능 여부

---

### **시나리오 3: 스파이크 테스트**

```bash
k6 run scenario3-spike-test.js
```

**예상 소요 시간**: 8분
**필요 사용자**: 5,000명
**목표**:
- 10배 트래픽 증가 대응
- 복구 시간 < 2분

---

### **시나리오 4: 지속성 테스트**

```bash
k6 run scenario4-endurance-test.js
```

**예상 소요 시간**: 4시간 ⚠️
**필요 사용자**: 2,000명
**목표**:
- 메모리 누수 확인
- 성능 저하율 < 5%

---

### **시나리오 5: 대규모 그룹 채팅**

```bash
k6 run scenario5-large-group-chat.js
```

**예상 소요 시간**: 15분
**필요 사용자**: 1,500명
**목표**:
- 500명 방 브로드캐스트 < 200ms
- 마지막 사용자 수신 < 1초

---

### **시나리오 6: 알림 폭주**

```bash
k6 run scenario6-notification-burst.js
```

**예상 소요 시간**: 5분
**필요 사용자**: 10,000명
**목표**:
- 알림 TPS: 5,000+
- 알림 지연: < 1초

---

## 📈 결과 분석

### **실시간 모니터링**

테스트 실행 중 실시간 메트릭 확인:

```
execution: local
    script: scenario1-baseline-chat.js
    output: -

scenarios: (100.00%) 1 scenario, 1000 max VUs, 10m30s max duration

✓ login status is 200
✓ response has token

messages_sent.................: 120000  (200/s)
messages_received.............: 119500  (199/s)
message_send_duration..........: avg=18ms p(95)=22ms p(99)=45ms
message_loss_rate..............: 0.04%
```

---

### **결과 파일**

각 시나리오 실행 후 `results/` 폴더에 생성:

```
results/
├── scenario1-baseline-chat.json       # JSON 형식 (상세)
├── scenario1-baseline-chat.txt        # 텍스트 요약
├── scenario2-stress-test.json
├── scenario2-stress-test.txt
└── ...
```

---

### **주요 지표 해석**

#### **처리량 (Throughput)**
```
messages_sent: 120000
messages_received: 119500
TPS: 200

✅ 좋음: TPS > 450
⚠️ 주의: TPS 100-450
❌ 나쁨: TPS < 100
```

#### **응답 시간 (Latency)**
```
message_send_duration:
  avg: 18ms
  p(50): 15ms
  p(95): 22ms   ← 95% 요청이 22ms 이하
  p(99): 45ms
  max: 120ms

✅ 좋음: P95 < 50ms
⚠️ 주의: P95 50-100ms
❌ 나쁨: P95 > 100ms
```

#### **안정성 (Reliability)**
```
message_loss_rate: 0.04%
message_errors: 50
error_rate: 0.5%

✅ 좋음: 유실률 < 0.1%, 에러율 < 1%
⚠️ 주의: 유실률 0.1-1%, 에러율 1-5%
❌ 나쁨: 유실률 > 1%, 에러율 > 5%
```

---

## 🎯 목표 달성 여부 확인

각 시나리오 실행 후 자동으로 출력:

```
============================================
테스트 결과 요약
============================================

📊 처리량 (Throughput)
  - 총 메시지 전송: 120000개
  - 총 메시지 수신: 119500개
  - TPS (초당 처리): 200.00
  - 테스트 시간: 600초

⚡ 응답 시간 (Latency)
  - 메시지 전송 P50: 15.00ms
  - 메시지 전송 P95: 22.00ms
  - 메시지 전송 P99: 45.00ms
  - 로그인 평균: 120.00ms

🛡️ 안정성 (Reliability)
  - 메시지 유실률: 0.042%
  - 에러 발생: 50건
  - 에러율: 0.04%

🎯 목표 달성 여부
  - TPS > 450: ❌ 실패 (200)
  - P95 < 50ms: ✅ 통과 (22.00ms)
  - 유실률 < 0.1%: ✅ 통과 (0.042%)
  - 에러율 < 1%: ✅ 통과 (0.04%)

============================================
```

---

## 🔧 고급 옵션

### **병렬 실행 (여러 시나리오)**

```bash
# 시나리오 1과 2 동시 실행 (별도 터미널)
k6 run scenario1-baseline-chat.js &
k6 run scenario2-stress-test.js &
```

---

### **Grafana 연동**

```bash
# InfluxDB로 메트릭 전송
k6 run --out influxdb=http://localhost:8086/k6 scenario1-baseline-chat.js

# Grafana에서 실시간 모니터링
```

---

### **k6 Cloud 실행 (권장!) ⭐**

**복잡한 InfluxDB/Grafana 설정 없이 아름다운 대시보드에서 실시간 결과 확인!**

```bash
# 1. k6 Cloud 로그인 (최초 1회)
k6 login cloud --token YOUR_TOKEN

# 2. Cloud에서 실행
k6 cloud login-test-cloud.js

# 3. 출력되는 URL에서 실시간 모니터링!
# output: https://app.k6.io/runs/1234567
```

**상세 가이드**: [K6_CLOUD_GUIDE.md](./K6_CLOUD_GUIDE.md) 참고

**장점**:
- ✅ 별도 서버 설정 불필요
- ✅ 실시간 대시보드 자동 생성
- ✅ 과거 테스트 결과 비교
- ✅ 팀원과 결과 공유
- ✅ 무료 플랜 제공 (월 50 VU-hours)

---

## ⚠️ 주의사항

### **리소스 요구사항**

| 시나리오 | VU 수 | 메모리 | CPU |
|---------|-------|--------|-----|
| 1, 5 | 1,500 | 2GB | 4 Cores |
| 2, 3 | 5,000 | 4GB | 8 Cores |
| 4 | 2,000 | 3GB | 4 Cores |
| 6 | 10,000 | 8GB | 16 Cores |

---

### **네트워크**

- **대역폭**: 100Mbps+ 권장
- **지연 시간**: < 50ms (테스트 서버와의 RTT)
- **방화벽**: WebSocket (ws://) 허용

---

### **서버 준비**

테스트 전 확인:

```bash
# 서버 상태 확인
curl http://your-service.com/actuator/health

# WebSocket 연결 테스트
wscat -c ws://your-service.com/ws
```

---

## 🐛 트러블슈팅

### **문제 1: 로그인 실패**

```
❌ login status is 200: 0%
```

**해결**:
1. BASE_URL 확인
2. 테스트 사용자 생성 확인
3. 서버 로그 확인

---

### **문제 2: WebSocket 연결 실패**

```
❌ ws_connection_errors: 100
```

**해결**:
1. WS_URL 확인 (`ws://` 또는 `wss://`)
2. 방화벽 설정 확인
3. JWT 토큰 만료 확인

---

### **문제 3: 높은 에러율**

```
❌ message_errors: 5000 (5%)
```

**해결**:
1. 서버 리소스 확인 (CPU, Memory)
2. DB Connection Pool 크기 확인
3. 테스트 부하 줄이기 (VU 수 감소)

---

## 📚 참고 자료

- [LOAD_TEST_PLAN.md](../../docs/LOAD_TEST_PLAN.md) - 상세 테스트 계획
- [LOAD_TEST_PREDICTIONS.md](../../docs/LOAD_TEST_PREDICTIONS.md) - 성능 예측치
- [k6 공식 문서](https://k6.io/docs/)
- [k6 WebSocket API](https://k6.io/docs/javascript-api/k6-ws/)

---

## ✅ 실행 체크리스트

### **테스트 전**
- [ ] k6 설치 완료
- [ ] 테스트 사용자 10,000명 생성
- [ ] 환경 변수 설정 (BASE_URL, WS_URL)
- [ ] 서버 Health Check 통과
- [ ] results/ 폴더 생성

### **테스트 실행**
- [ ] 시나리오 1 실행 (10분)
- [ ] 시나리오 2 실행 (20분)
- [ ] 시나리오 3 실행 (8분)
- [ ] 시나리오 5 실행 (15분)
- [ ] 시나리오 6 실행 (5분)
- [ ] 시나리오 4 실행 (4시간) - 선택적

### **테스트 후**
- [ ] 결과 파일 확인
- [ ] 목표 달성 여부 분석
- [ ] 병목 지점 파악
- [ ] 리포트 작성

---

**모든 시나리오를 실행하여 완벽한 성능 분석을 완료하세요!** 🚀
