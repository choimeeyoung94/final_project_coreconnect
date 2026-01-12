import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 10,
  duration: '30s',
};

export default function () {
  const baseUrl = __ENV.BASE_URL || 'http://43.201.250.130:8080';
  const loginUrl = `${baseUrl}/api/v1/auth/login`;
  
  const payload = JSON.stringify({
    email: 'test@coreconnect.io.kr',
    password: 'test123!',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(loginUrl, payload, params);
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    // 이 API는 토큰을 body로 주지 않고 HttpOnly 쿠키(Set-Cookie)로 내려줍니다.
    'sets access_token cookie': (r) => r.cookies && r.cookies.access_token && r.cookies.access_token.length > 0,
    'sets refresh_token cookie': (r) => r.cookies && r.cookies.refresh_token && r.cookies.refresh_token.length > 0,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
  });
  
  if (res.status === 200) {
    // 필요하면 응답 body(사용자 정보) 출력
    // console.log(res.body);
  } else {
    console.log(`Login failed: ${res.status} - ${res.body || '(empty body)'}`);
  }
  
  sleep(1);
}

