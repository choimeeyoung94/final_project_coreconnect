import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

// 사용자 데이터 로드
const users = new SharedArray('users', function () {
  return [
    { email: 'admin@coreconnect.io.kr', password: '1' },
    { email: 'ldw@coreconnect.io.kr', password: '1' },
    { email: 'sss@coreconnect.io.kr', password: '1' },
  ];
});

// K6 옵션
export const options = {
  // 시나리오 설정
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
  
  // 임계값 설정 (실제 성능 기반)
  thresholds: {
    'http_req_duration{type:email_inbox}': ['p(95)<250'], // 이메일 조회 95% 250ms 이하
    'http_req_duration{type:chat_latest}': ['p(95)<250'], // 채팅 조회 95% 250ms 이하
    'http_req_duration{type:notif}': ['p(95)<250'], // 알림 조회 95% 250ms 이하
    http_req_failed: ['rate<0.05'], // 실패율 5% 미만
    checks: ['rate>0.90'], // 체크 통과율 90% 이상
  },
};

// 기본 설정
const BASE_URL = 'http://coreconnect.io.kr/api/v1';

// 로그인 함수
function login(email, password, jar) {
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: email,
    password: password,
  }), {
    headers: { 'Content-Type': 'application/json' },
    jar: jar,
  });

  const loginSuccess = check(loginRes, {
    'login successful': (r) => r.status === 200,
  });

  if (!loginSuccess) {
    console.error(`❌ 로그인 실패: ${loginRes.status} - ${email}`);
  }

  return loginSuccess;
}

// 이메일 받은편지함 조회
export function emailInbox() {
  const jar = http.cookieJar();
  const user = users[Math.floor(Math.random() * users.length)];
  
  // 로그인
  const loginSuccess = login(user.email, user.password, jar);
  if (!loginSuccess) {
    return;
  }

  sleep(0.5);

  // 1. 받은편지함 조회 (필수 파라미터: userEmail)
  const inboxRes = http.get(
    `${BASE_URL}/email/inbox?userEmail=${encodeURIComponent(user.email)}&page=0&size=20&filter=ALL`,
    {
      jar: jar,
      tags: { type: 'email_inbox' },
    }
  );

  const inboxCheck = check(inboxRes, {
    'inbox loaded': (r) => r.status === 200,
    'inbox has content': (r) => {
      try {
        const body = r.json();
        return body && (body.content !== undefined || body.data !== undefined);
      } catch (e) {
        return false;
      }
    },
  });

  if (!inboxCheck) {
    console.error(`❌ 받은편지함 조회 실패: ${inboxRes.status}`);
  }

  sleep(1);

  // 2. 안읽은 메일 개수 조회
  const unreadCountRes = http.get(
    `${BASE_URL}/email/inbox/unread-count?userEmail=${encodeURIComponent(user.email)}`,
    {
      jar: jar,
      tags: { type: 'email_unread_count' },
    }
  );

  check(unreadCountRes, {
    'unread count loaded': (r) => r.status === 200,
  });

  sleep(1);

  // 3. 즐겨찾기 메일 조회
  const favoriteRes = http.get(
    `${BASE_URL}/email/favorite?userEmail=${encodeURIComponent(user.email)}&page=0&size=20`,
    {
      jar: jar,
      tags: { type: 'email_favorite' },
    }
  );

  check(favoriteRes, {
    'favorite emails loaded': (r) => r.status === 200,
  });

  sleep(1);
}

// 채팅 최근 목록 조회
export function chatLatest() {
  const jar = http.cookieJar();
  const user = users[Math.floor(Math.random() * users.length)];
  
  // 로그인
  const loginSuccess = login(user.email, user.password, jar);
  if (!loginSuccess) {
    return;
  }

  sleep(0.5);

  // 1. 채팅방별 최근 메시지 조회
  const latestRes = http.get(
    `${BASE_URL}/chat/rooms/messages/latest`,
    {
      jar: jar,
      tags: { type: 'chat_latest' },
    }
  );

  const chatCheck = check(latestRes, {
    'chat rooms latest loaded': (r) => r.status === 200,
    'chat has data': (r) => {
      try {
        const body = r.json();
        return body && (Array.isArray(body) || body.data !== undefined);
      } catch (e) {
        return false;
      }
    },
  });

  if (!chatCheck) {
    console.error(`❌ 채팅 최근 메시지 조회 실패: ${latestRes.status}`);
  }

  sleep(1);

  // 2. 안읽은 메시지 조회
  const unreadRes = http.get(
    `${BASE_URL}/chat/messages/unread`,
    {
      jar: jar,
      tags: { type: 'chat_unread' },
    }
  );

  check(unreadRes, {
    'chat unread messages loaded': (r) => r.status === 200,
  });

  sleep(1);
}

// 알림 조회
export function notificationFetch() {
  const jar = http.cookieJar();
  const user = users[Math.floor(Math.random() * users.length)];
  
  // 로그인
  const loginSuccess = login(user.email, user.password, jar);
  if (!loginSuccess) {
    return;
  }

  sleep(0.5);

  // 1. 미읽은 알림 조회
  const unreadNotifRes = http.get(
    `${BASE_URL}/chat/notifications/unread`,
    {
      jar: jar,
      tags: { type: 'notif_unread' },
    }
  );

  const notifCheck = check(unreadNotifRes, {
    'unread notifications loaded': (r) => r.status === 200,
  });

  if (!notifCheck) {
    console.error(`❌ 미읽은 알림 조회 실패: ${unreadNotifRes.status}`);
  }

  sleep(1);

  // 2. 전체 알림 조회
  const allNotifRes = http.get(
    `${BASE_URL}/chat/notifications`,
    {
      jar: jar,
      tags: { type: 'notif_all' },
    }
  );

  check(allNotifRes, {
    'all notifications loaded': (r) => r.status === 200,
  });

  sleep(1);

  // 3. 모든 안읽은 알림 조회
  const allUnreadRes = http.get(
    `${BASE_URL}/chat/notifications/unread/all`,
    {
      jar: jar,
      tags: { type: 'notif' },
    }
  );

  check(allUnreadRes, {
    'all unread notifications loaded': (r) => r.status === 200,
  });

  sleep(1);
}

// 기본 함수
export default function () {
  sleep(1);
}
