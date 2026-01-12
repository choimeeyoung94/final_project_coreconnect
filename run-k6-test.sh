#!/bin/bash

# CoreConnect K6 부하 테스트 실행 스크립트
# 사용법: ./run-k6-test.sh [host] [users_file]

set -e

# 변수 설정
HOST="${1:-http://coreconnect.io.kr}"
USERS_FILE="${2:-./users.csv}"
TEST_FILE="./test.js"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="./k6-reports"

# 리포트 디렉토리 생성
mkdir -p "$REPORT_DIR"

echo "=========================================="
echo "  CoreConnect K6 부하 테스트"
echo "=========================================="
echo "  Host: $HOST"
echo "  Users File: $USERS_FILE"
echo "  Timestamp: $TIMESTAMP"
echo "=========================================="
echo ""

# test.js 파일 생성
echo "📝 test.js 파일 생성 중..."
cat > "$TEST_FILE" << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import papaparse from 'https://jslib.k6.io/papaparse/5.1.1/index.js';

export const options = {
  scenarios: {
    // 채팅 API (READ)
    chat_latest:       { executor: 'constant-vus', vus: 10, duration: '2m', exec: 'chatLatest' },
    chat_unread:       { executor: 'constant-vus', vus: 5,  duration: '2m', exec: 'chatUnread' },
    
    // 이메일 API (READ)
    email_inbox:       { executor: 'constant-vus', vus: 10, duration: '2m', exec: 'emailInbox' },
    email_unread:      { executor: 'constant-vus', vus: 5,  duration: '2m', exec: 'emailUnread' },
    email_sentbox:     { executor: 'constant-vus', vus: 5,  duration: '2m', exec: 'emailSentbox' },
    email_favorite:    { executor: 'constant-vus', vus: 5,  duration: '2m', exec: 'emailFavorite' },
    
    // 알림 API
    notif_fetch:       { executor: 'constant-vus', vus: 5,  duration: '2m', exec: 'notifFetch' },
  },
  thresholds: {
    'checks{type:chat_latest}':     ['rate>0.95'],
    'checks{type:chat_unread}':     ['rate>0.95'],
    'checks{type:email_inbox}':     ['rate>0.95'],
    'checks{type:email_unread}':    ['rate>0.95'],
    'checks{type:email_sentbox}':   ['rate>0.95'],
    'checks{type:email_favorite}':  ['rate>0.95'],
    'checks{type:notif}':           ['rate>0.95'],
    http_req_duration: ['p(95)<1000'],
  },
};

// 환경 변수 또는 기본값 설정
const BASE = __ENV.K6_HOST || 'http://coreconnect.io.kr';
const USERS_FILE = __ENV.USERS_FILE || './users.csv';
const LOGIN_PATH = '/api/v1/auth/login';

// URL 검증
if (!BASE || BASE === 'undefined') {
  throw new Error('BASE URL is not defined. Please set K6_HOST environment variable.');
}

console.log(`🌐 Base URL: ${BASE}`);
console.log(`📁 Users file: ${USERS_FILE}`);

// CSV 파일 읽기
let csvContent;
try {
  csvContent = open(USERS_FILE);
} catch (e) {
  throw new Error(`Failed to open users file: ${USERS_FILE}. Error: ${e.message}`);
}

const users = papaparse.parse(csvContent, { header: true, skipEmptyLines: true }).data
  .filter(u => u && u.username && u.password);

if (users.length === 0) {
  throw new Error('No valid users found in CSV file');
}

console.log(`👥 Found ${users.length} users in CSV`);

