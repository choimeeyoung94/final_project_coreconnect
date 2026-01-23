# 🚀 빠른 시작 가이드

5분 안에 부하 테스트를 시작할 수 있습니다!

---

## ⚡ 빠른 실행 (3단계)

### **1단계: 환경 설정 (1분)**

```powershell
# 환경 변수 설정 (PowerShell)
$env:BASE_URL="http://your-service.com"
$env:WS_URL="ws://your-service.com/ws"

# 또는 로컬 테스트
$env:BASE_URL="http://localhost:8080"
$env:WS_URL="ws://localhost:8080/ws"
```

---

### **2단계: 테스트 사용자 생성 (2분)**

```sql
-- MySQL Workbench에서 실행
USE db_coreconnect;

-- scripts/create-10000-users-simple.sql 파일 실행
-- 또는 직접 실행:
CALL CreateTestUsers();
```

---

### **3단계: 시나리오 실행 (2분+)**

```powershell
cd tests/k6

# 시나리오 1 실행 (10분)
k6 run scenario1-baseline-chat.js
```

**완료!** 🎉

---

## 📊 모든 시나리오 자동 실행

```powershell
# 전체 실행 (시나리오 4 제외, 약 58분)
.\run-all-scenarios.ps1

# 시나리오 4 포함 (약 5시간)
.\run-all-scenarios.ps1 -SkipEndurance:$false

# 커스텀 URL로 실행
.\run-all-scenarios.ps1 -BaseURL "http://your-service.com" -WsURL "ws://your-service.com/ws"
```

---

## 📋 실행 순서 (권장)

| 순서 | 시나리오 | 소요 시간 | 중요도 |
|------|---------|----------|--------|
| 1 | **시나리오 1: 일반 채팅** | 10분 | ⭐⭐⭐⭐⭐ |
| 2 | **시나리오 5: 대규모 그룹** | 15분 | ⭐⭐⭐⭐ |
| 3 | **시나리오 2: 스트레스** | 20분 | ⭐⭐⭐⭐⭐ |
| 4 | **시나리오 3: 스파이크** | 8분 | ⭐⭐⭐⭐ |
| 5 | **시나리오 6: 알림 폭주** | 5분 | ⭐⭐⭐ |
| 6 | **시나리오 4: 지속성** | 4시간 | ⭐⭐⭐ (선택) |

**총 소요 시간**: 58분 (시나리오 4 제외) 또는 5시간 (전체)

---

## 🎯 단일 시나리오 실행

### **시나리오 1: 일반 채팅 (가장 중요)**

```powershell
k6 run scenario1-baseline-chat.js
```

**예상 결과**:
```
✅ TPS > 450
✅ P95 < 50ms
✅ 유실률 < 0.1%
```

---

### **시나리오 2: 스트레스 테스트**

```powershell
k6 run scenario2-stress-test.js
```

**예상 결과**:
```
Breaking Point: 1,800-3,000명
```

---

### **시나리오 3: 스파이크 테스트**

```powershell
k6 run scenario3-spike-test.js
```

**예상 결과**:
```
복구 시간: < 2분
```

---

## 📈 결과 확인

실시간 결과:
```
✓ login status is 200
✓ response has token

messages_sent.................: 120000  (200/s)
messages_received.............: 119500  (199/s)
message_send_duration..........: avg=18ms p(95)=22ms
message_loss_rate..............: 0.04%

🎯 목표 달성 여부
  - TPS > 450: ❌ 실패 (200)
  - P95 < 50ms: ✅ 통과 (22ms)
  - 유실률 < 0.1%: ✅ 통과 (0.04%)
```

결과 파일:
```
results/
├── scenario1-baseline-chat.json
├── scenario1-baseline-chat.txt
└── ...
```

---

## ⚠️ 문제 해결

### **에러: command not found: k6**

```bash
# k6 설치
choco install k6  # Windows
brew install k6   # Mac
```

---

### **에러: login failed**

1. BASE_URL 확인
2. 서버 실행 확인: `curl http://localhost:8080/actuator/health`
3. 테스트 사용자 생성 확인

---

### **에러: WebSocket connection failed**

1. WS_URL 확인 (`ws://` 또는 `wss://`)
2. 방화벽 설정 확인
3. 서버 WebSocket 엔드포인트 확인

---

## 📞 도움말

상세 가이드: [README.md](README.md)

문제 발생 시:
1. 서버 로그 확인
2. k6 버전 확인: `k6 version`
3. 테스트 사용자 개수 확인: `SELECT COUNT(*) FROM users WHERE user_email LIKE 'testuser%@loadtest.com';`

---

**지금 바로 시작하세요!** 🚀

```powershell
k6 run scenario1-baseline-chat.js
```
