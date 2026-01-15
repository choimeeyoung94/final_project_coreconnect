# 🔥 스트레스 테스트 실행 가이드

> **목적**: 시스템의 한계(Breaking Point)를 찾고, 최대 처리 성능을 측정합니다.

---

## 📋 테스트 실패 분석 (2026-01-15 12:46)

### 실패 원인

**네트워크 접근 불가** 문제로 테스트 실패:
- **에러**: `connection refused` (50% 실패율)
- **원인**: k6 Cloud가 EC2 인스턴스에 접근하지 못함
- **해결**: NodePort 서비스 + Security Group 개방

**측정된 지표 (실패 전):**
- 총 요청: 14,200개
- HTTP 실패: 7,100개 (50%)
- Peak RPS: 28.5 req/s
- P95 응답시간: 8,192ms

**상세 분석**: [PERFORMANCE_ANALYSIS.md](../../docs/PERFORMANCE_ANALYSIS.md#-스트레스-테스트-결과-및-분석)

---

## 🛠️ 해결 방법

### Step 1: NodePort 서비스 설정

#### 방법 A: 자동 스크립트 (권장)

```bash
# 로컬 터미널에서 (Windows PowerShell/cmd)
cd C:\dev\final_project_coreconnect

# 스크립트를 Kubernetes 서버로 업로드 (MobaXterm 또는 scp)
scp -i "C:\dev\key\coreconnect_key.pem" tests\k6\apply-nodeport-and-test.sh ubuntu@3.38.28.172:~/

# Kubernetes 서버에 SSH 접속
ssh -i "C:\dev\key\coreconnect_key.pem" ubuntu@3.38.28.172

# 스크립트 실행 권한 부여
chmod +x ~/apply-nodeport-and-test.sh

# 스크립트 실행
cd ~/final_project_coreconnect
bash tests/k6/apply-nodeport-and-test.sh
```

#### 방법 B: 수동 설정

```bash
# Kubernetes 서버에 SSH 접속
ssh -i "C:\dev\key\coreconnect_key.pem" ubuntu@3.38.28.172

# 1. service.yaml 확인
cd ~/final_project_coreconnect
cat k8s/service.yaml

# 다음 내용이 있는지 확인:
# type: NodePort
# nodePort: 30080

# 2. 서비스 적용
kubectl apply -f k8s/service.yaml

# 3. 서비스 확인
kubectl get svc -n chat-system chat-service

# 출력 예시:
# NAME           TYPE       CLUSTER-IP     EXTERNAL-IP   PORT(S)        AGE
# chat-service   NodePort   10.43.xxx.xxx  <none>        80:30080/TCP   1d
```

### Step 2: AWS Security Group 개방

1. **AWS Console 접속**
   - https://console.aws.amazon.com/ec2/

2. **Security Group 선택**
   - EC2 → Network & Security → Security Groups
   - Kubernetes 서버의 Security Group 선택

3. **Inbound Rule 추가**
   - Edit inbound rules 클릭
   - Add rule:
     ```
     Type: Custom TCP
     Port range: 30080
     Source: 0.0.0.0/0
     Description: k6 Cloud Load Test
     ```
   - Save rules 클릭

### Step 3: 연결 테스트

```bash
# Kubernetes 서버에서 (SSH 접속 상태)
curl http://3.38.28.172:30080/actuator/health

# 예상 출력:
# {"status":"UP"}
```

**성공하면 다음 단계로!** ✅

---

## 🚀 스트레스 테스트 재실행

### 테스트 시나리오

**목표:** 시스템의 Breaking Point를 찾고, 최대 처리 성능을 측정합니다.

**부하 프로파일:**

```
시간     0분    5분    10분   15분   20분   25분   27분
VUs      0 ──▶ 100 ──▶ 200 ──▶ 300 ──▶ 500 ──▶ 1000 ──▶ 0
                ▲       ▲       ▲       ▲       ▲
              정상   약간지연  지연증가  에러증가  시스템한계
```

**5단계 부하 증가:**
- **Level 1 (0-5분)**: 100 VUs - Baseline 성능 측정
- **Level 2 (5-10분)**: 200 VUs - 2배 부하, Tomcat 스레드 포화 예상
- **Level 3 (10-15분)**: 300 VUs - 3배 부하, DB Connection Pool 고갈 예상
- **Level 4 (15-20분)**: 500 VUs - 5배 부하, 높은 에러율 예상
- **Level 5 (20-25분)**: 1,000 VUs - 10배 부하, **Breaking Point 예상**

### 실행 명령어

```bash
# Kubernetes 서버에 SSH 접속
ssh -i "C:\dev\key\coreconnect_key.pem" ubuntu@3.38.28.172

# k6-tests 디렉토리로 이동
cd ~/k6-tests

# k6 Cloud 토큰 설정 (최초 1회)
export K6_CLOUD_TOKEN="your_k6_cloud_token_here"

# 환경 변수 설정
export BASE_URL=http://3.38.28.172:30080
export WS_URL=ws://3.38.28.172:30080

# 스트레스 테스트 실행
k6 cloud chat-stress-test-cloud.js
```

### 예상 소요 시간

**총 테스트 시간: 약 27분**
- Ramp-up: 25분 (5단계)
- Ramp-down: 2분

**실시간 모니터링:**
- 터미널에 출력되는 k6 Cloud URL 클릭
- 브라우저에서 실시간 결과 확인 가능

---

## 📊 결과 분석 체크리스트

### 테스트 완료 후 확인할 항목

#### 1️⃣ Breaking Point 확인

- [ ] **어느 VU 레벨에서 에러율이 급증하는가?**
  - Level 1 (100 VUs): 정상 예상
  - Level 2 (200 VUs): 지연 시작 예상
  - Level 3 (300 VUs): 에러 증가 예상
  - Level 4 (500 VUs): 높은 에러율 예상
  - Level 5 (1000 VUs): 시스템 한계 예상

#### 2️⃣ 최대 처리량 (Throughput)

- [ ] **Peak RPS (Requests Per Second)**: _____ req/s
- [ ] **최대 안정적 처리량**: _____ req/s (에러율 < 1%)
- [ ] **평균 TPS (Transactions Per Second)**: _____ tx/s

#### 3️⃣ 응답 시간 (Latency)

- [ ] **P95 응답시간**: _____ ms (목표: < 500ms)
- [ ] **P99 응답시간**: _____ ms (목표: < 1000ms)
- [ ] **최대 응답시간**: _____ ms
- [ ] **평균 응답시간**: _____ ms

#### 4️⃣ 에러율 분석

- [ ] **총 요청 수**: _____ reqs
- [ ] **실패 요청 수**: _____ reqs
- [ ] **에러율**: _____ % (목표: < 1%)
- [ ] **주요 에러 타입**: _____________

#### 5️⃣ 리소스 병목 식별

**병목 지점 (우선순위):**
1. [ ] **Tomcat 스레드 포화** (현재: 최대 200개)
2. [ ] **DB Connection Pool 고갈** (현재: Master 30개, Slave 50개)
3. [ ] **MySQL Write Lock 경합**
4. [ ] **CPU/Memory 사용률**
5. [ ] **네트워크 대역폭**

#### 6️⃣ WebSocket 성능

- [ ] **WebSocket 연결 성공률**: _____ %
- [ ] **메시지 전송 성공률**: _____ %
- [ ] **메시지 손실률**: _____ % (목표: < 1%)
- [ ] **평균 메시지 지연시간**: _____ ms

---

## 🎯 성능 목표 vs 실제

| 지표 | 목표 (AS-IS) | 실제 측정 | 달성 여부 |
|------|-------------|----------|----------|
| **최대 동시 사용자** | 100-200 VUs | _____ VUs | ⬜ |
| **Peak RPS** | 50-80 req/s | _____ req/s | ⬜ |
| **P95 응답시간** | < 500ms | _____ ms | ⬜ |
| **P99 응답시간** | < 1000ms | _____ ms | ⬜ |
| **에러율** | < 1% | _____ % | ⬜ |
| **메시지 손실률** | < 1% | _____ % | ⬜ |

---

## 📈 TO-BE 목표 (Redis/Kafka 적용 후)

| 지표 | AS-IS | TO-BE 목표 | 개선율 |
|------|-------|-----------|--------|
| **최대 동시 사용자** | 200 VUs | **1,000+ VUs** | 500% ↑ |
| **Peak RPS** | 80 req/s | **400+ req/s** | 500% ↑ |
| **P95 응답시간** | 500ms | **< 100ms** | 80% ↓ |
| **P99 응답시간** | 1000ms | **< 200ms** | 80% ↓ |
| **에러율** | < 1% | **< 0.1%** | 90% ↓ |
| **메시지 손실률** | < 1% | **< 0.01%** | 99% ↓ |

**개선 방안:**
- ✅ **Redis Pub/Sub**: 실시간 메시지 브로드캐스트 (DB 부하 감소)
- ✅ **Kafka**: 비동기 메시지 처리 (처리량 향상)
- ✅ **Redis Cache**: 채팅방/사용자 정보 캐싱 (응답 시간 개선)
- ✅ **Connection Pool 증설**: Tomcat 스레드, DB Connection Pool 확대

**상세 개선 계획**: [PERFORMANCE_ANALYSIS.md](../../docs/PERFORMANCE_ANALYSIS.md)

---

## 🆘 트러블슈팅

### ❌ 여전히 `connection refused` 에러

**체크리스트:**
1. [ ] NodePort 서비스가 적용되었는가?
   ```bash
   kubectl get svc -n chat-system chat-service
   # TYPE이 NodePort인지 확인
   ```

2. [ ] Security Group이 개방되었는가?
   ```bash
   # AWS Console에서 확인
   # Inbound Rules에 TCP 30080이 있는지 확인
   ```

3. [ ] Pod가 정상 실행 중인가?
   ```bash
   kubectl get pods -n chat-system
   # STATUS가 Running인지 확인
   ```

4. [ ] 로컬에서 직접 테스트
   ```bash
   curl http://3.38.28.172:30080/actuator/health
   # {"status":"UP"} 응답이 오는지 확인
   ```

### ❌ k6 Cloud 토큰 에러

```bash
# 토큰 재설정
export K6_CLOUD_TOKEN="your_new_token_here"

# 토큰 확인
echo $K6_CLOUD_TOKEN
```

### ❌ 테스트 도중 서버 다운

**원인:** 과도한 부하로 인한 시스템 리소스 고갈

**해결:**
1. Pod 재시작
   ```bash
   kubectl delete pod -n chat-system -l app=chat-service
   ```

2. 부하 레벨 낮추기
   - `chat-stress-test-cloud.js` 수정
   - `target: 1000` → `target: 500`

---

## 📞 도움이 필요하신가요?

- **성능 분석 문서**: [PERFORMANCE_ANALYSIS.md](../../docs/PERFORMANCE_ANALYSIS.md)
- **k6 Cloud 가이드**: [K6_CLOUD_GUIDE.md](./K6_CLOUD_GUIDE.md)
- **README**: [README.md](./README.md)

---

**작성일**: 2026-01-15
**버전**: 1.0
**상태**: 🟡 네트워크 문제 해결 대기 → 재테스트 예정