export function setup() {
  console.log(`\n========================================`);
  console.log(`  🚀 로그인 시작: ${users.length}명`);
  console.log(`  🌐 서버: ${BASE}`);
  console.log(`========================================\n`);
  
  const sessions = [];

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const loginUrl = `${BASE}${LOGIN_PATH}`;
    
    console.log(`Attempting login for: ${u.username} to ${loginUrl}`);
    
    const payload = JSON.stringify({ 
      email: u.username, 
      password: u.password 
    });
    
    const params = {
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: '30s'
    };

    let res;
    try {
      res = http.post(loginUrl, payload, params);
    } catch (e) {
      console.error(`✗ ${u.username}: Request failed - ${e.message}`);
      continue;
    }

    if (!res) {
      console.error(`✗ ${u.username}: No response received`);
      continue;
    }

    if (res.status !== 200) {
      console.error(`✗ ${u.username}: ${res.status} - ${res.body ? res.body.substring(0, 100) : 'No body'}`);
      continue;
    }

    let cookie = '';
    if (res.cookies && res.cookies.access_token && res.cookies.access_token.length > 0) {
      const accessToken = res.cookies.access_token[0].value;
      const refreshToken = res.cookies.refresh_token ? res.cookies.refresh_token[0].value : '';
      cookie = `access_token=${accessToken}`;
      if (refreshToken) cookie += `; refresh_token=${refreshToken}`;
    }

    if (!cookie) {
      console.error(`✗ ${u.username}: No cookie in response`);
      continue;
    }

    sessions.push({ 
      username: u.username, 
      email: u.username,
      cookie: cookie 
    });
    console.log(`✓ ${u.username} - Logged in successfully`);
  }

  if (sessions.length === 0) {
    throw new Error('No sessions created - all logins failed');
  }

  console.log(`\n========================================`);
  console.log(`  ✅ ${sessions.length}명 로그인 완료`);
  console.log(`========================================\n`);
  
  return { sessions, baseUrl: BASE };
}

function pickSession(state) {
  const idx = (__VU - 1) % state.sessions.length;
  return state.sessions[idx];
}

