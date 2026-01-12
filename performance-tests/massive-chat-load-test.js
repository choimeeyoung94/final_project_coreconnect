/**
 * ============================================================
 * K6 대규모 채팅방 부하 테스트 (10만명 동시 접속)
 * ============================================================
 * 
 * 📊 테스트 시나리오:
 * 1. 10만명이 동시에 로그인 (JWT 토큰 획득)
 * 2. 하나의 채팅방에 모두 입장
 * 3. 10만명이 동시에 메시지 전송
 * 4. 서버 응답 시간 측정
 * 5. 메시지 순서 보장 확인
 * 6. 10만개 메시지 조회 시간 측정
 * 
 * 📈 측정 지표:
 * - 메시지 전송 응답 시간 (P50, P95, P99)
 * - 메시지 순서 보장률
 * - 메시지 조회 시간
 * - 처리량 (TPS)
 * - 에러율
 */

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Counter, Trend, Rate, Gauge } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ============================================================
// 📊 커스텀 메트릭 정의
// ============================================================
const messageResponseTime = new Trend('message_response_time', true);
const messageOrderViolations = new Counter('message_order_violations');
const messagesReceived = new Counter('messages_received');
const messagesSent = new Counter('messages_sent');
const messageQueryTime = new Trend('message_query_time', true);
const websocketConnections = new Gauge('websocket_connections');
const loginSuccessRate = new Rate('login_success_rate');
const messageDeliveryRate = new Rate('message_delivery_rate');

// ============================================================
// 🔧 환경 설정
// ============================================================
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const WS_URL = __ENV.WS_URL || 'ws://localhost:8080';
const TEST_ROOM_ID = __ENV.TEST_ROOM_ID || '1'; // 테스트용 채팅방 ID
const TOTAL_USERS = parseInt(__ENV.TOTAL_USERS || '100000'); // 10만명
const RAMP_UP_TIME = __ENV.RAMP_UP_TIME || '5m'; // 램프업 시간
const STEADY_TIME = __ENV.STEADY_TIME || '10m'; // 유지 시간
const RAMP_DOWN_TIME = __ENV.RAMP_DOWN_TIME || '2m'; // 램프다운 시간

// ============================================================
// 👥 테스트 사용자 데이터 준비
// ============================================================
const users = new SharedArray('test users', function () {
  const userList = [];
  // 10만명의 테스트 사용자 생성
  for (let i = 1; i <= TOTAL_USERS; i++) {
    userList.push({
      email: `testuser${i}@test.com`,
      password: 'Test1234!',
      userId: i,
      name: `TestUser${i}`
    });
  }
  return userList;
});

// ============================================================
// ⚙️ K6 테스트 옵션
// ============================================================
export const options = {
  scenarios: {
    // 시나리오 1: 10만명 동시 접속 및 메시지 전송
    massive_concurrent_chat: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: RAMP_UP_TIME, target: TOTAL_USERS },  // 5분 동안 10만명까지 증가
        { duration: STEADY_TIME, target: TOTAL_USERS },   // 10분 동안 10만명 유지
        { duration: RAMP_DOWN_TIME, target: 0 }           // 2분 동안 0으로 감소
      ],
      gracefulRampDown: '30s',
      exec: 'massiveChatScenario'
    },
    
    // 시나리오 2: 메시지 조회 성능 테스트
    message_query_test: {
      executor: 'constant-vus',
      vus: 100,
      duration: '5m',
      startTime: RAMP_UP_TIME, // 램프업 후 시작
      exec: 'messageQueryScenario'
    }
  },
  
  // 임계값 설정
  thresholds: {
    'http_req_duration': ['p(95)<3000', 'p(99)<5000'], // 95% 요청은 3초 이내, 99%는 5초 이내
    'message_response_time': ['p(95)<2000', 'p(99)<3000'],
    'message_query_time': ['p(95)<5000', 'p(99)<10000'],
    'login_success_rate': ['rate>0.95'], // 95% 이상 로그인 성공
    'message_delivery_rate': ['rate>0.90'], // 90% 이상 메시지 전달 성공
    'message_order_violations': ['count<1000'], // 순서 위반 1000건 미만
    'http_req_failed': ['rate<0.1'] // 에러율 10% 미만
  },
  
  // Grafana Cloud 또는 InfluxDB로 결과 전송
  ext: {
    loadimpact: {
      projectID: parseInt(__ENV.K6_PROJECT_ID || '0'),
      name: '10만명 동시 접속 채팅 부하 테스트'
    }
  }
};

