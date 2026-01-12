/**
 * k6 부하 테스트 스크립트: 채팅방 목록/최신 메시지 조회 성능 측정
 * 
 * 목적: N+1 제거, 인덱스 최적화, 페이징 등 개선 사항 성능 검증
 * 
 * 실행 방법:
 * export K6_CLOUD_PROJECT_ID=6156169
 * export K6_CLOUD_TOKEN=YOUR_TOKEN
 * export BASE_URL=http://54.116.26.182:8080
 * export USER_EMAIL=admin@coreconnect.io.kr
 * export USER_PASSWORD=1
 * 
 * k6 run --out cloud k6-chatroom-performance-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// ==========================================
// 환경 변수 설정
// ==========================================
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const LOGIN_PATH = __ENV.LOGIN_PATH || '/api/v1/auth/login';
const CHAT_LIST_PATH = __ENV.CHAT_LIST_PATH || '/api/v1/chat/rooms/messages/latest';
const USER_EMAIL = __ENV.USER_EMAIL || 'admin@coreconnect.io.kr';
const USER_PASSWORD = __ENV.USER_PASSWORD || '1';

// ==========================================
// 커스텀 메트릭 정의
// ==========================================
const chatLatency = new Trend('chat_latency_ms', true);
const loginLatency = new Trend('login_latency_ms', true);
const loginFail = new Rate('login_fail');
const chatFail = new Rate('chat_fail');
const errorRate = new Rate('error_rate');
const totalRequests = new Counter('total_requests');
const successfulRequests = new Counter('successful_requests');

// ==========================================
// k6 Cloud 설정 및 테스트 옵션
// ==========================================
export const options = {
  // k6 Cloud 메타데이터
  ext: {
    loadimpact: {
      projectID: __ENV.K6_CLOUD_PROJECT_ID ? Number(__ENV.K6_CLOUD_PROJECT_ID) : undefined,
      name: __ENV.K6_TEST_NAME || 'Chatroom Performance - Post Optimization',
      note: '채팅방 목록 조회 성능 측정 (N+1 제거, 인덱스 최적화, 페이징 적용 후)',
    },
  },

  // Thresholds (성능 목표)
  thresholds: {
    // 채팅 API 지연 시간
    'chat_latency_ms': [
      'p(95)<500',      // P95: 500ms 미만
      'p(99)<1000',     // P99: 1초 미만
      'avg<300',        // 평균: 300ms 미만
    ],
    
    // 로그인 지연 시간
    'login_latency_ms': [
      'p(95)<2000',     // 로그인은 2초 미만
    ],
    
    // HTTP 요청 실패율
    'http_req_failed': ['rate<0.01'],  // 1% 미만
    
    // 채팅 API 실패율
    'chat_fail': ['rate<0.01'],        // 1% 미만
    
    // 로그인 실패율
    'login_fail': ['rate<0.05'],       // 5% 미만
    
    // 전체 에러율
    'error_rate': ['rate<0.01'],       // 1% 미만
    
    // HTTP 요청 지속 시간
    'http_req_duration': [
      'p(95)<1000',     // P95: 1초 미만
      'p(99)<2000',     // P99: 2초 미만
    ],
    
    // HTTP 요청 대기 시간
    'http_req_waiting': ['p(95)<800'], // P95: 800ms 미만
  },

  // 테스트 시나리오
  scenarios: {
    // Warmup: 점진적 부하 증가 (시스템 준비)
    warmup: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 5 },   // 30초 동안 5 VU까지 증가
        { duration: '1m', target: 5 },    // 1분 동안 5 VU 유지
        { duration: '30s', target: 0 },   // 30초 동안 0으로 감소
      ],
      gracefulRampDown: '10s',
      startTime: '0s',
    },

    // Main: 점진적 부하 증가 (실제 측정)
    main: {
      executor: 'ramping-arrival-rate',
      startRate: 5,                       // 초당 5 요청으로 시작
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 50,
      stages: [
        { duration: '2m', target: 10 },   // 2분 동안 10 rps로 증가
        { duration: '3m', target: 15 },   // 3분 동안 15 rps로 증가
        { duration: '2m', target: 20 },   // 2분 동안 20 rps로 증가
        { duration: '2m', target: 10 },   // 2분 동안 10 rps로 감소
        { duration: '1m', target: 5 },    // 1분 동안 5 rps로 감소
      ],
      gracefulStop: '30s',
      startTime: '2m',                    // warmup 이후 시작
    },

    // Spike: 급격한 부하 증가 (한계 테스트)
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 30 },  // 10초 만에 30 VU로 급증
        { duration: '1m', target: 30 },   // 1분 동안 30 VU 유지
        { duration: '10s', target: 0 },   // 10초 만에 0으로 감소
      ],
      gracefulRampDown: '10s',
      startTime: '12m',                   // main 이후 시작
    },
  },

  // 전역 설정
  noConnectionReuse: false,             // Keep-Alive 활성화
  userAgent: 'k6-performance-test/1.0',
  tags: {
    test_type: 'chatroom_performance',
    environment: 'production',
    version: 'post-optimization',
  },
};

// ==========================================
// Setup: 로그인 및 토큰 획득
// ==========================================
export function setup() {
  console.log('🚀 [Setup] 테스트 시작 - 로그인 수행...');
  
  const cookieHeader = loginAndGetCookie();
  
  if (!cookieHeader) {
    console.error('❌ [Setup] 로그인 실패 - 테스트 중단');
    throw new Error('Login failed in setup; aborting test.');
  }
  
  console.log('✅ [Setup] 로그인 성공');
  console.log(`📊 [Setup] 테스트 대상: ${BASE_URL}${CHAT_LIST_PATH}`);
  console.log('⏱️  [Setup] 목표: P95 < 500ms, RPS 10-15+, 에러율 < 1%');
  
  return { 
    cookieHeader,
    startTime: new Date().toISOString(),
  };
}

// ==========================================
// Main: VU가 반복 실행할 테스트 로직
// ==========================================
export default function (data) {
  const headers = {
    'Cookie': data.cookieHeader,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  // 채팅방 목록 조회 (페이징 포함)
  const params = {
    headers: headers,
    timeout: '30s',
    tags: { 
      endpoint: 'chat_list_latest',
      api_version: 'v1',
    },
  };

  // 페이징 파라미터 랜덤 (page=0~2, size=10~30)
  const page = Math.floor(Math.random() * 3);
  const size = 10 + Math.floor(Math.random() * 21); // 10~30
  const url = `${BASE_URL}${CHAT_LIST_PATH}?page=${page}&size=${size}`;

  const startTime = new Date().getTime();
  const res = http.get(url, params);
  const duration = new Date().getTime() - startTime;

  // 요청 카운터 증가
  totalRequests.add(1);

  // 응답 검증
  const isSuccess = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 1s': (r) => r.timings.duration < 1000,
    'has response body': (r) => r.body && r.body.length > 0,
    'is valid JSON': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch (e) {
        return false;
      }
    },
    'has success flag': (r) => {
      try {
        const json = JSON.parse(r.body);
        return json.success === true;
      } catch (e) {
        return false;
      }
    },
  });

  // 메트릭 기록
  chatLatency.add(duration);
  chatFail.add(!isSuccess);
  errorRate.add(!isSuccess);

  if (isSuccess) {
    successfulRequests.add(1);
  } else {
    console.error(`❌ [VU ${__VU}] 채팅방 조회 실패 - status: ${res.status}, duration: ${duration}ms`);
  }

  // Think time (1~3초 랜덤 대기)
  sleep(Math.random() * 2 + 1);
}

// ==========================================
// Teardown: 테스트 종료 후 정리
// ==========================================
export function teardown(data) {
  console.log('🏁 [Teardown] 테스트 종료');
  console.log(`📅 [Teardown] 시작 시간: ${data.startTime}`);
  console.log(`📅 [Teardown] 종료 시간: ${new Date().toISOString()}`);
}

// ==========================================
// 헬퍼 함수: 로그인 및 쿠키 추출
// ==========================================
function loginAndGetCookie() {
  const payload = JSON.stringify({
    email: USER_EMAIL,
    password: USER_PASSWORD,
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
    timeout: '30s',
    tags: { endpoint: 'login' },
  };

  console.log(`🔑 [Login] 로그인 시도 - ${BASE_URL}${LOGIN_PATH}`);

  const startTime = new Date().getTime();
  const res = http.post(`${BASE_URL}${LOGIN_PATH}`, payload, params);
  const duration = new Date().getTime() - startTime;

  // 로그인 메트릭 기록
  loginLatency.add(duration);

  const isSuccess = check(res, {
    'login status is 200': (r) => r.status === 200,
    'login has cookies': (r) => r.cookies && (r.cookies.access_token || r.cookies.refresh_token),
  });

  loginFail.add(!isSuccess);
  errorRate.add(!isSuccess);

  if (!isSuccess) {
    console.error(`❌ [Login] 로그인 실패 - status: ${res.status}, body: ${res.body}`);
    return null;
  }

  // 쿠키 추출
  const accessToken = res.cookies?.access_token?.[0]?.value;
  const refreshToken = res.cookies?.refresh_token?.[0]?.value;

  if (!accessToken && !refreshToken) {
    console.error('❌ [Login] 쿠키에서 토큰을 찾을 수 없음');
    return null;
  }

  const cookies = [];
  if (accessToken) cookies.push(`access_token=${accessToken}`);
  if (refreshToken) cookies.push(`refresh_token=${refreshToken}`);

  console.log(`✅ [Login] 로그인 성공 - duration: ${duration}ms`);
  return cookies.join('; ');
}

// ==========================================
// 커스텀 리포트 생성
// ==========================================
export function handleSummary(data) {
  console.log('📊 ===== 테스트 결과 요약 =====');
  console.log(`총 요청 수: ${data.metrics.total_requests?.values?.count || 0}`);
  console.log(`성공 요청 수: ${data.metrics.successful_requests?.values?.count || 0}`);
  console.log(`채팅 API P95: ${(data.metrics.chat_latency_ms?.values?.['p(95)'] || 0).toFixed(2)}ms`);
  console.log(`채팅 API P99: ${(data.metrics.chat_latency_ms?.values?.['p(99)'] || 0).toFixed(2)}ms`);
  console.log(`채팅 API 평균: ${(data.metrics.chat_latency_ms?.values?.avg || 0).toFixed(2)}ms`);
  console.log(`에러율: ${((data.metrics.error_rate?.values?.rate || 0) * 100).toFixed(2)}%`);
  console.log(`채팅 실패율: ${((data.metrics.chat_fail?.values?.rate || 0) * 100).toFixed(2)}%`);
  console.log('============================');

  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.html': htmlReport(data),
  };
}

