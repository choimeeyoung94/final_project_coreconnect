import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Trend, Rate } from 'k6/metrics';

// ========================================
// 📊 커스텀 메트릭
// ========================================
const chatroomListCalls = new Counter('chatroom_list_calls');
const chatroomListSuccess = new Counter('chatroom_list_success');
const chatroomListFailed = new Counter('chatroom_list_failed');
const chatroomListLatency = new Trend('chatroom_list_latency_ms');
const loginFailed = new Counter('login_failed');
const errorRate = new Rate('error_rate');

// ========================================
// 🔧 환경 설정
// ========================================
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TEST_USERS = [
  { email: 'admin@coreconnect.io.kr', password: '1' },
  { email: 'kms@coreconnect.io.kr', password: '1' },
  { email: 'sss@coreconnect.io.kr', password: '1' },
  { email: 'ldw@coreconnect.io.kr', password: '1' },
  { email: 'lyc@coreconnect.io.kr', password: '1' },
  { email: 'cmy@coreconnect.io.kr', password: '1' },
];

// ========================================
// 🎯 테스트 시나리오
// ========================================
export const options = {
  ext: {
    loadimpact: {
      name: "채팅방 목록 조회 N+1 문제 성능 측정 (Cloud)",
      note: "AS-IS(N+1) vs TO-BE(Fetch Join) 성능 비교"
    }
  },
  
  scenarios: {
    // 초경량 부하 테스트 (k6 Cloud 네트워크 고려)
    light_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 2 },   // 천천히 2명까지
        { duration: '3m', target: 2 },   // 2명 유지
        { duration: '2m', target: 5 },   // 5명까지
        { duration: '3m', target: 5 },   // 5명 유지
        { duration: '2m', target: 0 },   // 종료
      ],
      exec: 'testChatroomList',
      gracefulStop: '60s',  // 종료 대기 시간 증가
    },
  },
  
  // Cloud 환경에 맞춘 완화된 임계값
  thresholds: {
    'chatroom_list_latency_ms': ['p(95)<2000'],  // 2초 미만
    'http_req_duration': ['p(95)<3000'],          // 3초 미만
    'error_rate': ['rate<0.3'],                   // 30% 미만
    'http_req_failed': ['rate<0.3'],              // 30% 미만
  },
  
  // HTTP 디버깅
  httpDebug: 'full',
};