// ============================================================
// 🔐 로그인 함수
// ============================================================
function login(email, password) {
  const loginUrl = `${BASE_URL}/api/v1/auth/login`;
  const payload = JSON.stringify({
    email: email,
    password: password
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: '30s'
  };
  
  const response = http.post(loginUrl, payload, params);
  
  const success = check(response, {
    '로그인 성공 (200)': (r) => r.status === 200,
    '쿠키에 access_token 존재': (r) => r.cookies.access_token && r.cookies.access_token.length > 0
  });
  
  loginSuccessRate.add(success);
  
  if (success) {
    return {
      accessToken: response.cookies.access_token[0].value,
      refreshToken: response.cookies.refresh_token ? response.cookies.refresh_token[0].value : null,
      cookies: `access_token=${response.cookies.access_token[0].value}`
    };
  }
  
  console.error(`로그인 실패 - email: ${email}, status: ${response.status}, body: ${response.body}`);
  return null;
}

// ============================================================
// 💬 WebSocket을 통한 메시지 전송 함수
// ============================================================
function sendMessageViaWebSocket(accessToken, roomId, content, userId) {
  const wsUrl = `${WS_URL}/ws?access_token=${accessToken}`;
  let messageReceived = false;
  let sentTime = 0;
  let receivedTime = 0;
  
  const response = ws.connect(wsUrl, {
    headers: {
      'Cookie': `access_token=${accessToken}`
    }
  }, function (socket) {
    websocketConnections.add(1);
    
    socket.on('open', function() {
      console.log(`[User ${userId}] WebSocket 연결 성공`);
      
      // STOMP 연결 프레임 전송
      socket.send('CONNECT\naccept-version:1.1,1.0\nheart-beat:10000,10000\n\n\x00');
      
      socket.setTimeout(function () {
        // 채팅방 구독
        const subscribeFrame = `SUBSCRIBE\nid:sub-${userId}\ndestination:/topic/chat.room.${roomId}\n\n\x00`;
        socket.send(subscribeFrame);
        
        // 메시지 전송
        sentTime = Date.now();
        const messageFrame = `SEND\ndestination:/app/chat.sendMessage\ncontent-type:application/json\n\n${JSON.stringify({
          roomId: parseInt(roomId),
          content: content
        })}\x00`;
        socket.send(messageFrame);
        messagesSent.add(1);
        
        console.log(`[User ${userId}] 메시지 전송: ${content}`);
      }, 1000);
    });
    
    socket.on('message', function (data) {
      try {
        // STOMP 메시지 파싱
        if (data.includes('MESSAGE')) {
          receivedTime = Date.now();
          messageReceived = true;
          messagesReceived.add(1);
          
          const responseTime = receivedTime - sentTime;
          messageResponseTime.add(responseTime);
          
          console.log(`[User ${userId}] 메시지 수신 완료 - 응답시간: ${responseTime}ms`);
        }
      } catch (e) {
        console.error(`[User ${userId}] 메시지 파싱 오류: ${e.message}`);
      }
    });
    
    socket.on('error', function (e) {
      console.error(`[User ${userId}] WebSocket 오류: ${e.error()}`);
      websocketConnections.add(-1);
    });
    
    socket.on('close', function() {
      console.log(`[User ${userId}] WebSocket 연결 종료`);
      websocketConnections.add(-1);
    });
    
    // 30초 후 연결 종료
    socket.setTimeout(function () {
      socket.close();
    }, 30000);
  });
  
  messageDeliveryRate.add(messageReceived);
  
  return {
    sent: true,
    received: messageReceived,
    responseTime: receivedTime - sentTime
  };
}

// ============================================================
// 💬 HTTP를 통한 메시지 전송 함수 (WebSocket 대안)
// ============================================================
function sendMessageViaHTTP(cookies, roomId, content) {
  const url = `${BASE_URL}/api/v1/chat/messages`;
  const payload = JSON.stringify({
    roomId: parseInt(roomId),
    content: content
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies
    },
    timeout: '30s'
  };
  
  const sentTime = Date.now();
  const response = http.post(url, payload, params);
  const responseTime = Date.now() - sentTime;
  
  const success = check(response, {
    '메시지 전송 성공 (200)': (r) => r.status === 200 || r.status === 201
  });
  
  if (success) {
    messageResponseTime.add(responseTime);
    messagesSent.add(1);
  }
  
  messageDeliveryRate.add(success);
  
  return {
    success: success,
    responseTime: responseTime,
    status: response.status
  };
}

// ============================================================
// 📖 메시지 조회 함수
// ============================================================
function queryMessages(cookies, roomId, page = 0, size = 1000) {
  const url = `${BASE_URL}/api/v1/chat/${roomId}/messages?page=${page}&size=${size}`;
  
  const params = {
    headers: {
      'Cookie': cookies
    },
    timeout: '60s'
  };
  
  const startTime = Date.now();
  const response = http.get(url, params);
  const queryTime = Date.now() - startTime;
  
  const success = check(response, {
    '메시지 조회 성공 (200)': (r) => r.status === 200,
    '응답 데이터 존재': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data && data.data;
      } catch (e) {
        return false;
      }
    }
  });
  
  if (success) {
    messageQueryTime.add(queryTime);
    
    try {
      const data = JSON.parse(response.body);
      return {
        success: true,
        queryTime: queryTime,
        messageCount: data.data ? data.data.length : 0,
        messages: data.data || []
      };
    } catch (e) {
      console.error(`메시지 파싱 오류: ${e.message}`);
    }
  }
  
  return {
    success: false,
    queryTime: queryTime,
    messageCount: 0,
    messages: []
  };
}

