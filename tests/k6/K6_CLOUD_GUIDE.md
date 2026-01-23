# 🚀 k6 Cloud 부하 테스트 가이드

k6 Cloud를 사용하면 복잡한 InfluxDB/Grafana 설정 없이 아름다운 대시보드에서 실시간으로 테스트 결과를 확인할 수 있습니다!

---

## 📋 목차

1. [k6 Cloud란?](#k6-cloud란)
2. [계정 생성 및 설정](#계정-생성-및-설정)
3. [테스트 실행](#테스트-실행)
4. [결과 확인](#결과-확인)
5. [문제 해결](#문제-해결)

---

## 🎯 k6 Cloud란?

**k6 Cloud**는 Grafana Labs에서 제공하는 부하 테스트 결과 시각화 서비스입니다.

### ✨ 주요 기능

- 📊 **실시간 대시보드**: 테스트 실행 중 실시간 그래프
- 📈 **상세 메트릭**: 응답 시간, TPS, 에러율 등 모든 지표
- 🌍 **글로벌 테스트**: 전 세계 여러 지역에서 동시 테스트
- 📝 **히스토리**: 과거 테스트 결과 비교
- 👥 **팀 협업**: 팀원과 결과 공유
- 💰 **무료 플랜**: 월 50 VU-hours 무료!

---

## 🔧 계정 생성 및 설정

### 1단계: k6 Cloud 계정 생성 (무료)

1. 브라우저에서 접속:
   ```
   https://app.k6.io/account/register
   ```

2. **계정 생성 방법 선택:**
   - GitHub 계정으로 가입 (추천)
   - Google 계정으로 가입
   - 이메일로 가입

3. 이메일 인증 완료

### 2단계: API 토큰 발급

1. 로그인 후 우측 상단 프로필 클릭
2. **"Settings"** → **"API Token"** 클릭
3. **"Generate New Token"** 버튼 클릭
4. 토큰 이름 입력 (예: "CoreConnect Load Test")
5. **"Generate"** 클릭
6. **토큰 복사** (⚠️ 한 번만 표시됩니다!)

### 3단계: k6 CLI에 토큰 설정

**방법 1: 환경 변수로 설정 (추천)**

```bash
# Linux/Mac
export K6_CLOUD_TOKEN="your_token_here"

# Windows (PowerShell)
$env:K6_CLOUD_TOKEN="your_token_here"

# Windows (CMD)
set K6_CLOUD_TOKEN=your_token_here
```

**방법 2: k6 login 명령어 사용**

```bash
k6 login cloud --token your_token_here
```

**방법 3: 스크립트가 자동으로 물어봄**

토큰 설정 없이 실행하면 스크립트가 자동으로 토큰을 입력받습니다!

---

## 🚀 테스트 실행

### MobaXterm에서 실행

```bash
# 1. k6 서버에 SSH 접속
ssh -i /drives/c/dev/key/coreconnect_key.pem ubuntu@15.165.50.43

# 2. 테스트 디렉토리로 이동
cd ~/k6-tests

# 3. 파일 업로드 확인
ls -la login-test-cloud.js run-cloud-test.sh

# 4. 실행 권한 부여
chmod +x run-cloud-test.sh

# 5. 테스트 실행!
./run-cloud-test.sh
```

### 직접 실행 (스크립트 없이)

```bash
cd ~/k6-tests

# k6 Cloud 토큰 설정 (최초 1회)
export K6_CLOUD_TOKEN="your_token_here"

# 테스트 실행
BASE_URL=http://3.38.28.172:8080 k6 cloud login-test-cloud.js
```

### 실행 시 출력 예시

```
          /\      |‾‾| /‾‾/   /‾‾/   
     /\  /  \     |  |/  /   /  /    
    /  \/    \    |     (   /   ‾‾\  
   /          \   |  |\  \ |  (‾)  | 
  / __________ \  |__| \__\ \_____/ .io

  execution: cloud
  output: https://app.k6.io/runs/1234567
  script: login-test-cloud.js

     ✓ ✅ 로그인 성공 (200)
     ✓ ✅ 응답에 이메일 포함
     ✓ ✅ 쿠키에 토큰 포함
     ✓ ⚡ 응답 시간 < 1초

     checks.........................: 100.00% ✓ 3980   ✗ 0   
     data_received..................: 1.2 MB  20 kB/s
     data_sent......................: 456 kB  7.6 kB/s
     http_req_blocked...............: avg=1.23ms  min=0s     med=1ms    max=50ms  
     http_req_duration..............: avg=145ms   min=89ms   med=132ms  max=450ms 
     http_reqs......................: 995     16.583/s
     login_count....................: 995     16.583/s
     login_duration.................: avg=145ms   min=89ms   med=132ms  max=450ms
     login_success_rate.............: 100.00% ✓ 995    ✗ 0
     vus............................: 100     min=0    max=100

     ✓ http_req_duration..............: avg=145ms   min=89ms   med=132ms  max=450ms
     ✓ http_req_failed................: 0.00%   ✓ 0      ✗ 995
     ✓ login_success_rate.............: 100.00% ✓ 995    ✗ 0
     ✓ checks.........................: 100.00% ✓ 3980   ✗ 0

running (4m00.0s), 000/100 VUs, 995 complete and 0 interrupted iterations
default ✓ [======================================] 100 VUs  4m0s
```

---

## 📊 결과 확인

### 1️⃣ 실시간 모니터링

테스트 시작 시 출력되는 URL을 클릭:

```
output: https://app.k6.io/runs/1234567
         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
         이 링크를 브라우저에서 열기!
```

### 2️⃣ k6 Cloud 대시보드에서 확인

1. **브라우저 접속**: https://app.k6.io/runs
2. **최근 테스트** 목록에서 "CoreConnect - Login Load Test" 클릭

### 3️⃣ 대시보드에서 볼 수 있는 정보

**📈 Performance Overview**
- Virtual Users (VUs)
- Requests per Second (RPS)
- Response Time (평균, P95, P99)
- Error Rate

**📊 HTTP Metrics**
- Request Duration
- Request Rate
- Failed Requests
- Data Transfer

**✅ Checks & Thresholds**
- 로그인 성공률
- 응답 시간 임계값
- 체크 성공률

**🌍 Geographic Distribution**
- 테스트 실행 지역
- 지역별 성능

**📝 Logs & Events**
- 에러 로그
- 경고 메시지
- 중요 이벤트

---

## ⚙️ 커스터마이징

### VU 수와 테스트 기간 변경

`login-test-cloud.js` 파일의 `stages` 수정:

```javascript
export const options = {
    stages: [
        { duration: '1m', target: 200 },   // 1분간 200 VU까지 증가
        { duration: '5m', target: 200 },   // 5분간 200 VU 유지
        { duration: '1m', target: 0 },     // 1분간 0 VU로 감소
    ],
};
```

### 임계값 변경

```javascript
thresholds: {
    'http_req_duration': ['p(95)<300', 'p(99)<800'],  // 더 엄격한 기준
    'http_req_failed': ['rate<0.001'],                 // 에러율 0.1% 미만
    'login_success_rate': ['rate>0.995'],              // 99.5% 이상
},
```

### 테스트 지역 변경

```javascript
ext: {
    loadimpact: {
        distribution: {
            'amazon:us:ashburn': { loadZone: 'amazon:us:ashburn', percent: 100 }
            // 또는 여러 지역 동시 테스트:
            // 'amazon:ap:northeast:2': { percent: 50 },
            // 'amazon:us:ashburn': { percent: 50 }
        }
    }
}
```

**사용 가능한 지역:**
- `amazon:ap:northeast:2` - 서울
- `amazon:us:ashburn` - 미국 동부
- `amazon:eu:dublin` - 유럽 (아일랜드)
- `amazon:ap:singapore` - 싱가포르

---

## 🔍 문제 해결

### ❌ "authentication required" 에러

**원인**: k6 Cloud 토큰이 설정되지 않음

**해결**:
```bash
export K6_CLOUD_TOKEN="your_token_here"
# 또는
k6 login cloud --token your_token_here
```

### ❌ "connection refused" 에러

**원인**: API 서버에 접근 불가

**해결**:
1. API 서버가 실행 중인지 확인
2. BASE_URL이 올바른지 확인
3. 방화벽/Security Group 설정 확인

### ❌ "login failed" 에러

**원인**: 테스트 사용자가 DB에 없음

**해결**:
```bash
# MySQL에 테스트 사용자 확인
mysql -h 3.38.28.172 -P 3306 -u root -p coreconnect
> SELECT COUNT(*) FROM user WHERE email LIKE 'testuser%';
```

### ⚠️ 무료 플랜 한도 초과

**k6 Cloud 무료 플랜:**
- 월 50 VU-hours
- 최대 10분 테스트
- 동시 1개 테스트

**계산 예시:**
- 100 VUs × 4분 = 6.67 VU-hours
- 월 약 7-8회 테스트 가능

**한도 초과 시:**
1. 테스트 기간 단축
2. VU 수 감소
3. 유료 플랜 고려

---

## 📚 추가 리소스

- **k6 Cloud 문서**: https://grafana.com/docs/k6/latest/results-output/real-time/cloud/
- **k6 Cloud 가격**: https://k6.io/pricing
- **k6 예제**: https://k6.io/docs/examples/

---

## 🎯 다음 단계

1. ✅ k6 Cloud 계정 생성
2. ✅ API 토큰 발급
3. ✅ 첫 번째 테스트 실행
4. 📊 결과 분석 및 최적화
5. 🚀 다른 시나리오 테스트 (채팅, 알림 등)

---

**Happy Load Testing! 🚀**