// ========================================
// 🔐 JWT 토큰 획득 (재시도 로직 포함)
// ========================================
function getAuthToken(email, password, retries = 5) {  // 5회 재시도 (k6 Cloud용)
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[LOGIN] 시도 ${attempt}/${retries} - ${email}`);
      
      const response = http.post(
        `${BASE_URL}/api/v1/auth/login`,  // ⭐ 경로 수정!
        JSON.stringify({ email, password }),
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: '120s',  // 120초 타임아웃 (k6 Cloud용)
          tags: { name: 'login' },
        }
      );

      console.log(`[LOGIN] 응답: ${response.status}`);
      
      if (response.status === 200) {
        const body = JSON.parse(response.body);
        const token = body.data?.token || body.token || body.accessToken;
        
        if (token) {
          console.log(`[LOGIN] ✅ 성공! (시도 ${attempt})`);
          return token;
        }
      }
      
      // 재시도 전 대기
      if (attempt < retries) {
        const waitTime = attempt * 5;  // 5초씩 증가 (k6 Cloud용)
        console.log(`[LOGIN] ⏳ ${waitTime}초 대기 후 재시도...`);
        sleep(waitTime);
      }
    } catch (error) {
      console.error(`[LOGIN] ❌ 에러 (시도 ${attempt}): ${error}`);
      if (attempt < retries) {
        const waitTime = attempt * 5;  // 5초씩 증가 (k6 Cloud용)
        sleep(waitTime);
      }
    }
  }
  
  loginFailed.add(1);
  errorRate.add(1);
  console.error(`[LOGIN] ❌ ${retries}번 시도 실패: ${email}`);
  return null;
}

// ========================================
// 📋 채팅방 목록 조회 (재시도 로직 포함)
// ========================================
function getChatroomList(token, userId, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const url = `${BASE_URL}/api/v1/chat/rooms/messages/latest`;
      const params = {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: '120s',  // 120초 타임아웃 (k6 Cloud용)
        tags: { api: 'chatroom_list' },
      };

      const startTime = Date.now();
      const response = http.get(url, params);
      const latency = Date.now() - startTime;

      chatroomListCalls.add(1);
      chatroomListLatency.add(latency);

      const success = check(response, {
        '상태 코드 200': (r) => r.status === 200,
        '응답 시간 < 2000ms': () => latency < 2000,
        'JSON 파싱 가능': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body && body.data !== undefined;
          } catch (e) {
            return false;
          }
        },
      });

      if (response.status === 200) {
        chatroomListSuccess.add(1);
        try {
          const body = JSON.parse(response.body);
          const roomCount = body.data?.length || 0;
          console.log(`[${userId}] ✅ 성공 - ${roomCount}개 채팅방, ${latency}ms`);
        } catch (e) {
          console.error(`[${userId}] ⚠️ JSON 파싱 실패`);
        }
        return { response, latency, success };
      } else if (attempt < retries) {
        console.log(`[${userId}] ⏳ ${attempt}초 대기 후 재시도...`);
        sleep(attempt);
      }
    } catch (error) {
      console.error(`[${userId}] ❌ 에러 (시도 ${attempt}): ${error}`);
      if (attempt < retries) {
        sleep(attempt * 2);
      }
    }
  }
  
  chatroomListFailed.add(1);
  errorRate.add(1);
  console.error(`[${userId}] ❌ ${retries}번 시도 실패`);
  return { response: null, latency: 0, success: false };
}

// ========================================
// 🎬 메인 테스트 함수
// ========================================
export function testChatroomList() {
  const userIndex = __VU % TEST_USERS.length;
  const user = TEST_USERS[userIndex];
  const userId = `VU${__VU}-${user.email}`;

  // 1. 로그인
  console.log(`[${userId}] 🔐 로그인 시작...`);
  const token = getAuthToken(user.email, user.password);
  
  if (!token) {
    console.error(`[${userId}] ❌ 토큰 획득 실패 - 테스트 중단`);
    sleep(5);
    return;
  }

  sleep(3);  // 로그인 후 대기 시간 증가

  // 2. 채팅방 목록 조회 (2번 반복 - k6 Cloud용)
  for (let i = 0; i < 2; i++) {
    console.log(`[${userId}] 📋 채팅방 목록 조회 ${i+1}/2...`);
    const result = getChatroomList(token, userId);
    
    if (result.latency > 1000) {
      sleep(5);  // 대기 시간 증가
    } else if (result.latency > 500) {
      sleep(3);  // 대기 시간 증가
    } else {
      sleep(2);  // 대기 시간 증가
    }
  }
  
  console.log(`[${userId}] ✅ 테스트 완료`);
}

// ========================================
// 📊 결과 요약
// ========================================
export function handleSummary(data) {
  const metrics = data.metrics;
  
  let summary = '\n========================================\n';
  summary += '📊 채팅방 목록 N+1 문제 성능 측정 결과\n';
  summary += '========================================\n\n';
  
  summary += '📌 전체 통계:\n';
  summary += `  • 총 요청: ${metrics.http_reqs?.values.count || 0}\n`;
  summary += `  • 실패: ${metrics.http_req_failed?.values.passes || 0}\n`;
  summary += `  • 평균: ${(metrics.http_req_duration?.values.avg || 0).toFixed(2)}ms\n`;
  summary += `  • P95: ${(metrics.http_req_duration?.values['p(95)'] || 0).toFixed(2)}ms\n`;
  summary += `  • P99: ${(metrics.http_req_duration?.values['p(99)'] || 0).toFixed(2)}ms\n\n`;
  
  summary += '🎯 채팅방 목록 조회:\n';
  summary += `  • 호출 수: ${metrics.chatroom_list_calls?.values.count || 0}\n`;
  summary += `  • 성공: ${metrics.chatroom_list_success?.values.count || 0}\n`;
  summary += `  • 실패: ${metrics.chatroom_list_failed?.values.count || 0}\n`;
  summary += `  • 평균: ${(metrics.chatroom_list_latency_ms?.values.avg || 0).toFixed(2)}ms\n`;
  summary += `  • P95: ${(metrics.chatroom_list_latency_ms?.values['p(95)'] || 0).toFixed(2)}ms\n`;
  summary += `  • P99: ${(metrics.chatroom_list_latency_ms?.values['p(99)'] || 0).toFixed(2)}ms\n\n`;
  
  summary += '🔐 로그인:\n';
  summary += `  • 실패 수: ${metrics.login_failed?.values.count || 0}\n\n`;
  
  const avgLatency = metrics.chatroom_list_latency_ms?.values.avg || 0;
  const p95Latency = metrics.chatroom_list_latency_ms?.values['p(95)'] || 0;
  
  summary += '🔍 성능 분석:\n';
  if (avgLatency < 100 && p95Latency < 300) {
    summary += '  ✅ 우수: N+1 문제 해결됨!\n';
  } else if (avgLatency > 1000 || p95Latency > 2000) {
    summary += '  ❌ 심각: N+1 문제 존재!\n';
  } else {
    summary += '  ⚠️ 보통: 추가 최적화 가능\n';
  }
  
  summary += '\n========================================\n\n';
  
  return {
    'stdout': summary,
    'chatroom-n1-result.json': JSON.stringify(data, null, 2),
  };
}