// ============================================================
// 🔍 메시지 순서 검증 함수
// ============================================================
function validateMessageOrder(messages) {
  if (!messages || messages.length < 2) {
    return { violations: 0, total: messages ? messages.length : 0 };
  }
  
  let violations = 0;
  
  for (let i = 1; i < messages.length; i++) {
    const prevMessage = messages[i - 1];
    const currMessage = messages[i];
    
    // 메시지 ID 또는 생성 시간으로 순서 검증
    if (prevMessage.id && currMessage.id) {
      if (prevMessage.id > currMessage.id) {
        violations++;
        console.warn(`순서 위반 감지: prevId=${prevMessage.id}, currId=${currMessage.id}`);
      }
    } else if (prevMessage.createdAt && currMessage.createdAt) {
      const prevTime = new Date(prevMessage.createdAt).getTime();
      const currTime = new Date(currMessage.createdAt).getTime();
      if (prevTime > currTime) {
        violations++;
        console.warn(`순서 위반 감지: prevTime=${prevMessage.createdAt}, currTime=${currMessage.createdAt}`);
      }
    }
  }
  
  messageOrderViolations.add(violations);
  
  return {
    violations: violations,
    total: messages.length,
    violationRate: (violations / messages.length * 100).toFixed(2) + '%'
  };
}

// ============================================================
// 🎯 시나리오 1: 대규모 동시 접속 및 메시지 전송
// ============================================================
export function massiveChatScenario() {
  // 각 VU(Virtual User)는 고유한 사용자 정보를 가짐
  const vuIndex = __VU - 1;
  const user = users[vuIndex % users.length];
  const uniqueContent = `메시지 from User ${user.userId} at ${Date.now()}`;
  
  group('1. 로그인', () => {
    const authData = login(user.email, user.password);
    
    if (!authData) {
      console.error(`[VU ${__VU}] 로그인 실패 - 테스트 중단`);
      return;
    }
    
    console.log(`[VU ${__VU}] 로그인 성공 - User: ${user.email}`);
    
    // 짧은 대기 (실제 사용자처럼)
    sleep(randomIntBetween(1, 3));
    
    group('2. 메시지 전송 (HTTP)', () => {
      // HTTP를 통한 메시지 전송 (WebSocket보다 안정적)
      const result = sendMessageViaHTTP(authData.cookies, TEST_ROOM_ID, uniqueContent);
      
      if (result.success) {
        console.log(`[VU ${__VU}] 메시지 전송 성공 - 응답시간: ${result.responseTime}ms`);
      } else {
        console.error(`[VU ${__VU}] 메시지 전송 실패 - status: ${result.status}`);
      }
    });
    
    // 메시지 전송 후 대기
    sleep(randomIntBetween(2, 5));
  });
}

