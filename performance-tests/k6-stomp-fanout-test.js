/**
 * k6 STOMP fanout(브로드캐스트) 테스트
 *
 * 목적:
 * - "채팅방에서 여러명이 동시에 메시지를 보낼 때" 멀티 Pod 환경에서
 *   메시지 팬아웃(전달)이 제대로 되는지/어디서 깨지는지 수치로 확인.
 *
 * 핵심 포인트(브로커 없음):
 * - Spring enableSimpleBroker("/topic")는 "Pod(프로세스) 로컬" 브로커라서
 *   Pod가 여러 개면 같은 room이라도 Pod가 다르면 서로 메시지를 못 받음.
 * - 그래서 '전체 수신량(팬아웃)'이 이론적으로 대략 1/Pod수 수준으로 줄어듦.
 *
 * 주의:
 * - /ws/chat 은 SockJS라 k6 ws로 직접 연결 불가
 * - 백엔드에 raw ws 엔드포인트(/ws/chat-ws 또는 /ws/chat-raw)를 두고 그걸로 테스트
 */

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

// ========= 커스텀 메트릭 =========
const stompConnected = new Counter('stomp_connected');
const stompConnectFailed = new Counter('stomp_connect_failed');
const stompMessagesSent = new Counter('stomp_messages_sent');
const stompMessagesReceived = new Counter('stomp_messages_received');
const stompMessagesReceivedFromOthers = new Counter('stomp_messages_received_from_others');
// 채팅 메시지 프레임만 분리 집계 (권장 지표)
const chatMessagesReceived = new Counter('chat_messages_received');
const chatMessagesReceivedFromOthers = new Counter('chat_messages_received_from_others');
const unreadUpdatesReceived = new Counter('unread_updates_received');
const loginSuccessRate = new Rate('login_success_rate');

// ========= 환경변수 =========
// 기본값:
// - 클러스터 내부 실행(Job/Pod)일 때: http://chat-service / ws://chat-service
// - 그 외(로컬/EC2 단독 실행 등): http://localhost:8080 / ws://localhost:8080
// NOTE: Job YAML의 env가 누락/오타가 나면 __ENV.BASE_URL이 비어있을 수 있어,
//       KUBERNETES_SERVICE_HOST(파드 자동 주입 env)로 "클러스터 내부"를 감지해 안전한 기본값을 사용합니다.
const DEFAULT_BASE_URL = __ENV.KUBERNETES_SERVICE_HOST ? 'http://chat-service' : 'http://localhost:8080';
const DEFAULT_WS_BASE = __ENV.KUBERNETES_SERVICE_HOST ? 'ws://chat-service' : 'ws://localhost:8080';
const BASE_URL = __ENV.BASE_URL || DEFAULT_BASE_URL;
// 예) ws://<ingress-host>  (스크립트 내부에서 /ws/chat-ws 를 붙입니다)
const WS_BASE = __ENV.WS_BASE || DEFAULT_WS_BASE;
const WS_PATH = __ENV.WS_PATH || '/ws/chat-ws'; // raw ws endpoint (k6용)

const ROOM_COUNT = parseInt(__ENV.ROOM_COUNT || '5', 10); // room 분산 개수
const MESSAGES_PER_USER = parseInt(__ENV.MESSAGES_PER_USER || '1', 10);
const WAIT_AFTER_SEND_SEC = parseFloat(__ENV.WAIT_AFTER_SEND_SEC || '6'); // 다른 유저 메시지 수신 대기

// 인증(로그인) 설정
// - LOGIN_EMAIL/LOGIN_PASSWORD가 있으면 모든 VU가 "단일 테스트 계정"으로 로그인
// - 없으면 기존 규칙(testuser{n}@test.com)로 로그인(사전에 생성되어 있거나, security.mode=open 이면 자동 생성)
const LOGIN_EMAIL = __ENV.LOGIN_EMAIL; // 예: test@coreconnect.io.kr
const LOGIN_PASSWORD = __ENV.LOGIN_PASSWORD; // 예: test123!

// 기존 테스트용 계정 규칙(옵션)
const USER_EMAIL_PREFIX = __ENV.USER_EMAIL_PREFIX || 'testuser';
const USER_EMAIL_DOMAIN = __ENV.USER_EMAIL_DOMAIN || '@test.com';
const USER_PASSWORD = __ENV.USER_PASSWORD || 'Test1234!';

// 로그인 엔드포인트(기본값: /api/v1/auth/login)
const LOGIN_PATH = __ENV.LOGIN_PATH || '/api/v1/auth/login';
// 사전 헬스체크 경로(환경에 따라 다를 수 있어 옵션 제공)
const HEALTH_PATH = __ENV.HEALTH_PATH || '/actuator/health';

