import { check, sleep } from 'k6';
import http from 'k6/http';
import ws from 'k6/ws';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL, WS_URL, SCENARIOS, THRESHOLDS, TEST_USERS } from './config.js';

// 커스텀 메트릭
const chatMessagesSent = new Counter('chat_messages_sent');
const chatMessagesReceived = new Counter('chat_messages_received');
const chatRoomCreated = new Counter('chat_rooms_created');
const chatMessageLatency = new Trend('chat_message_latency');
const wsConnectionTime = new Trend('ws_connection_time');

// 테스트 옵션
export const options = {
  scenarios: {
    chat_load_test: SCENARIOS.load, // config.js에서 선택 (smoke, load, stress, spike)
  },
  thresholds: THRESHOLDS,
};

// 테스트용 JWT 토큰 획득
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
  };

  const response = http.post(loginUrl, payload, params);

  if (response.status === 200) {
    const body = JSON.parse(response.body);
    // API 응답 구조에 맞게 토큰 추출 (헤더 또는 body에서)
    return response.headers['Authorization'] || body.token || body.accessToken;
  }

  console.error(`Login failed: ${response.status} - ${response.body}`);
  return null;
}

// 채팅방 생성 함수
function createChatRoom(token, roomName, participantIds) {
  const url = `${BASE_URL}/api/v1/chat`;
  const payload = JSON.stringify({
    roomName: roomName,
    roomType: participantIds.length === 1 ? 'alone' : 'group',
    participantIds: participantIds,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };

  const response = http.post(url, payload, params);

  check(response, {
    '채팅방 생성 성공': (r) => r.status === 200 || r.status === 201,
  });

  if (response.status === 200 || response.status === 201) {
    chatRoomCreated.add(1);
    const body = JSON.parse(response.body);
    return body.id || body.roomId; // API 응답 구조에 맞게 수정
  }

  return null;
}

// REST API로 메시지 전송 함수
function sendMessageViaREST(token, roomId, messageContent) {
  const url = `${BASE_URL}/api/v1/chat/rooms/${roomId}/messages`;
  const payload = JSON.stringify({
    messageContent: messageContent,
    fileYn: false,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };

  const startTime = Date.now();
  const response = http.post(url, payload, params);
  const latency = Date.now() - startTime;

  check(response, {
    'REST 메시지 전송 성공': (r) => r.status === 200 || r.status === 201,
  });

  if (response.status === 200 || response.status === 201) {
    chatMessagesSent.add(1);
    chatMessageLatency.add(latency);
  }

  return response;
}

// 메시지 목록 조회 함수
function getMessages(token, roomId) {
  const url = `${BASE_URL}/api/v1/chat/${roomId}/messages`;
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };

  const response = http.get(url, params);

  check(response, {
    '메시지 조회 성공': (r) => r.status === 200,
  });

  return response;
}

// 미읽은 메시지 개수 조회
function getUnreadCount(token, roomId) {
  const url = `${BASE_URL}/api/v1/chat/rooms/${roomId}/messages/unread-count`;
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };

  const response = http.get(url, params);

  check(response, {
    '미읽은 메시지 개수 조회 성공': (r) => r.status === 200,
  });

  return response;
}

