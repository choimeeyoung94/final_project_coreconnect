# K6 Cloud 테스트 실행 완전 가이드

## ❌ 발생한 에러

```
ERROR[0001] (404/E3) Resource does not exist
```

**원인**: `test.js` 파일이 없어서 발생한 에러입니다.

---

## ✅ 해결 방법 (2단계)

### 1단계: test.js 파일 서버에 생성

#### 방법 A: 로컬에서 SCP로 전송 (권장)

```bash
# Windows PowerShell 또는 CMD에서 실행
cd C:\dev\final_project_coreconnect
scp test.js ubuntu@3.38.141.119:~/k6-loadtest/
```

#### 방법 B: SSH로 접속해서 직접 생성

```bash
# 1. SSH 접속
ssh ubuntu@3.38.141.119

# 2. k6-loadtest 디렉토리로 이동
cd k6-loadtest

# 3. 기존 파일 확인
ls -la

# 4. nano 에디터로 test.js 생성
nano test.js
```

그런 다음 아래 내용을 붙여넣으세요:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

// 사용자 데이터 로드
const users = new SharedArray('users', function () {
  return [
    { email: 'admin@coreconnect.io.kr', password: 'password123' },
    { email: 'user1@coreconnect.io.kr', password: 'password123' },
    { email: 'user2@coreconnect.io.kr', password: 'password123' },
  ];
});

