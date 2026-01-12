import http from 'k6/http';
import { check, sleep } from 'k6';

// EC2에서 port-forward(127.0.0.1:18080) 기준으로 동작
// 필요 시: BASE_URL 환경변수로 덮어쓰기 (예: BASE_URL=http://127.0.0.1:8080)
const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:18080';

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'], // 실패율 1% 미만
    http_req_duration: ['p(95)<1000'], // p95 1초 미만
  },
};

export default function () {
  const loginUrl = `${BASE_URL}/api/v1/auth/login`;

  const payload = JSON.stringify({
    email: 'test@coreconnect.io.kr',
    password: 'test123!',
  });

  const res = http.post(loginUrl, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'login status is 200': (r) => r.status === 200,
    // 로그인 성공 시 HttpOnly 쿠키로 토큰을 내려줌
    'sets access_token cookie': (r) => r.cookies?.access_token?.length > 0,
    'sets refresh_token cookie': (r) => r.cookies?.refresh_token?.length > 0,
  });

  // 실패 시 원인 확인용 출력(부하가 커지면 로그가 많아지니 필요 시 주석 처리)
  if (res.status !== 200) {
    console.log(`Login failed: status=${res.status}, body=${res.body || '(empty)'}`);
  }

  sleep(1);
}


