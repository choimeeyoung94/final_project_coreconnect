import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Trend, Rate } from 'k6/metrics';
import { BASE_URL, TEST_USERS } from './config.js';

// ========================================
// 📊 커스텀 메트릭 정의
// ========================================
const chatRoomListApiCalls = new Counter('chatroom_list_api_calls');
const chatRoomListSuccess = new Counter('chatroom_list_success');
const chatRoomListFailed = new Counter('chatroom_list_failed');
const chatRoomListLatency = new Trend('chatroom_list_latency_ms');
const chatRoomListP95 = new Trend('chatroom_list_p95');
const chatRoomListP99 = new Trend('chatroom_list_p99');
const errorRate = new Rate('error_rate');
const dbQueryTime = new Trend('db_query_time_estimate');

// ========================================
// 🔧 테스트 시나리오 설정
// ========================================
export const options = {
  ext: {
    loadimpact: {
      name: "채팅방 목록 조회 N+1 문제 성능 측정",
      note: "AS-IS(N+1 발생) vs TO-BE(Fetch Join 적용) 비교"
    }
  },
  
  scenarios: {
    // ⭐ 시나리오 1: 가벼운 부하 테스트 (스모크 테스트)
    smoke_test: {
      executor: 'constant-vus',
      vus: 5,
      duration: '2m',
      exec: 'smokeChatRoomList',
      tags: { scenario: 'smoke' },
    },
    
    // ⭐ 시나리오 2: 중간 부하 테스트 (일반 사용자 패턴)
    load_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 20 },   // 1분간 20명까지 증가
        { duration: '3m', target: 20 },   // 3분간 20명 유지
        { duration: '1m', target: 50 },   // 1분간 50명까지 증가
        { duration: '3m', target: 50 },   // 3분간 50명 유지
        { duration: '1m', target: 100 },  // 1분간 100명까지 증가
        { duration: '3m', target: 100 },  // 3분간 100명 유지
        { duration: '2m', target: 0 },    // 2분간 0명까지 감소
      ],
      exec: 'loadChatRoomList',
      tags: { scenario: 'load' },
      startTime: '2m', // smoke_test 이후 시작
    },
    
    // ⭐ 시나리오 3: 스파이크 테스트 (급격한 부하 증가)
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 50 },   // 급격한 증가
        { duration: '1m', target: 50 },
        { duration: '10s', target: 200 },  // 급격한 증가
        { duration: '2m', target: 200 },
        { duration: '10s', target: 50 },   // 급격한 감소
        { duration: '1m', target: 0 },
      ],
      exec: 'spikeChatRoomList',
      tags: { scenario: 'spike' },
      startTime: '16m', // load_test 이후 시작
    },
  },
  
  // ========================================
  // 🎯 성능 임계값 (Thresholds)
  // ========================================
  thresholds: {
    // 채팅방 목록 조회 응답 시간
    'chatroom_list_latency_ms': [
      'p(50)<100',   // 평균: 100ms 이내 (목표)
      'p(95)<300',   // 95%: 300ms 이내 (목표)
      'p(99)<500',   // 99%: 500ms 이내 (목표)
    ],
    
    // 전체 HTTP 요청
    'http_req_duration': [
      'p(95)<500',   // 95%: 500ms 이내
      'p(99)<1000',  // 99%: 1000ms 이내
    ],
    
    // 에러율
    'error_rate': ['rate<0.01'],  // 1% 미만
    'http_req_failed': ['rate<0.01'],
    
    // 성공률
    'checks': ['rate>0.99'],  // 99% 이상
  },
};

