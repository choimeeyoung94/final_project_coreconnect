import { check, sleep } from 'k6';
import http from 'k6/http';
import ws from 'k6/ws';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL, WS_URL, SCENARIOS, THRESHOLDS, TEST_USERS } from './config.js';

// 커스텀 메트릭
const notificationsSent = new Counter('notifications_sent');
const notificationsReceived = new Counter('notifications_received');
const notificationLatency = new Trend('notification_latency');
const notificationReadOperations = new Counter('notification_read_operations');
const wsConnectionTime = new Trend('ws_connection_time');

// 테스트 옵션
export const options = {
  scenarios: {
    notification_load_test: SCENARIOS.load, // config.js에서 선택
  },
  thresholds: {
    ...THRESHOLDS,
    notification_latency: ['p(95)<1000', 'p(99)<2000'], // 알림 지연시간 목표
  },
};

// JWT 토큰 획득
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
    return response.headers['Authorization'] || body.token || body.accessToken;
  }

  console.error(`Login failed: ${response.status}`);
  return null;
}

// 알림 목록 조회
function getNotifications(token) {
  const url = `${BASE_URL}/api/v1/chat/notifications`;
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };

  const response = http.get(url, params);

  check(response, {
    '알림 목록 조회 성공': (r) => r.status === 200,
  });

  return response;
}

// 미읽은 알림 조회
function getUnreadNotifications(token) {
  const url = `${BASE_URL}/api/v1/chat/notifications/unread`;
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };

  const response = http.get(url, params);

  check(response, {
    '미읽은 알림 조회 성공': (r) => r.status === 200,
  });

  return response;
}

// 알림 읽음 처리
function markNotificationAsRead(token, notificationId) {
  const url = `${BASE_URL}/api/v1/chat/notifications/${notificationId}/read`;
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };

  const response = http.put(url, null, params);

  check(response, {
    '알림 읽음 처리 성공': (r) => r.status === 200,
  });

  if (response.status === 200) {
    notificationReadOperations.add(1);
  }

  return response;
}

// 모든 알림 읽음 처리
function markAllNotificationsAsRead(token) {
  const url = `${BASE_URL}/api/v1/chat/notifications/read-all`;
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };

  const response = http.put(url, null, params);

  check(response, {
    '모든 알림 읽음 처리 성공': (r) => r.status === 200,
  });

  if (response.status === 200) {
    notificationReadOperations.add(1);
  }

  return response;
}

// 알림 전송 (테스트용)
function sendNotification(token, recipientId, notificationType, message) {
  const url = `${BASE_URL}/api/v1/notification/send`;
  const payload = JSON.stringify({
    recipientId: recipientId,
    notificationType: notificationType, // CHAT, EMAIL, NOTICE, APPROVAL, SCHEDULE
    notificationMessage: message,
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
    '알림 전송 성공': (r) => r.status === 200 || r.status === 201,
  });

  if (response.status === 200 || response.status === 201) {
    notificationsSent.add(1);
    notificationLatency.add(latency);
  }

  return response;
}

// WebSocket 실시간 알림 수신 테스트
function testWebSocketNotification(token, userId) {
  const wsUrl = `${WS_URL}/ws/notification?token=${token}`;
  const connectStart = Date.now();

  const response = ws.connect(wsUrl, { headers: { 'Authorization': `Bearer ${token}` } }, function (socket) {
    const connectTime = Date.now() - connectStart;
    wsConnectionTime.add(connectTime);

    socket.on('open', () => {
      console.log(`WebSocket 알림 연결 성공 (userId: ${userId})`);

      // 연결 확인 메시지 전송 (선택적)
      socket.send(JSON.stringify({
        type: 'PING',
        userId: userId,
      }));
    });

    socket.on('message', (data) => {
      console.log(`WebSocket 알림 수신: ${data}`);

      try {
        const notification = JSON.parse(data);

        // 알림 수신 메트릭 기록
        notificationsReceived.add(1);

        // 알림 수신 지연시간 계산 (발송 시간이 있는 경우)
        if (notification.notificationSentAt) {
          const sentTime = new Date(notification.notificationSentAt).getTime();
          const receivedTime = Date.now();
          const latency = receivedTime - sentTime;
          notificationLatency.add(latency);
        }

        // 수신한 알림에 자동 응답 (선택적)
        socket.send(JSON.stringify({
          type: 'ACK',
          notificationId: notification.id,
        }));
      } catch (e) {
        console.error('알림 파싱 에러:', e);
      }
    });

    socket.on('error', (e) => {
      console.error('WebSocket 알림 에러:', e);
    });

    socket.on('close', () => {
      console.log('WebSocket 알림 연결 종료');
    });

    // 30초간 연결 유지
    socket.setTimeout(() => {
      console.log('WebSocket 알림 세션 타임아웃');
      socket.close();
    }, 30000);
  });

  check(response, {
    'WebSocket 알림 연결 성공': (r) => r && r.status === 101,
  });
}