// ============================================================
// 🎯 시나리오 2: 메시지 조회 성능 테스트
// ============================================================
export function messageQueryScenario() {
  const vuIndex = __VU - 1;
  const user = users[vuIndex % users.length];
  
  group('메시지 조회 성능 테스트', () => {
    const authData = login(user.email, user.password);
    
    if (!authData) {
      console.error(`[VU ${__VU}] 로그인 실패 - 조회 테스트 중단`);
      return;
    }
    
    // 10만개 메시지 조회 (페이지네이션)
    const pageSize = 1000;
    const totalPages = Math.ceil(TOTAL_USERS / pageSize);
    
    console.log(`[VU ${__VU}] 메시지 조회 시작 - 예상 메시지 수: ${TOTAL_USERS}`);
    
    let totalQueryTime = 0;
    let totalMessages = 0;
    let allMessages = [];
    
    // 첫 10페이지만 조회 (전체 조회는 너무 오래 걸림)
    const pagesToTest = Math.min(10, totalPages);
    
    for (let page = 0; page < pagesToTest; page++) {
      const result = queryMessages(authData.cookies, TEST_ROOM_ID, page, pageSize);
      
      if (result.success) {
        totalQueryTime += result.queryTime;
        totalMessages += result.messageCount;
        allMessages = allMessages.concat(result.messages);
        
        console.log(`[VU ${__VU}] 페이지 ${page + 1}/${pagesToTest} 조회 완료 - ` +
                   `조회시간: ${result.queryTime}ms, 메시지 수: ${result.messageCount}`);
      } else {
        console.error(`[VU ${__VU}] 페이지 ${page + 1} 조회 실패`);
        break;
      }
      
      sleep(1); // 페이지 간 대기
    }
    
    // 메시지 순서 검증
    const orderValidation = validateMessageOrder(allMessages);
    
    console.log(`[VU ${__VU}] 메시지 조회 완료 - ` +
               `총 조회시간: ${totalQueryTime}ms, ` +
               `총 메시지: ${totalMessages}개, ` +
               `순서 위반: ${orderValidation.violations}건 (${orderValidation.violationRate})`);
    
    sleep(randomIntBetween(5, 10));
  });
}