function authHeaders(sess) {
  return {
    'Cookie': sess.cookie,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
}

// ========================================
// 채팅 API
// ========================================

// 채팅방별 마지막 메시지 목록 조회
export function chatLatest(state) {
  const sess = pickSession(state);
  const url = `${state.baseUrl}/api/v1/chat/rooms/messages/latest`;
  const res = http.get(url, { headers: authHeaders(sess) });
  check(res, { 'chat_latest 200': (r) => r.status === 200 }, { type: 'chat_latest' });
  sleep(1);
}

// 안 읽은 메시지 조회
export function chatUnread(state) {
  const sess = pickSession(state);
  const url = `${state.baseUrl}/api/v1/chat/messages/unread`;
  const res = http.get(url, { headers: authHeaders(sess) });
  check(res, { 'chat_unread 200': (r) => r.status === 200 }, { type: 'chat_unread' });
  sleep(1);
}

// ========================================
// 이메일 API
// ========================================

// 받은메일함 조회
export function emailInbox(state) {
  const sess = pickSession(state);
  const url = `${state.baseUrl}/api/v1/email/inbox`;
  const res = http.get(url, {
    params: { 
      userEmail: sess.email, 
      page: 0, 
      size: 20, 
      filter: 'ALL' 
    },
    headers: authHeaders(sess)
  });
  check(res, { 'email_inbox 200': (r) => r.status === 200 }, { type: 'email_inbox' });
  sleep(1);
}

// 안 읽은 메일 개수 조회
export function emailUnread(state) {
  const sess = pickSession(state);
  const url = `${state.baseUrl}/api/v1/email/inbox/unread-count`;
  const res = http.get(url, {
    params: { userEmail: sess.email },
    headers: authHeaders(sess)
  });
  check(res, { 'email_unread 200': (r) => r.status === 200 }, { type: 'email_unread' });
  sleep(1);
}

// 보낸메일함 조회
export function emailSentbox(state) {
  const sess = pickSession(state);
  const url = `${state.baseUrl}/api/v1/email/sentbox`;
  const res = http.get(url, {
    params: { 
      userEmail: sess.email, 
      page: 0, 
      size: 20 
    },
    headers: authHeaders(sess)
  });
  check(res, { 'email_sentbox 200': (r) => r.status === 200 }, { type: 'email_sentbox' });
  sleep(1);
}

// 중요 메일 조회
export function emailFavorite(state) {
  const sess = pickSession(state);
  const url = `${state.baseUrl}/api/v1/email/favorite`;
  const res = http.get(url, {
    params: { 
      userEmail: sess.email, 
      page: 0, 
      size: 20 
    },
    headers: authHeaders(sess)
  });
  check(res, { 'email_favorite 200': (r) => r.status === 200 }, { type: 'email_favorite' });
  sleep(1);
}

// ========================================
// 알림 API
// ========================================

export function notifFetch(state) {
  const sess = pickSession(state);
  const url = `${state.baseUrl}/notifications`;
  const res = http.get(url, { headers: authHeaders(sess) });
  check(res, { 'notif 200': (r) => r.status === 200 }, { type: 'notif' });
  sleep(1);
}
EOF

echo "✅ test.js 파일 생성 완료"
echo ""

# users.csv 파일이 없으면 생성
if [ ! -f "$USERS_FILE" ]; then
    echo "⚠️  users.csv 파일이 없습니다. 샘플 파일을 생성합니다..."
    cat > "$USERS_FILE" << 'EOFUSERS'
username,password
admin@coreconnect.io.kr,coreconnect123
user1@coreconnect.io.kr,coreconnect123
user2@coreconnect.io.kr,coreconnect123
user3@coreconnect.io.kr,coreconnect123
user4@coreconnect.io.kr,coreconnect123
EOFUSERS
    echo "✅ 샘플 users.csv 파일 생성 완료"
    echo "   📝 실제 사용자 정보로 수정해주세요!"
    echo ""
fi

# k6 설치 확인
if ! command -v k6 &> /dev/null; then
    echo "❌ k6가 설치되어 있지 않습니다."
    echo ""
    echo "설치 방법:"
    echo "  sudo gpg -k"
    echo "  sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69"
    echo "  echo \"deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main\" | sudo tee /etc/apt/sources.list.d/k6.list"
    echo "  sudo apt-get update"
    echo "  sudo apt-get install k6"
    exit 1
fi

echo "🚀 K6 테스트 실행 중..."
echo ""

# K6 실행
K6_HOST="$HOST" USERS_FILE="$USERS_FILE" k6 run \
  --out json="$REPORT_DIR/result_${TIMESTAMP}.json" \
  --summary-trend-stats="min,avg,med,max,p(90),p(95),p(99)" \
  "$TEST_FILE" | tee "$REPORT_DIR/console_${TIMESTAMP}.log"

echo ""
echo "=========================================="
echo "  ✅ 테스트 완료!"
echo "=========================================="
echo ""
echo "📊 결과 파일:"
echo "  - JSON: $REPORT_DIR/result_${TIMESTAMP}.json"
echo "  - 콘솔 로그: $REPORT_DIR/console_${TIMESTAMP}.log"
echo ""

# HTML 리포트 생성 (k6-html-reporter가 설치되어 있다면)
if command -v k6-html-reporter &> /dev/null; then
    echo "📈 HTML 리포트 생성 중..."
    k6-html-reporter "$REPORT_DIR/result_${TIMESTAMP}.json" \
      --output "$REPORT_DIR/report_${TIMESTAMP}.html"
    echo "✅ HTML 리포트: $REPORT_DIR/report_${TIMESTAMP}.html"
    echo ""
    echo "🌐 브라우저에서 확인하려면:"
    echo "   python3 -m http.server 8000"
    echo "   그리고 브라우저에서: http://localhost:8000/$REPORT_DIR/report_${TIMESTAMP}.html"
else
    echo "💡 Tip: HTML 리포트를 생성하려면 k6-html-reporter를 설치하세요:"
    echo "   npm install -g k6-html-reporter"
fi

echo ""
echo "=========================================="