// K6 Cloud 최적화 옵션
export const options = {
  cloud: {
    projectID: 'coreconnect-개선#1',
    name: 'CoreConnect 성능 테스트',
  },
  
  scenarios: {
    email_inbox: {
      executor: 'ramping-vus',
      exec: 'emailInbox',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 10 },
        { duration: '30s', target: 0 },
      ],
      gracefulStop: '30s',
    },
    chat_latest: {
      executor: 'ramping-vus',
      exec: 'chatLatest',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 10 },
        { duration: '30s', target: 0 },
      ],
      gracefulStop: '30s',
      startTime: '10s',
    },
    notification: {
      executor: 'ramping-vus',
      exec: 'notificationFetch',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 10 },
        { duration: '30s', target: 0 },
      ],
      gracefulStop: '30s',
      startTime: '20s',
    },
  },
  
  thresholds: {
    'http_req_duration{type:email_inbox}': ['p(95)<50'],
    'http_req_duration{type:chat_latest}': ['p(95)<100'],
    'http_req_duration{type:notif}': ['p(95)<30'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = 'http://coreconnect.io.kr';

function login(email, password) {
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: email,
    password: password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginRes, {
    'login successful': (r) => r.status === 200,
  });

  if (loginRes.status === 200) {
    const token = loginRes.json('token') || loginRes.cookies.JSESSIONID[0].value;
    return token;
  }
  return null;
}

export function emailInbox() {
  const user = users[Math.floor(Math.random() * users.length)];
  const token = login(user.email, user.password);

  if (!token) return;

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const inboxRes = http.get(`${BASE_URL}/api/emails/inbox?page=0&size=20`, {
    headers: headers,
    tags: { type: 'email_inbox' },
  });

  check(inboxRes, {
    'inbox loaded': (r) => r.status === 200,
    'inbox has data': (r) => r.json('content') !== undefined,
  });

  sleep(1);

  const unreadRes = http.get(`${BASE_URL}/api/emails/inbox/unread?page=0&size=20`, {
    headers: headers,
    tags: { type: 'email_unread' },
  });

  check(unreadRes, {
    'unread inbox loaded': (r) => r.status === 200,
  });

  sleep(1);

  const favoriteRes = http.get(`${BASE_URL}/api/emails/favorites?page=0&size=20`, {
    headers: headers,
    tags: { type: 'email_favorite' },
  });

  check(favoriteRes, {
    'favorite emails loaded': (r) => r.status === 200,
  });

  sleep(1);
}

export function chatLatest() {
  const user = users[Math.floor(Math.random() * users.length)];
  const token = login(user.email, user.password);

  if (!token) return;

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const latestRes = http.get(`${BASE_URL}/api/chat/rooms/latest`, {
    headers: headers,
    tags: { type: 'chat_latest' },
  });

  check(latestRes, {
    'chat rooms loaded': (r) => r.status === 200,
    'chat rooms has data': (r) => r.json('length') !== undefined || r.json('content') !== undefined,
  });

  sleep(1);

  const unreadRes = http.get(`${BASE_URL}/api/chat/unread-count`, {
    headers: headers,
    tags: { type: 'chat_unread' },
  });

  check(unreadRes, {
    'unread count loaded': (r) => r.status === 200,
  });

  sleep(1);
}

export function notificationFetch() {
  const user = users[Math.floor(Math.random() * users.length)];
  const token = login(user.email, user.password);

  if (!token) return;

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const notifRes = http.get(`${BASE_URL}/api/notifications?page=0&size=20`, {
    headers: headers,
    tags: { type: 'notif' },
  });

  check(notifRes, {
    'notifications loaded': (r) => r.status === 200,
  });

  sleep(1);

  const unreadCountRes = http.get(`${BASE_URL}/api/notifications/unread-count`, {
    headers: headers,
    tags: { type: 'notif_unread' },
  });

  check(unreadCountRes, {
    'unread notification count loaded': (r) => r.status === 200,
  });

  sleep(1);
}

export default function () {
  sleep(1);
}
```

**nano 에디터 저장 방법**:
- `Ctrl + O` (저장)
- `Enter` (파일명 확인)
- `Ctrl + X` (종료)

---

### 2단계: K6 Cloud 테스트 실행

```bash
# SSH로 접속 (아직 접속 안했다면)
ssh ubuntu@3.38.141.119

# k6-loadtest 디렉토리로 이동
cd k6-loadtest

# test.js 파일이 있는지 확인
ls -la test.js

# K6 Cloud 테스트 실행
K6_CLOUD_TOKEN="ce099a2f38a7cD556688c4a969614b793834e379cc70a3d0d6df1356342c0504" k6 run --out cloud test.js
```

---

## 🎯 한 번에 실행하기 (올인원)

### 방법 1: SCP 전송 후 실행 (Windows에서)

```powershell
# 1. test.js 업로드
cd C:\dev\final_project_coreconnect
scp test.js ubuntu@3.38.141.119:~/k6-loadtest/

# 2. SSH로 접속해서 실행
ssh ubuntu@3.38.141.119 "cd k6-loadtest && K6_CLOUD_TOKEN='ce099a2f38a7cD556688c4a969614b793834e379cc70a3d0d6df1356342c0504' k6 run --out cloud test.js"
```

### 방법 2: SSH 접속해서 모든 작업 수행

```bash
# 1. SSH 접속
ssh ubuntu@3.38.141.119

# 2. 디렉토리 이동
cd k6-loadtest

# 3. 기존 test.js가 있다면 백업
[ -f test.js ] && mv test.js test.js.backup

# 4. wget으로 다운로드 (GitHub Gist나 다른 곳에 올려두었다면)
# 또는 nano로 직접 작성

# 5. K6 Cloud 실행
K6_CLOUD_TOKEN="ce099a2f38a7cD556688c4a969614b793834e379cc70a3d0d6df1356342c0504" k6 run --out cloud test.js
```

---

## 📊 예상 실행 결과

```
          /\      |‾‾| /‾‾/   /‾‾/   
     /\  /  \     |  |/  /   /  /    
    /  \/    \    |     (   /   ‾‾\  
   /          \   |  |\  \ |  (‾)  | 
  / __________ \  |__| \__\ \_____/ .io

  execution: cloud
  output: https://choimeeyoung2.grafana.net/a/k6-app/runs/XXXXXX
  script: test.js

  scenarios: (100.00%) 3 scenarios, 30 max VUs, 3m0s max duration

  ✓ checks.........................: 0.00%  ✓ 0        ✗ 0
  ✓ http_req_duration...............: avg=0s min=0s med=0s max=0s p(90)=0s p(95)=0s
  ✓ http_req_failed................: 0.00%  ✓ 0        ✗ 0

  running (2m30.0s), 00/30 VUs, 0 complete and 0 interrupted iterations
```

**중요**: 출력된 URL을 클릭하거나 복사해서 브라우저에서 확인하세요!

---

## 🔍 트러블슈팅

### 에러 1: test.js: No such file or directory

```bash
# 해결: test.js 파일 존재 확인
ls -la test.js

# 파일이 없다면 다시 생성
nano test.js
```

### 에러 2: Resource does not exist (404/E3)

```bash
# 원인: test.js 파일이 없거나 경로가 잘못됨
# 해결: 현재 디렉토리 확인
pwd
ls -la

# k6-loadtest 디렉토리로 이동
cd ~/k6-loadtest
```

### 에러 3: unknown flag: --token

```bash
# 해결: 환경 변수 사용
export K6_CLOUD_TOKEN="ce099a2f38a7cD556688c4a969614b793834e379cc70a3d0d6df1356342c0504"
k6 run --out cloud test.js
```

### 에러 4: Authentication failed

```bash
# 해결: 토큰 재확인
echo $K6_CLOUD_TOKEN

# 토큰이 비어있다면 다시 설정
export K6_CLOUD_TOKEN="ce099a2f38a7cD556688c4a969614b793834e379cc70a3d0d6df1356342c0504"
```

---

## ✅ 실행 체크리스트

- [ ] 1. SSH로 3.38.141.119 서버 접속
- [ ] 2. k6-loadtest 디렉토리로 이동 (`cd k6-loadtest`)
- [ ] 3. test.js 파일 생성/업로드
- [ ] 4. test.js 파일 존재 확인 (`ls -la test.js`)
- [ ] 5. K6_CLOUD_TOKEN 환경 변수 설정
- [ ] 6. k6 run --out cloud test.js 실행
- [ ] 7. 출력된 Grafana Cloud URL 확인
- [ ] 8. 브라우저에서 결과 확인

---

## 🎯 가장 빠른 방법 (추천)

```bash
# 1. SSH 접속
ssh ubuntu@3.38.141.119

# 2. 모든 명령어 한 번에 실행
cd k6-loadtest && \
export K6_CLOUD_TOKEN="ce099a2f38a7cD556688c4a969614b793834e379cc70a3d0d6df1356342c0504" && \
ls -la test.js && \
k6 run --out cloud test.js
```

만약 test.js가 없다고 나오면:
```bash
# nano로 test.js 생성 후 위의 JavaScript 코드 붙여넣기
nano test.js
```

---

**작성일**: 2025-12-17  
**서버**: 3.38.141.119 (K6 전용)  
**Grafana Cloud**: https://choimeeyoung2.grafana.net/a/k6-app/