// ========================================
// 🔐 JWT 토큰 획득 함수
// ========================================
function getAuthToken(email, password) {
  const loginUrl = `${BASE_URL}/api/v1/user/login`;
  const payload = JSON.stringify({
    email: email,
    password: password,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { api: 'login' },
  };

  const response = http.post(loginUrl, payload, params);

  if (response.status === 200) {
    const body = JSON.parse(response.body);
    const token = body.data?.token || body.token || body.accessToken;
    
    if (token) {
      return token;
    }
  }

  console.error(`[LOGIN FAILED] ${email}: ${response.status} - ${response.body}`);
  errorRate.add(1);
  return null;
}

// ========================================
// 📋 채팅방 목록 조회 API 함수
// ========================================
function getChatRoomList(token, userId) {
  const url = `${BASE_URL}/api/v1/chat/rooms/messages/latest`;
  
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    tags: { api: 'chatroom_list' },
  };

  const startTime = Date.now();
  const response = http.get(url, params);
  const latency = Date.now() - startTime;

  // 메트릭 기록
  chatRoomListApiCalls.add(1);
  chatRoomListLatency.add(latency);

  const success = check(response, {
    '채팅방 목록 조회 성공 (200 OK)': (r) => r.status === 200,
    '응답 시간 < 500ms': (r) => latency < 500,
    '응답 시간 < 300ms': (r) => latency < 300,
    '응답 시간 < 100ms': (r) => latency < 100,
    '응답 본문 존재': (r) => r.body && r.body.length > 0,
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
    chatRoomListSuccess.add(1);
    
    // 채팅방 개수 확인
    try {
      const body = JSON.parse(response.body);
      const roomCount = body.data?.length || 0;
      console.log(`[${userId}] ✅ 채팅방 목록 조회 성공 - ${roomCount}개 채팅방, ${latency}ms`);
      
      // DB 쿼리 시간 추정 (응답 시간의 70%로 가정)
      dbQueryTime.add(latency * 0.7);
    } catch (e) {
      console.error(`[${userId}] ⚠️ JSON 파싱 실패`);
    }
  } else {
    chatRoomListFailed.add(1);
    errorRate.add(1);
    console.error(`[${userId}] ❌ 채팅방 목록 조회 실패 - ${response.status}, ${latency}ms`);
  }

  return { response, latency, success };
}

// ========================================
// 🎬 시나리오 1: 스모크 테스트
// ========================================
export function smokeChatRoomList() {
  const userIndex = __VU % TEST_USERS.length;
  const user = TEST_USERS[userIndex];
  const userId = `VU${__VU}-${user.email}`;

  // 1. 로그인
  const token = getAuthToken(user.email, user.password);
  if (!token) {
    console.error(`[${userId}] 토큰 획득 실패, 테스트 중단`);
    return;
  }

  sleep(1);

  // 2. 채팅방 목록 조회 (3번 반복)
  for (let i = 0; i < 3; i++) {
    getChatRoomList(token, userId);
    sleep(2);
  }
}

// ========================================
// 🎬 시나리오 2: 일반 부하 테스트
// ========================================
export function loadChatRoomList() {
  const userIndex = __VU % TEST_USERS.length;
  const user = TEST_USERS[userIndex];
  const userId = `VU${__VU}-${user.email}`;

  // 1. 로그인
  const token = getAuthToken(user.email, user.password);
  if (!token) {
    console.error(`[${userId}] 토큰 획득 실패, 테스트 중단`);
    return;
  }

  sleep(0.5);

  // 2. 채팅방 목록 조회 (5번 반복)
  for (let i = 0; i < 5; i++) {
    const result = getChatRoomList(token, userId);
    
    // 응답 시간에 따라 동적 대기
    if (result.latency > 1000) {
      sleep(3); // 느리면 길게 대기
    } else if (result.latency > 500) {
      sleep(2); // 중간이면 보통 대기
    } else {
      sleep(1); // 빠르면 짧게 대기
    }
  }
}

// ========================================
// 🎬 시나리오 3: 스파이크 테스트
// ========================================
export function spikeChatRoomList() {
  const userIndex = __VU % TEST_USERS.length;
  const user = TEST_USERS[userIndex];
  const userId = `VU${__VU}-${user.email}`;

  // 1. 로그인
  const token = getAuthToken(user.email, user.password);
  if (!token) {
    console.error(`[${userId}] 토큰 획득 실패, 테스트 중단`);
    return;
  }

  // 2. 채팅방 목록 조회 (연속 10번 - 집중 부하)
  for (let i = 0; i < 10; i++) {
    getChatRoomList(token, userId);
    sleep(0.3); // 짧은 대기로 집중 부하
  }
}

// ========================================
// 📊 테스트 완료 후 요약 출력
// ========================================
export function handleSummary(data) {
  const summary = generateSummary(data);
  
  return {
    'chatroom-list-test-summary.json': JSON.stringify(data, null, 2),
    'stdout': summary,
  };
}

function generateSummary(data) {
  const metrics = data.metrics;
  
  let summary = '\n';
  summary += '========================================\n';
  summary += '📊 채팅방 목록 조회 N+1 문제 성능 측정 결과\n';
  summary += '========================================\n\n';
  
  // 1. 전체 요청 통계
  summary += '📌 전체 HTTP 요청 통계:\n';
  summary += `  • 총 요청 수: ${metrics.http_reqs?.values.count || 0}\n`;
  summary += `  • 실패한 요청: ${metrics.http_req_failed?.values.passes || 0} (${((metrics.http_req_failed?.values.rate || 0) * 100).toFixed(2)}%)\n`;
  summary += `  • 평균 응답 시간: ${(metrics.http_req_duration?.values.avg || 0).toFixed(2)}ms\n`;
  summary += `  • P50 응답 시간: ${(metrics.http_req_duration?.values['p(50)'] || 0).toFixed(2)}ms\n`;
  summary += `  • P95 응답 시간: ${(metrics.http_req_duration?.values['p(95)'] || 0).toFixed(2)}ms\n`;
  summary += `  • P99 응답 시간: ${(metrics.http_req_duration?.values['p(99)'] || 0).toFixed(2)}ms\n`;
  summary += `  • 최대 응답 시간: ${(metrics.http_req_duration?.values.max || 0).toFixed(2)}ms\n`;
  summary += `  • 최소 응답 시간: ${(metrics.http_req_duration?.values.min || 0).toFixed(2)}ms\n\n`;
  
  // 2. 채팅방 목록 조회 API 통계
  summary += '🎯 채팅방 목록 조회 API 통계:\n';
  summary += `  • API 호출 수: ${metrics.chatroom_list_api_calls?.values.count || 0}\n`;
  summary += `  • 성공: ${metrics.chatroom_list_success?.values.count || 0}\n`;
  summary += `  • 실패: ${metrics.chatroom_list_failed?.values.count || 0}\n`;
  summary += `  • 성공률: ${(((metrics.chatroom_list_success?.values.count || 0) / (metrics.chatroom_list_api_calls?.values.count || 1)) * 100).toFixed(2)}%\n`;
  summary += `  • 평균 응답 시간: ${(metrics.chatroom_list_latency_ms?.values.avg || 0).toFixed(2)}ms\n`;
  summary += `  • P50 응답 시간: ${(metrics.chatroom_list_latency_ms?.values['p(50)'] || 0).toFixed(2)}ms\n`;
  summary += `  • P95 응답 시간: ${(metrics.chatroom_list_latency_ms?.values['p(95)'] || 0).toFixed(2)}ms\n`;
  summary += `  • P99 응답 시간: ${(metrics.chatroom_list_latency_ms?.values['p(99)'] || 0).toFixed(2)}ms\n`;
  summary += `  • 최대 응답 시간: ${(metrics.chatroom_list_latency_ms?.values.max || 0).toFixed(2)}ms\n`;
  summary += `  • 최소 응답 시간: ${(metrics.chatroom_list_latency_ms?.values.min || 0).toFixed(2)}ms\n\n`;
  
  // 3. DB 쿼리 시간 추정
  summary += '💾 DB 쿼리 시간 추정:\n';
  summary += `  • 평균 DB 쿼리 시간: ${(metrics.db_query_time_estimate?.values.avg || 0).toFixed(2)}ms\n`;
  summary += `  • P95 DB 쿼리 시간: ${(metrics.db_query_time_estimate?.values['p(95)'] || 0).toFixed(2)}ms\n`;
  summary += `  • P99 DB 쿼리 시간: ${(metrics.db_query_time_estimate?.values['p(99)'] || 0).toFixed(2)}ms\n\n`;
  
  // 4. 처리량 (TPS)
  const duration = (data.state?.testRunDurationMs || 1000) / 1000; // 초 단위
  const totalRequests = metrics.chatroom_list_api_calls?.values.count || 0;
  const tps = (totalRequests / duration).toFixed(2);
  
  summary += '⚡ 처리량 (TPS):\n';
  summary += `  • 채팅방 목록 조회 TPS: ${tps} req/s\n`;
  summary += `  • 전체 HTTP TPS: ${((metrics.http_reqs?.values.count || 0) / duration).toFixed(2)} req/s\n\n`;
  
  // 5. 성능 분석 및 권장사항
  const avgLatency = metrics.chatroom_list_latency_ms?.values.avg || 0;
  const p95Latency = metrics.chatroom_list_latency_ms?.values['p(95)'] || 0;
  
  summary += '🔍 성능 분석:\n';
  
  if (avgLatency < 100 && p95Latency < 300) {
    summary += '  ✅ 우수: N+1 문제가 해결된 것으로 보입니다!\n';
    summary += '  ✅ 평균 응답 시간과 P95 모두 목표치를 달성했습니다.\n';
  } else if (avgLatency < 300 && p95Latency < 500) {
    summary += '  ⚠️ 보통: 성능이 개선되었지만 추가 최적화 가능합니다.\n';
    summary += '  ⚠️ 인덱스 추가 또는 쿼리 최적화를 고려하세요.\n';
  } else if (avgLatency > 1000 || p95Latency > 2000) {
    summary += '  ❌ 심각: N+1 문제가 여전히 존재합니다!\n';
    summary += '  ❌ Fetch Join 또는 @EntityGraph 적용이 필요합니다.\n';
    summary += '  ❌ 채팅방 50개 기준, 151개 쿼리 → 3-4개 쿼리로 줄여야 합니다.\n';
  } else {
    summary += '  ⚠️ 주의: 성능 개선이 필요합니다.\n';
    summary += '  ⚠️ N+1 쿼리 문제를 확인하세요.\n';
  }
  
  summary += '\n';
  
  // 6. AS-IS vs TO-BE 비교 가이드
  summary += '📈 AS-IS vs TO-BE 비교 가이드:\n';
  summary += '  • AS-IS (N+1 발생):\n';
  summary += '    - 평균: 3,000-3,500ms\n';
  summary += '    - P95: 4,000-5,000ms\n';
  summary += '    - 쿼리 수: 151개 (채팅방 50개 기준)\n';
  summary += '  • TO-BE (Fetch Join 적용):\n';
  summary += '    - 평균: 50-100ms (목표)\n';
  summary += '    - P95: 150-300ms (목표)\n';
  summary += '    - 쿼리 수: 3-4개 (97% 감소)\n\n';
  
  summary += `  현재 측정값:\n`;
  summary += `    - 평균: ${avgLatency.toFixed(2)}ms\n`;
  summary += `    - P95: ${p95Latency.toFixed(2)}ms\n`;
  summary += `    - 개선율: ${(((3200 - avgLatency) / 3200) * 100).toFixed(1)}% 🚀\n\n`;
  
  summary += '========================================\n';
  summary += '💡 다음 단계:\n';
  summary += '  1. AS-IS 테스트: Fetch Join 적용 전 실행\n';
  summary += '  2. TO-BE 테스트: Fetch Join 적용 후 실행\n';
  summary += '  3. 결과 비교: 응답 시간, TPS 비교\n';
  summary += '  4. Grafana 대시보드에서 시각화 확인\n';
  summary += '========================================\n\n';
  
  return summary;
}










