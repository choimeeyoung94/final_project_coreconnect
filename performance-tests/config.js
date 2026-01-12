// k6 성능 테스트 공통 설정 파일

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
export const WS_URL = __ENV.WS_URL || 'ws://localhost:8080';

// 테스트 시나리오별 VU (Virtual Users) 설정
export const SCENARIOS = {
  // 가벼운 부하 테스트 (스모크 테스트)
  smoke: {
    executor: 'constant-vus',
    vus: 5,
    duration: '1m',
  },

  // 중간 부하 테스트
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 50 },   // 2분간 50명까지 증가
      { duration: '5m', target: 50 },   // 5분간 50명 유지
      { duration: '2m', target: 100 },  // 2분간 100명까지 증가
      { duration: '5m', target: 100 },  // 5분간 100명 유지
      { duration: '2m', target: 0 },    // 2분간 0명까지 감소
    ],
  },

  // 스트레스 테스트 (한계 테스트)
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 100 },
      { duration: '5m', target: 100 },
      { duration: '2m', target: 200 },
      { duration: '5m', target: 200 },
      { duration: '2m', target: 300 },
      { duration: '5m', target: 300 },
      { duration: '3m', target: 0 },
    ],
  },

  // 스파이크 테스트 (급격한 부하 증가)
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: 100 },
      { duration: '1m', target: 100 },
      { duration: '10s', target: 500 },  // 급격한 증가
      { duration: '3m', target: 500 },
      { duration: '10s', target: 100 },
      { duration: '3m', target: 100 },
      { duration: '10s', target: 0 },
    ],
  },
};

// 임계값 설정 (성능 목표)
export const THRESHOLDS = {
  // HTTP 요청 실패율은 1% 미만
  http_req_failed: ['rate<0.01'],

  // HTTP 요청 응답 시간
  http_req_duration: [
    'p(95)<500',   // 95%의 요청이 500ms 이내
    'p(99)<1000',  // 99%의 요청이 1000ms 이내
  ],

  // WebSocket 연결 시간
  ws_connecting: ['p(95)<1000'],

  // WebSocket 메시지 전송 시간
  ws_session_duration: ['p(95)<30000'],
};

// 테스트용 사용자 정보 (코어커넥트 실제 계정)
export const TEST_USERS = [
  { email: 'admin@coreconnect.io.kr', password: '1' },  // 관리자
  { email: 'kms@coreconnect.io.kr', password: '1' },    // 김민석
  { email: 'sss@coreconnect.io.kr', password: '1' },    // 신성수
  { email: 'ldw@coreconnect.io.kr', password: '1' },    // 이동욱
  { email: 'lyc@coreconnect.io.kr', password: '1' },    // 이유천
  { email: 'cmy@coreconnect.io.kr', password: '1' },    // 최미영
];

// JWT 토큰 획득 함수
export function getAuthToken(email, password) {
  const loginUrl = `${BASE_URL}/api/v1/user/login`;
  const payload = JSON.stringify({
    email: email,
    password: password,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = http.post(loginUrl, payload, params);

  if (response.status === 200) {
    const body = JSON.parse(response.body);
    return body.token || body.accessToken; // API 응답 구조에 맞게 수정
  }

  console.error(`Login failed for ${email}: ${response.status}`);
  return null;
}