// 메인 테스트 함수
export default function () {
  // 각 VU는 랜덤한 테스트 사용자로 로그인
  const userIndex = __VU % TEST_USERS.length;
  const user = TEST_USERS[userIndex];
  const userId = userIndex + 1; // 실제 userId에 맞게 수정

  // 1. 로그인하여 토큰 획득
  const token = getAuthToken(user.email, user.password);

  if (!token) {
    console.error('토큰 획득 실패, 테스트 중단');
    return;
  }

  sleep(1);

  // 2. 알림 목록 조회
  getNotifications(token);
  sleep(1);

  // 3. 미읽은 알림 조회
  const unreadResponse = getUnreadNotifications(token);
  sleep(1);

  // 4. 미읽은 알림이 있으면 일부 읽음 처리 (50% 확률)
  if (unreadResponse.status === 200 && Math.random() < 0.5) {
    try {
      const unreadNotifications = JSON.parse(unreadResponse.body);
      if (unreadNotifications.length > 0) {
        const randomNotification = unreadNotifications[Math.floor(Math.random() * unreadNotifications.length)];
        markNotificationAsRead(token, randomNotification.id);
        sleep(1);
      }
    } catch (e) {
      console.error('미읽은 알림 파싱 에러:', e);
    }
  }

  // 5. 모든 알림 읽음 처리 (10% 확률)
  if (Math.random() < 0.1) {
    markAllNotificationsAsRead(token);
    sleep(1);
  }

  // 6. 다른 사용자에게 알림 전송 (20% 확률)
  if (Math.random() < 0.2) {
    const recipientIndex = (__VU + 1) % TEST_USERS.length;
    const recipientId = recipientIndex + 1;
    const notificationTypes = ['CHAT', 'EMAIL', 'NOTICE', 'APPROVAL', 'SCHEDULE'];
    const randomType = notificationTypes[Math.floor(Math.random() * notificationTypes.length)];
    const message = `테스트 알림 from VU ${__VU} at ${new Date().toISOString()}`;

    sendNotification(token, recipientId, randomType, message);
    sleep(1);
  }

  // 7. WebSocket을 통한 실시간 알림 수신 테스트 (30% 확률)
  if (Math.random() < 0.3) {
    testWebSocketNotification(token, userId);
  }

  sleep(2);
}

// 테스트 완료 후 실행되는 함수
export function handleSummary(data) {
  return {
    'notification-test-summary.json': JSON.stringify(data),
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';

  let summary = '\n' + indent + '========== 알림 기능 부하 테스트 결과 ==========\n\n';

  summary += indent + `총 요청 수: ${data.metrics.http_reqs.values.count}\n`;
  summary += indent + `실패한 요청: ${data.metrics.http_req_failed.values.passes || 0}\n`;
  summary += indent + `평균 응답 시간: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  summary += indent + `P95 응답 시간: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  summary += indent + `P99 응답 시간: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n\n`;

  summary += indent + `전송된 알림: ${data.metrics.notifications_sent.values.count}\n`;
  summary += indent + `수신된 알림: ${data.metrics.notifications_received.values.count}\n`;
  summary += indent + `읽음 처리 작업: ${data.metrics.notification_read_operations.values.count}\n`;
  summary += indent + `평균 알림 지연시간: ${data.metrics.notification_latency?.values.avg.toFixed(2) || 0}ms\n`;
  summary += indent + `P95 알림 지연시간: ${data.metrics.notification_latency?.values['p(95)']?.toFixed(2) || 0}ms\n\n`;

  summary += indent + '==================================================\n';

  return summary;
}