export const options = {
  scenarios: {
    fanout: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: __ENV.RAMP_UP || '30s', target: parseInt(__ENV.VUS || '60', 10) },
        { duration: __ENV.HOLD || '60s', target: parseInt(__ENV.VUS || '60', 10) },
        { duration: __ENV.RAMP_DOWN || '20s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  // k6 Cloud 업로드 시 프로젝트/런 이름 지정 (local-execution 업로드에도 사용)
  // NOTE: ext.loadimpact는 deprecated → options.cloud 사용
  cloud: {
    projectID: parseInt(__ENV.K6_PROJECT_ID || '0', 10), // 0이면 기본 프로젝트로 업로드됨(계정 설정에 따름)
    name: __ENV.K6_TEST_NAME || 'STOMP fanout test (no shared broker)',
  },
  thresholds: {
    'login_success_rate': ['rate>0.95'],
  },
};

export function setup() {
  // BASE_URL 오타/접근 불가를 초기에 빠르게 감지 (connection refused 방지)
  const url = `${BASE_URL}${HEALTH_PATH}`;
  const res = http.get(url, { timeout: '10s' });
  const ok = check(res, {
    'health endpoint reachable': (r) => r && r.status >= 200 && r.status < 500,
  });

  if (!ok) {
    throw new Error(
      `[setup] Backend not reachable. BASE_URL=${BASE_URL} HEALTH_PATH=${HEALTH_PATH} status=${res ? res.status : 'n/a'}\n` +
      `- (클러스터 내부 실행) BASE_URL=http://chat-service , WS_BASE=ws://chat-service\n` +
      `- (EC2/외부 실행) BASE_URL/WS_BASE를 'localhost'가 아니라 실제 Ingress/ALB 주소로 설정하세요.\n` +
      `  예: BASE_URL=http://<ALB_DNS>, WS_BASE=ws://<ALB_DNS>`
    );
  }
  return {};
}

function login(email, password) {
  const url = `${BASE_URL}${LOGIN_PATH}`;
  const payload = JSON.stringify({ email, password });
  const res = http.post(url, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '30s',
  });

  const ok = check(res, {
    'login status 200': (r) => r.status === 200,
    'login has access_token cookie': (r) => r.cookies && r.cookies.access_token && r.cookies.access_token.length > 0,
  });
  loginSuccessRate.add(ok);

  if (!ok) return null;
  return res.cookies.access_token[0].value;
}

function stompFrame(command, headers, body) {
  let out = command + '\n';
  if (headers) {
    Object.keys(headers).forEach((k) => {
      out += `${k}:${headers[k]}\n`;
    });
  }
  out += '\n';
  if (body) out += body;
  out += '\x00';
  return out;
}

function parseStompBody(frame) {
  // frame: "MESSAGE\nheader:...\n\n{json}\x00"
  const idx = frame.indexOf('\n\n');
  if (idx === -1) return '';
  const bodyWithNull = frame.slice(idx + 2);
  return bodyWithNull.replace(/\x00/g, '');
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch (_) {
    return null;
  }
}

export default function () {
  // room 분산: 1..ROOM_COUNT
  const roomId = (__VU % ROOM_COUNT) + 1;
  // 사용자 선택:
  // - 단일 계정 로그인 모드: LOGIN_EMAIL
  // - 다중 계정 모드: testuser{__VU}@test.com
  const email = (LOGIN_EMAIL && LOGIN_EMAIL.length > 0)
    ? LOGIN_EMAIL
    : `${USER_EMAIL_PREFIX}${__VU}${USER_EMAIL_DOMAIN}`;
  const password = (LOGIN_PASSWORD && LOGIN_PASSWORD.length > 0)
    ? LOGIN_PASSWORD
    : USER_PASSWORD;

  const token = login(email, password);
  if (!token) {
    // 로그인 실패면 이번 iteration은 중단
    sleep(1);
    return;
  }

  const wsUrl = `${WS_BASE}${WS_PATH}?access_token=${token}`;
  const topic = `/topic/chat.room.${roomId}`;

  const myMarker = `vu:${__VU}`; // 내 메시지 식별자(자기/타인 구분용)
  let isConnected = false;

  ws.connect(wsUrl, {}, function (socket) {
    socket.on('open', function () {
      socket.send(stompFrame('CONNECT', {
        'accept-version': '1.1,1.0',
        'heart-beat': '10000,10000',
      }));
    });

    socket.on('message', function (data) {
      // CONNECTED 수신 후 구독/전송
      if (!isConnected && typeof data === 'string' && data.startsWith('CONNECTED')) {
        isConnected = true;
        stompConnected.add(1);

        socket.send(stompFrame('SUBSCRIBE', {
          id: `sub-${__VU}`,
          destination: topic,
        }));

        // subscribe 직후 너무 빨리 보내면 누락될 수 있어 약간 대기
        socket.setTimeout(function () {
          for (let i = 0; i < MESSAGES_PER_USER; i++) {
            const body = JSON.stringify({
              roomId: roomId,
              content: `hello ${myMarker} #${i} t=${Date.now()}`,
            });
            socket.send(stompFrame('SEND', {
              destination: '/app/chat.sendMessage',
              'content-type': 'application/json',
            }, body));
            stompMessagesSent.add(1);
          }
        }, 300);
        return;
      }

      if (typeof data === 'string' && data.startsWith('MESSAGE')) {
        stompMessagesReceived.add(1);
        const body = parseStompBody(data);
        // 기존 지표(참고용): 내 marker가 없으면 "타인/시스템"으로 카운트
        // (unreadCount 업데이트 등도 포함될 수 있음)
        if (body && body.indexOf(myMarker) === -1) stompMessagesReceivedFromOthers.add(1);

        // 권장 지표: JSON 파싱 후 "채팅 메시지"만 분리 집계
        const json = body ? safeJsonParse(body) : null;
        if (json) {
          // unreadCount 업데이트 계열
          if (json.type && typeof json.type === 'string' && json.type.indexOf('UNREAD') !== -1) {
            unreadUpdatesReceived.add(1);
          }
          // 실제 채팅 메시지: ChatResponseDTO의 messageContent 필드 기준
          if (typeof json.messageContent === 'string') {
            chatMessagesReceived.add(1);
            if (json.messageContent.indexOf(myMarker) === -1) {
              chatMessagesReceivedFromOthers.add(1);
            }
          }
        }
      }
    });

    socket.on('error', function () {
      stompConnectFailed.add(1);
    });

    // 충분히 수신 대기 후 종료
    socket.setTimeout(function () {
      socket.close();
    }, Math.max(1000, WAIT_AFTER_SEND_SEC * 1000));
  });
}


