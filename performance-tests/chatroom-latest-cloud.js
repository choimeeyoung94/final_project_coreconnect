import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const LOGIN_PATH = __ENV.LOGIN_PATH || '/api/v1/auth/login';
const CHAT_PATH = __ENV.CHAT_PATH || '/api/v1/chat/rooms/messages/latest';
const USER_EMAIL = __ENV.USER_EMAIL || 'admin@coreconnect.io.kr';
const USER_PASSWORD = __ENV.USER_PASSWORD || '1';

const chatLatency = new Trend('chat_latency_ms');
const loginFail = new Rate('login_fail');
const chatFail = new Rate('chat_fail');
const errorRate = new Rate('error_rate');

export const options = {
  ext: {
    loadimpact: {
      // Provide via env: K6_CLOUD_PROJECT_ID (required), K6_CLOUD_TOKEN (CLI)
      projectID: __ENV.K6_CLOUD_PROJECT_ID ? Number(__ENV.K6_CLOUD_PROJECT_ID) : undefined,
      name: __ENV.K6_TEST_NAME || 'chatroom-latest-n1',
      note: 'Login -> chatroom list with latest message (N+1 watch) | Targets: p95 < 500ms, error < 1%, RPS 10-15 @ 20 VU',
    },
  },
  thresholds: {
    chat_latency_ms: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    chat_fail: ['rate<0.01'],
    login_fail: ['rate<0.05'],
    http_req_duration: ['p(99)<1000'],
  },
  scenarios: {
    warmup: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 5 },
        { duration: '30s', target: 5 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
    main: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 10,
      maxVUs: 30,
      stages: [
        { duration: '2m', target: 10 }, // ramp to ~10 rps
        { duration: '3m', target: 15 }, // hold target range
        { duration: '2m', target: 5 },  // ramp down
      ],
      gracefulStop: '30s',
    },
  },
};

export function setup() {
  const cookieHeader = loginAndGetCookie();
  if (!cookieHeader) {
    throw new Error('Login failed in setup; aborting test.');
  }
  return { cookieHeader };
}

export default function (data) {
  const headers = {
    Cookie: data.cookieHeader,
    'Content-Type': 'application/json',
  };

  const res = http.get(`${BASE_URL}${CHAT_PATH}`, { headers, timeout: '30s', tags: { endpoint: 'chat_list_latest' } });

  const ok = check(res, {
    'chat 200': (r) => r.status === 200,
    'has body': (r) => !!r.body,
  });

  chatLatency.add(res.timings.duration);
  chatFail.add(!ok);
  errorRate.add(!ok);

  sleep(Math.random() * 2 + 1); // 1–3s think time
}

function loginAndGetCookie() {
  const payload = JSON.stringify({
    email: USER_EMAIL,
    password: USER_PASSWORD,
  });

  const res = http.post(
    `${BASE_URL}${LOGIN_PATH}`,
    payload,
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: '30s',
      tags: { endpoint: 'login' },
    },
  );

  const ok = check(res, {
    'login 200': (r) => r.status === 200,
  });
  loginFail.add(!ok);
  errorRate.add(!ok);
  if (!ok) {
    return null;
  }

  const access = res.cookies?.access_token?.[0]?.value;
  const refresh = res.cookies?.refresh_token?.[0]?.value;
  const cookies = [];
  if (access) cookies.push(`access_token=${access}`);
  if (refresh) cookies.push(`refresh_token=${refresh}`);
  return cookies.join('; ');
}