// ============================================================
// 📊 테스트 종료 후 요약 출력
// ============================================================
export function handleSummary(data) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 10만명 동시 접속 채팅 부하 테스트 결과 요약');
  console.log('='.repeat(70));
  
  const metrics = data.metrics;
  
  // 로그인 성공률
  if (metrics.login_success_rate) {
    console.log(`\n✅ 로그인 성공률: ${(metrics.login_success_rate.values.rate * 100).toFixed(2)}%`);
  }
  
  // 메시지 전송 통계
  if (metrics.messages_sent && metrics.messages_received) {
    console.log(`\n💬 메시지 전송 통계:`);
    console.log(`  - 전송된 메시지: ${metrics.messages_sent.values.count}개`);
    console.log(`  - 수신된 메시지: ${metrics.messages_received.values.count}개`);
    console.log(`  - 전달 성공률: ${(metrics.message_delivery_rate.values.rate * 100).toFixed(2)}%`);
  }
  
  // 메시지 응답 시간
  if (metrics.message_response_time) {
    console.log(`\n⏱️ 메시지 응답 시간:`);
    console.log(`  - 평균: ${metrics.message_response_time.values.avg.toFixed(2)}ms`);
    console.log(`  - 중간값 (P50): ${metrics.message_response_time.values.med.toFixed(2)}ms`);
    console.log(`  - P95: ${metrics.message_response_time.values['p(95)'].toFixed(2)}ms`);
    console.log(`  - P99: ${metrics.message_response_time.values['p(99)'].toFixed(2)}ms`);
    console.log(`  - 최대: ${metrics.message_response_time.values.max.toFixed(2)}ms`);
  }
  
  // 메시지 조회 시간
  if (metrics.message_query_time) {
    console.log(`\n📖 메시지 조회 시간 (1000개 단위):`);
    console.log(`  - 평균: ${metrics.message_query_time.values.avg.toFixed(2)}ms`);
    console.log(`  - 중간값 (P50): ${metrics.message_query_time.values.med.toFixed(2)}ms`);
    console.log(`  - P95: ${metrics.message_query_time.values['p(95)'].toFixed(2)}ms`);
    console.log(`  - P99: ${metrics.message_query_time.values['p(99)'].toFixed(2)}ms`);
    console.log(`  - 최대: ${metrics.message_query_time.values.max.toFixed(2)}ms`);
  }
  
  // 메시지 순서 보장
  if (metrics.message_order_violations) {
    const violations = metrics.message_order_violations.values.count;
    const totalMessages = metrics.messages_received ? metrics.messages_received.values.count : 0;
    const violationRate = totalMessages > 0 ? (violations / totalMessages * 100).toFixed(4) : 0;
    
    console.log(`\n🔢 메시지 순서 보장:`);
    console.log(`  - 순서 위반 건수: ${violations}건`);
    console.log(`  - 순서 위반률: ${violationRate}%`);
    console.log(`  - 순서 보장률: ${(100 - violationRate).toFixed(4)}%`);
  }
  
  // HTTP 요청 통계
  if (metrics.http_req_duration) {
    console.log(`\n🌐 HTTP 요청 통계:`);
    console.log(`  - 평균 응답시간: ${metrics.http_req_duration.values.avg.toFixed(2)}ms`);
    console.log(`  - P95 응답시간: ${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
    console.log(`  - P99 응답시간: ${metrics.http_req_duration.values['p(99)'].toFixed(2)}ms`);
  }
  
  if (metrics.http_req_failed) {
    console.log(`  - 실패율: ${(metrics.http_req_failed.values.rate * 100).toFixed(2)}%`);
  }
  
  // 처리량
  if (metrics.http_reqs) {
    console.log(`\n📈 처리량:`);
    console.log(`  - 총 요청 수: ${metrics.http_reqs.values.count}개`);
    console.log(`  - 초당 요청 수 (RPS): ${metrics.http_reqs.values.rate.toFixed(2)}`);
  }
  
  console.log('\n' + '='.repeat(70) + '\n');
  
  // HTML 보고서 생성을 위한 데이터 반환
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data, null, 2),
    'summary.html': htmlReport(data)
  };
}

// ============================================================
// 📄 HTML 보고서 생성 함수
// ============================================================
function htmlReport(data) {
  const metrics = data.metrics;
  
  return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>K6 부하 테스트 결과 - 10만명 동시 접속 채팅</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: #f9f9f9; padding: 20px; border-radius: 8px; border-left: 4px solid #4CAF50; }
        .metric-card h3 { margin-top: 0; color: #4CAF50; }
        .metric-value { font-size: 2em; font-weight: bold; color: #333; }
        .metric-label { color: #777; font-size: 0.9em; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #4CAF50; color: white; }
        tr:hover { background: #f5f5f5; }
        .success { color: #4CAF50; font-weight: bold; }
        .warning { color: #ff9800; font-weight: bold; }
        .error { color: #f44336; font-weight: bold; }
        .timestamp { color: #999; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 10만명 동시 접속 채팅 부하 테스트 결과</h1>
        <p class="timestamp">테스트 완료 시간: ${new Date().toLocaleString('ko-KR')}</p>
        
        <h2>🎯 핵심 지표</h2>
        <div class="metric-grid">
            <div class="metric-card">
                <h3>✅ 로그인 성공률</h3>
                <div class="metric-value ${metrics.login_success_rate ? (metrics.login_success_rate.values.rate > 0.95 ? 'success' : 'warning') : ''}">${metrics.login_success_rate ? (metrics.login_success_rate.values.rate * 100).toFixed(2) : 'N/A'}%</div>
            </div>
            
            <div class="metric-card">
                <h3>💬 메시지 전달 성공률</h3>
                <div class="metric-value ${metrics.message_delivery_rate ? (metrics.message_delivery_rate.values.rate > 0.9 ? 'success' : 'warning') : ''}">${metrics.message_delivery_rate ? (metrics.message_delivery_rate.values.rate * 100).toFixed(2) : 'N/A'}%</div>
            </div>
            
            <div class="metric-card">
                <h3>⏱️ 평균 응답 시간</h3>
                <div class="metric-value">${metrics.message_response_time ? metrics.message_response_time.values.avg.toFixed(2) : 'N/A'}ms</div>
            </div>
            
            <div class="metric-card">
                <h3>📈 초당 요청 수 (RPS)</h3>
                <div class="metric-value">${metrics.http_reqs ? metrics.http_reqs.values.rate.toFixed(2) : 'N/A'}</div>
            </div>
        </div>
        
        <h2>📊 상세 통계</h2>
        
        <h3>메시지 전송 응답 시간</h3>
        <table>
            <tr><th>메트릭</th><th>값</th></tr>
            <tr><td>평균 (Average)</td><td>${metrics.message_response_time ? metrics.message_response_time.values.avg.toFixed(2) : 'N/A'} ms</td></tr>
            <tr><td>중간값 (P50)</td><td>${metrics.message_response_time ? metrics.message_response_time.values.med.toFixed(2) : 'N/A'} ms</td></tr>
            <tr><td>P95</td><td>${metrics.message_response_time ? metrics.message_response_time.values['p(95)'].toFixed(2) : 'N/A'} ms</td></tr>
            <tr><td>P99</td><td>${metrics.message_response_time ? metrics.message_response_time.values['p(99)'].toFixed(2) : 'N/A'} ms</td></tr>
            <tr><td>최대 (Max)</td><td>${metrics.message_response_time ? metrics.message_response_time.values.max.toFixed(2) : 'N/A'} ms</td></tr>
        </table>
        
        <h3>메시지 조회 시간 (1000개 단위)</h3>
        <table>
            <tr><th>메트릭</th><th>값</th></tr>
            <tr><td>평균 (Average)</td><td>${metrics.message_query_time ? metrics.message_query_time.values.avg.toFixed(2) : 'N/A'} ms</td></tr>
            <tr><td>중간값 (P50)</td><td>${metrics.message_query_time ? metrics.message_query_time.values.med.toFixed(2) : 'N/A'} ms</td></tr>
            <tr><td>P95</td><td>${metrics.message_query_time ? metrics.message_query_time.values['p(95)'].toFixed(2) : 'N/A'} ms</td></tr>
            <tr><td>P99</td><td>${metrics.message_query_time ? metrics.message_query_time.values['p(99)'].toFixed(2) : 'N/A'} ms</td></tr>
            <tr><td>최대 (Max)</td><td>${metrics.message_query_time ? metrics.message_query_time.values.max.toFixed(2) : 'N/A'} ms</td></tr>
        </table>
        
        <h3>메시지 순서 보장</h3>
        <table>
            <tr><th>메트릭</th><th>값</th></tr>
            <tr><td>순서 위반 건수</td><td>${metrics.message_order_violations ? metrics.message_order_violations.values.count : 'N/A'}</td></tr>
            <tr><td>전송된 메시지</td><td>${metrics.messages_sent ? metrics.messages_sent.values.count : 'N/A'}</td></tr>
            <tr><td>순서 보장률</td><td class="success">${metrics.message_order_violations && metrics.messages_sent ? (100 - (metrics.message_order_violations.values.count / metrics.messages_sent.values.count * 100)).toFixed(4) : 'N/A'}%</td></tr>
        </table>
        
        <h2>💡 분석 및 권장사항</h2>
        <div class="metric-card">
            <h3>성능 분석</h3>
            <ul>
                <li>P95 응답시간이 3초 이상이면 <span class="warning">성능 개선 필요</span></li>
                <li>메시지 전달 성공률이 90% 미만이면 <span class="error">시스템 안정성 문제</span></li>
                <li>순서 보장률이 99% 미만이면 <span class="warning">메시지 순서 처리 개선 필요</span></li>
            </ul>
            
            <h3>권장 개선사항</h3>
            <ul>
                <li>Redis 캐싱 적용으로 DB 부하 감소</li>
                <li>Kafka를 통한 비동기 메시지 처리</li>
                <li>WebSocket 클러스터링 (Redis Pub/Sub)</li>
                <li>메시지 큐를 통한 순서 보장 강화</li>
                <li>데이터베이스 인덱싱 및 쿼리 최적화</li>
            </ul>
        </div>
    </div>
</body>
</html>
  `;
}

// ============================================================
// 📝 텍스트 요약 함수
// ============================================================
function textSummary(data, options) {
  return JSON.stringify(data, null, 2);
}

