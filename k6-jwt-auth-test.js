import ws from 'k6/ws';
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// 메트릭 정의
const messagesSent = new Counter('messages_sent');
const messagesReceived = new Counter('messages_received');
const chatMessagesReceived = new Counter('chat_messages_received');
const connectionsSuccess = new Counter('connections_success');
const connectionsFailed = new Counter('connections_failed');
const messageLatency = new Trend('message_latency');
const errorRate = new Rate('errors');
const authTime = new Trend('auth_time');

export const options = {
  ext: {
    loadimpact: {
      name: "WebSocket STOMP Chat with JWT Auth",
      note: "JWT 인증 포함 채팅 부하 테스트"
    }
  },
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    'checks': ['rate>0.9'],
    'errors': ['rate<0.1'],
    'auth_time': ['p(95)<1000'],  // 인증 시간 < 1초
    'chat_messages_received': ['count>1000'],
  },
};

// ✅ 환경 변수 설정
const BACKEND_URL = 'http://54.116.26.182:8080';
const WS_URL = 'ws://54.116.26.182:8080/ws/chat-raw';

// ✅ 테스트 계정 생성 (실제 DB에 있는 계정 사용)
// 주의: 실제 환경에서는 테스트용 계정을 미리 생성해야 합니다
const TEST_USERS = [
  { email: 'test1@coreconnect.io', password: 'Test1234!' },
  { email: 'test2@coreconnect.io', password: 'Test1234!' },
  { email: 'test3@coreconnect.io', password: 'Test1234!' },
  { email: 'test4@coreconnect.io', password: 'Test1234!' },
  { email: 'test5@coreconnect.io', password: 'Test1234!' },
];

function createStompFrame(command, headers, body) {
  headers = headers || {};
  body = body || '';
  
  let frame = command + '\n';
  for (let key in headers) {
    if (headers.hasOwnProperty(key)) {
      frame += key + ':' + headers[key] + '\n';
    }
  }
  frame += '\n' + body + '\0';
  return frame;
}

// ✅ JWT 토큰 획득 함수
function getAuthToken(email, password) {
  const authStart = Date.now();
  
  const loginPayload = JSON.stringify({
    email: email,
    password: password,
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  const response = http.post(BACKEND_URL + '/api/v1/auth/login', loginPayload, params);
  
  const authDuration = Date.now() - authStart;
  authTime.add(authDuration);
  
  if (response.status !== 200) {
    console.log('[AUTH] Login failed - status: ' + response.status + ', email: ' + email);
    errorRate.add(1);
    return null;
  }
  
  // ✅ 쿠키에서 access_token 추출
  const cookies = response.cookies;
  let accessToken = null;
  
  for (let cookieName in cookies) {
    if (cookieName === 'access_token') {
      accessToken = cookies[cookieName][0].value;
      break;
    }
  }
  
  if (!accessToken) {
    console.log('[AUTH] No access_token in cookies');
    errorRate.add(1);
    return null;
  }
  
  console.log('[AUTH] ✅ Login success - email: ' + email + ', auth time: ' + authDuration + 'ms');
  return accessToken;
}

export default function () {
  // ✅ 1. 사용자 선택 (VU에 따라 순환)
  const userIndex = (__VU - 1) % TEST_USERS.length;
  const user = TEST_USERS[userIndex];
  
  // ✅ 2. JWT 토큰 획득
  const token = getAuthToken(user.email, user.password);
  
  if (!token) {
    console.log('[' + user.email + '] ❌ Authentication failed, skipping WebSocket test');
    return;
  }
  
  // ✅ 3. WebSocket 연결 (쿼리 파라미터로 토큰 전달)
  const wsUrlWithToken = WS_URL + '?access_token=' + encodeURIComponent(token);
  const userId = 'user-' + __VU + '-' + __ITER;
  const roomId = Math.floor(Math.random() * 5) + 1;
  
  console.log('[' + userId + '] 🔐 Connecting with JWT auth (room: ' + roomId + ')');

  const res = ws.connect(wsUrlWithToken, { tags: { userId: userId, email: user.email, roomId: roomId } }, function (socket) {
    let connected = false;
    let subscribed = false;
    let receivedCount = 0;
    let sentTimestamps = [];
    
    socket.on('open', function() {
      console.log('[' + userId + '] ✅ WebSocket connected with JWT');
      
      const connectFrame = createStompFrame('CONNECT', {
        'accept-version': '1.2,1.1',
        'heart-beat': '0,0',
      });
      
      socket.send(connectFrame);
    });

    socket.on('message', function(data) {
      messagesReceived.add(1);
      
      if (data.indexOf('CONNECTED') === 0) {
        connected = true;
        connectionsSuccess.add(1);
        console.log('[' + userId + '] ✅ STOMP connected');
        
        const subscribeFrame = createStompFrame('SUBSCRIBE', {
          'id': 'sub-' + __VU,
          'destination': '/topic/chat.room.' + roomId,
        });
        
        socket.send(subscribeFrame);
        subscribed = true;
        console.log('[' + userId + '] ✅ Subscribed to /topic/chat.room.' + roomId);
      }
      
      if (data.indexOf('MESSAGE') === 0) {
        receivedCount++;
        chatMessagesReceived.add(1);
        
        // 메시지 레이턴시 측정
        var now = Date.now();
        if (sentTimestamps.length > 0) {
          var latency = now - sentTimestamps[0];
          messageLatency.add(latency);
          sentTimestamps.shift();
        }
        
        console.log('[' + userId + '] 📨 Chat message received (' + receivedCount + ')');
      }
      
      if (data.indexOf('ERROR') === 0) {
        console.log('[' + userId + '] ❌ STOMP error: ' + data);
        errorRate.add(1);
        connectionsFailed.add(1);
      }
    });

    socket.on('error', function(e) {
      console.log('[' + userId + '] ❌ WebSocket error');
      errorRate.add(1);
      connectionsFailed.add(1);
    });

    socket.setTimeout(function() {
      if (connected && subscribed) {
        console.log('[' + userId + '] 📤 Sending 5 messages with JWT auth...');
        
        // 메시지 전송 (5개)
        for (let i = 0; i < 5; i++) {
          const chatPayload = JSON.stringify({
            roomId: roomId,
            content: 'JWT authenticated message from ' + user.email + ' - #' + i,
          });
          
          const sendFrame = createStompFrame('SEND', {
            'destination': '/app/chat.sendMessage',
            'content-type': 'application/json',
          }, chatPayload);
          
          var sendTime = Date.now();
          sentTimestamps.push(sendTime);
          
          socket.send(sendFrame);
          messagesSent.add(1);
          console.log('[' + userId + '] ✅ Sent JWT-authenticated message #' + i);
          
          sleep(1);
        }
        
        // 다른 사용자의 메시지를 받을 시간 확보
        console.log('[' + userId + '] ⏳ Waiting for messages (10 seconds)...');
        sleep(10);
        
        console.log('[' + userId + '] 📊 Final stats - Sent: 5, Received: ' + receivedCount);
      } else {
        console.log('[' + userId + '] ⚠️ Not connected or subscribed');
      }
      
      // DISCONNECT
      console.log('[' + userId + '] 👋 Disconnecting...');
      const disconnectFrame = createStompFrame('DISCONNECT', {});
      socket.send(disconnectFrame);
      socket.close();
    }, 20000);
  });

  check(res, { 
    'WebSocket connected': function(r) { return r && r.status === 101; },
  });
  
  // VU 간 간격 (과도한 동시 로그인 방지)
  sleep(0.5);
}