// WebSocket STOMP 연결 및 메시지 전송 테스트
function testWebSocketChat(token, roomId) {
  const wsUrl = `${WS_URL}/ws/chat?token=${token}`;
  const connectStart = Date.now();

  const response = ws.connect(wsUrl, { headers: { 'Authorization': `Bearer ${token}` } }, function (socket) {
    const connectTime = Date.now() - connectStart;
    wsConnectionTime.add(connectTime);

    socket.on('open', () => {
      console.log('WebSocket 연결 성공');

      // STOMP CONNECT 프레임 전송
      socket.send('CONNECT\nAccept-version:1.1,1.0\nheart-beat:10000,10000\n\n\x00');
    });

    socket.on('message', (data) => {
      console.log(`WebSocket 메시지 수신: ${data}`);

      // CONNECTED 프레임 수신 확인
      if (data.startsWith('CONNECTED')) {
        // 채팅방 구독
        const subscribeFrame = `SUBSCRIBE\nid:sub-0\ndestination:/topic/chat/${roomId}\n\n\x00`;
        socket.send(subscribeFrame);

        // 메시지 전송
        const messagePayload = JSON.stringify({
          messageContent: `테스트 메시지 from VU ${__VU} at ${new Date().toISOString()}`,
          roomId: roomId,
          fileYn: false,
        });

        const sendFrame = `SEND\ndestination:/app/chat.sendMessage\ncontent-type:application/json\n\n${messagePayload}\x00`;

        setTimeout(() => {
          const sendStart = Date.now();
          socket.send(sendFrame);
          chatMessagesSent.add(1);
        }, 1000);
      }

      // MESSAGE 프레임 수신 (다른 사용자의 메시지)
      if (data.startsWith('MESSAGE')) {
        chatMessagesReceived.add(1);
        const latency = Date.now() - connectStart;
        chatMessageLatency.add(latency);
      }
    });

    socket.on('error', (e) => {
      console.error('WebSocket 에러:', e);
    });

    socket.on('close', () => {
      console.log('WebSocket 연결 종료');
    });

    // 30초간 연결 유지
    socket.setTimeout(() => {
      console.log('WebSocket 세션 타임아웃');
      socket.close();
    }, 30000);
  });

  check(response, {
    'WebSocket 연결 성공': (r) => r && r.status === 101,
  });
}

// 메인 테스트 함수
export default function () {
  // 각 VU는 랜덤한 테스트 사용자로 로그인
  const userIndex = __VU % TEST_USERS.length;
  const user = TEST_USERS[userIndex];

  // 1. 로그인하여 토큰 획득
  const token = getAuthToken(user.email, user.password);

  if (!token) {
    console.error('토큰 획득 실패, 테스트 중단');
    return;
  }

  sleep(1);

  // 2. 채팅방 생성 (10% 확률로)
  let roomId = null;
  if (Math.random() < 0.1) {
    const roomName = `테스트 채팅방 ${__VU}-${Date.now()}`;
    const otherUserIndex = (__VU + 1) % TEST_USERS.length;
    roomId = createChatRoom(token, roomName, [userIndex + 1, otherUserIndex + 1]); // participantIds
    sleep(1);
  } else {
    // 기존 채팅방 ID 사용 (사전에 생성된 테스트 채팅방)
    roomId = 1; // 실제 환경에 맞게 수정
  }

  if (!roomId) {
    console.error('채팅방 ID 없음, 테스트 중단');
    return;
  }

  // 3. REST API로 메시지 전송 테스트 (50% 확률)
  if (Math.random() < 0.5) {
    sendMessageViaREST(token, roomId, `REST 메시지 from VU ${__VU}`);
    sleep(1);
  }

  // 4. 메시지 목록 조회
  getMessages(token, roomId);
  sleep(1);

  // 5. 미읽은 메시지 개수 조회
  getUnreadCount(token, roomId);
  sleep(1);

  // 6. WebSocket을 통한 실시간 채팅 테스트 (30% 확률)
  if (Math.random() < 0.3) {
    testWebSocketChat(token, roomId);
  }

  sleep(2);
}

// 테스트 완료 후 실행되는 함수
export function handleSummary(data) {
  return {
    'chat-test-summary.json': JSON.stringify(data),
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;

  let summary = '\n' + indent + '========== 채팅 기능 부하 테스트 결과 ==========\n\n';

  summary += indent + `총 요청 수: ${data.metrics.http_reqs.values.count}\n`;
  summary += indent + `실패한 요청: ${data.metrics.http_req_failed.values.passes || 0}\n`;
  summary += indent + `평균 응답 시간: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  summary += indent + `P95 응답 시간: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  summary += indent + `P99 응답 시간: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n\n`;

  summary += indent + `채팅방 생성 수: ${data.metrics.chat_rooms_created.values.count}\n`;
  summary += indent + `전송된 메시지: ${data.metrics.chat_messages_sent.values.count}\n`;
  summary += indent + `수신된 메시지: ${data.metrics.chat_messages_received.values.count}\n`;
  summary += indent + `평균 메시지 지연시간: ${data.metrics.chat_message_latency?.values.avg.toFixed(2) || 0}ms\n\n`;

  summary += indent + '==================================================\n';

  return summary;
}
