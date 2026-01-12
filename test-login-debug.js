import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '10s',
  thresholds: {
    http_req_failed: ['rate<1.0'], // 100% 실패도 허용 (디버깅용)
  },
};

const BASE_URL = 'http://coreconnect.io.kr';

export default function () {
  console.log('========================================');
  console.log('로그인 테스트 시작');
  console.log('========================================');

  // 테스트 1: 루트 경로 접근
  console.log('\n[1] 루트 경로 테스트...');
  const rootRes = http.get(`${BASE_URL}/`);
  console.log(`  - Status: ${rootRes.status}`);
  console.log(`  - Body length: ${rootRes.body.length}`);

  // 테스트 2: 로그인 API 테스트 (여러 가능한 엔드포인트)
  const loginEndpoints = [
    '/api/auth/login',
    '/api/login',
    '/auth/login',
    '/login',
  ];

  const credentials = {
    email: 'admin@coreconnect.io.kr',
    password: 'password123',
  };

  loginEndpoints.forEach((endpoint) => {
    console.log(`\n[2] 로그인 테스트: ${endpoint}`);
    
    const loginRes = http.post(`${BASE_URL}${endpoint}`, JSON.stringify(credentials), {
      headers: { 'Content-Type': 'application/json' },
    });

    console.log(`  - Status: ${loginRes.status}`);
    console.log(`  - Body: ${loginRes.body.substring(0, 200)}`); // 처음 200자만
    
    if (loginRes.status === 200) {
      console.log('  ✅ 로그인 성공!');
      
      // 토큰 추출 시도
      try {
        const jsonBody = loginRes.json();
        console.log(`  - JSON Response: ${JSON.stringify(jsonBody)}`);
      } catch (e) {
        console.log(`  - JSON 파싱 실패: ${e}`);
      }

      // 쿠키 확인
      if (loginRes.cookies && Object.keys(loginRes.cookies).length > 0) {
        console.log('  - Cookies:');
        Object.keys(loginRes.cookies).forEach((key) => {
          console.log(`    ${key}: ${loginRes.cookies[key][0].value}`);
        });
      } else {
        console.log('  - Cookies: 없음');
      }

      // 헤더 확인
      console.log('  - Headers:');
      Object.keys(loginRes.headers).forEach((key) => {
        if (key.toLowerCase().includes('auth') || key.toLowerCase().includes('token')) {
          console.log(`    ${key}: ${loginRes.headers[key]}`);
        }
      });
    } else {
      console.log(`  ❌ 로그인 실패: ${loginRes.status}`);
    }
  });

  console.log('\n========================================');
  console.log('테스트 완료');
  console.log('========================================\n');
  
  sleep(10); // 10초 대기 후 종료
}

