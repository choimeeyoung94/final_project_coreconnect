# ⚡ k6 Cloud 5분 빠른 시작 가이드

복잡한 InfluxDB/Grafana 설정 없이 **5분 안에** 부하 테스트를 시작하고 아름다운 대시보드에서 결과를 확인하세요!

---

## 🎯 1단계: k6 Cloud 계정 생성 (2분)

### 1️⃣ 회원가입

브라우저에서 접속:
```
https://app.k6.io/account/register
```

### 2️⃣ 가입 방법 선택

- **GitHub** 계정으로 가입 (가장 빠름!) ⭐
- **Google** 계정으로 가입
- **이메일**로 가입

### 3️⃣ 이메일 인증

가입 완료 후 이메일 확인 → 인증 링크 클릭

---

## 🔑 2단계: API 토큰 발급 (1분)

### 1️⃣ 로그인 후 설정으로 이동

```
우측 상단 프로필 아이콘 → Settings
```

### 2️⃣ API Token 생성

```
좌측 메뉴: API Token → Generate New Token
```

### 3️⃣ 토큰 이름 입력

```
Token name: CoreConnect Load Test
→ Generate 버튼 클릭
```

### 4️⃣ 토큰 복사 ⚠️

```
생성된 토큰을 복사하세요!
(한 번만 표시되므로 안전한 곳에 저장!)

예시: k6cloud_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 🚀 3단계: 테스트 실행 (2분)

### MobaXterm에서 k6 서버 접속

```bash
# k6 서버에 SSH 접속
ssh -i /drives/c/dev/key/coreconnect_key.pem ubuntu@15.165.50.43
```

### 테스트 디렉토리로 이동

```bash
cd ~/k6-tests
```

### 파일 확인

```bash
ls -la
```

**확인할 파일:**
- ✅ `login-test-cloud.js`
- ✅ `run-cloud-test.sh`
- ✅ `common/test-users.js`
- ✅ `common/api-client.js`

### k6 Cloud 토큰 설정

```bash
export K6_CLOUD_TOKEN="여기에_복사한_토큰_붙여넣기"
```

### 실행 권한 부여 (최초 1회)

```bash
chmod +x run-cloud-test.sh
```

### 테스트 실행! 🚀

```bash
./run-cloud-test.sh
```

**또는 직접 실행:**

```bash
BASE_URL=http://3.38.28.172:8080 k6 cloud login-test-cloud.js
```

---

## 📊 4단계: 결과 확인 (실시간!)

### 1️⃣ 터미널에서 URL 확인

테스트 시작 시 다음과 같은 출력이 나타납니다:

```
          /\      |‾‾| /‾‾/   /‾‾/   
     /\  /  \     |  |/  /   /  /    
    /  \/    \    |     (   /   ‾‾\  
   /          \   |  |\  \ |  (‾)  | 
  / __________ \  |__| \__\ \_____/ .io

  execution: cloud
  output: https://app.k6.io/runs/1234567  ← 이 URL을 클릭!
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  script: login-test-cloud.js
```

### 2️⃣ 브라우저에서 URL 열기

위의 URL을 **Ctrl+클릭** 또는 복사해서 브라우저에 붙여넣기

### 3️⃣ 실시간 대시보드 확인

**자동으로 표시되는 정보:**

📊 **Performance Overview**
- Virtual Users (동시 사용자 수)
- Requests per Second (초당 요청 수)
- Response Time (응답 시간)
  - 평균 (Average)
  - P95 (95번째 백분위수)
  - P99 (99번째 백분위수)

✅ **Checks**
- 로그인 성공률
- 응답 데이터 검증
- 응답 시간 임계값

📈 **HTTP Metrics**
- Request Duration (요청 소요 시간)
- Request Rate (요청 빈도)
- Failed Requests (실패한 요청)
- Data Transfer (데이터 전송량)

🌍 **Load Zones**
- 테스트 실행 지역
- 지역별 성능

---

## 🎯 실행 결과 예시

### 터미널 출력

```
running (2m04.9s), 000/100 VUs, 936 complete and 0 interrupted iterations

     ✓ ✅ 로그인 성공 (200)
     ✓ ✅ 응답에 이메일 포함
     ✓ ✅ 쿠키에 토큰 포함
     ✓ ⚡ 응답 시간 < 1초

     checks.........................: 100.00% ✓ 3744    ✗ 0   
     data_received..................: 1.1 MB  8.8 kB/s
     data_sent......................: 389 kB  3.1 kB/s
     http_req_blocked...............: avg=1.2ms   min=0s      med=1ms    max=48ms  
     http_req_connecting............: avg=1.1ms   min=0s      med=0.9ms  max=47ms  
     http_req_duration..............: avg=145ms   min=89ms    med=132ms  max=450ms 
       { expected_response:true }...: avg=145ms   min=89ms    med=132ms  max=450ms 
     http_req_failed................: 0.00%   ✓ 0       ✗ 936  
     http_req_receiving.............: avg=0.2ms   min=0.1ms   med=0.2ms  max=2ms   
     http_req_sending...............: avg=0.1ms   min=0s      med=0.1ms  max=1ms   
     http_req_tls_handshaking.......: avg=0s      min=0s      med=0s     max=0s    
     http_req_waiting...............: avg=144ms   min=88ms    med=131ms  max=449ms 
     http_reqs......................: 936     7.5/s
     iteration_duration.............: avg=2.14s   min=1.09s   med=2.13s  max=3.45s 
     iterations.....................: 936     7.5/s
     login_count....................: 936     7.5/s
     login_duration.................: avg=145ms   min=89ms    med=132ms  max=450ms 
     login_success_rate.............: 100.00% ✓ 936     ✗ 0   
     vus............................: 100     min=0     max=100
     vus_max........................: 100     min=100   max=100

========================================
🏁 k6 Cloud 테스트 완료!
========================================
```

### Cloud 대시보드

브라우저에서 실시간 그래프로 확인:

- 📊 **Virtual Users**: 0 → 50 → 100 → 100 → 0 (곡선 그래프)
- 📈 **RPS**: 평균 7.5 req/s
- ⏱️ **Response Time**: 평균 145ms, P95 200ms, P99 450ms
- ✅ **Success Rate**: 100%
- ❌ **Error Rate**: 0%

---

## ✅ 성공 확인

### 테스트가 성공했다면:

✅ **터미널 출력:**
```
✓ ✅ 로그인 성공 (200)
checks.........................: 100.00%
http_req_failed................: 0.00%
```

✅ **Cloud 대시보드:**
- 모든 그래프가 표시됨
- 초록색 체크 마크가 많음
- 에러율이 낮음 (<1%)

---

## 🔧 문제 해결

### ❌ "authentication required" 에러

**원인**: k6 Cloud 토큰이 설정되지 않음

**해결**:
```bash
export K6_CLOUD_TOKEN="your_token_here"
```

### ❌ "connection refused" 에러

**원인**: API 서버에 접근 불가

**해결**:
1. API 서버가 실행 중인지 확인:
   ```bash
   curl http://3.38.28.172:8080/actuator/health
   ```
2. Security Group 8080 포트 개방 확인

### ❌ "login failed" 에러

**원인**: 테스트 사용자가 DB에 없음

**해결**:
```bash
# MySQL 접속
mysql -h 3.38.28.172 -P 3306 -u root -p coreconnect

# 테스트 사용자 확인
SELECT COUNT(*) FROM user WHERE email LIKE 'testuser%';

# 결과가 0이면 사용자 생성 필요
```

---

## 🎉 다음 단계

### 1️⃣ 결과 분석

Cloud 대시보드에서:
- 응답 시간이 목표치 이하인지 확인
- 에러율이 1% 미만인지 확인
- 병목 구간 파악 (가장 느린 구간)

### 2️⃣ 테스트 커스터마이징

`login-test-cloud.js` 파일 수정:
- VU 수 변경 (더 많은 사용자)
- 테스트 기간 변경 (더 오래)
- 임계값 조정 (더 엄격한 기준)

### 3️⃣ 다른 시나리오 테스트

- 채팅 메시지 전송 테스트
- WebSocket 연결 테스트
- 알림 발송 테스트

### 4️⃣ 이력서/포트폴리오 작성

- 테스트 결과 스크린샷 캡처
- 성능 개선 사항 문서화
- 병목 해결 방법 정리

---

## 📚 추가 리소스

- **상세 가이드**: [K6_CLOUD_GUIDE.md](./K6_CLOUD_GUIDE.md)
- **전체 README**: [README.md](./README.md)
- **k6 Cloud 문서**: https://grafana.com/docs/k6/latest/results-output/real-time/cloud/
- **k6 Cloud 대시보드**: https://app.k6.io/runs

---

## 💡 팁

### 무료 플랜 최대 활용

- **월 50 VU-hours** 제공
- 100 VUs × 4분 = 6.67 VU-hours
- **월 약 7-8회** 테스트 가능

### 효율적인 테스트

1. **짧게 자주**: 10분 대신 2-4분 여러 번
2. **단계적 증가**: 100 → 200 → 500 VUs
3. **결과 비교**: 과거 테스트와 성능 비교

---

**5분만에 부하 테스트 완료! 🎉**

**이제 아름다운 대시보드에서 모든 결과를 확인하세요!** 📊✨
