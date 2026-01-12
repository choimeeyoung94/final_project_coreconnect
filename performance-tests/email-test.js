import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Trend, Rate } from 'k6/metrics';
import { BASE_URL, SCENARIOS, THRESHOLDS, TEST_USERS } from './config.js';

// 커스텀 메트릭
const emailsSent = new Counter('emails_sent');
const emailsReceived = new Counter('emails_received');
const emailsSavedAsDraft = new Counter('emails_saved_as_draft');
const emailsMarkedAsRead = new Counter('emails_marked_as_read');
const emailSendLatency = new Trend('email_send_latency');
const emailRetrievalLatency = new Trend('email_retrieval_latency');
const emailSendSuccessRate = new Rate('email_send_success_rate');

// 테스트 옵션
export const options = {
  scenarios: {
    email_load_test: SCENARIOS.load, // config.js에서 선택
  },
  thresholds: {
    ...THRESHOLDS,
    email_send_latency: ['p(95)<2000', 'p(99)<5000'], // 이메일 발송 시간 목표
    email_send_success_rate: ['rate>0.95'], // 95% 이상 성공률
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

// 이메일 발송
function sendEmail(token, recipients, subject, content, attachFiles = false) {
  const url = `${BASE_URL}/api/v1/email/send`;
  const payload = JSON.stringify({
    emailTitle: subject,
    emailContent: content,
    recipients: recipients, // [{email: 'user@example.com'}]
    emailSaveStatusYn: false,
    favoriteStatus: false,
    attachments: attachFiles ? [] : undefined, // 실제 첨부파일 처리는 multipart/form-data 필요
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

  const success = response.status === 200 || response.status === 201;

  check(response, {
    '이메일 발송 성공': (r) => success,
  });

  if (success) {
    emailsSent.add(1);
    emailSendSuccessRate.add(1);
  } else {
    emailSendSuccessRate.add(0);
  }

  emailSendLatency.add(latency);

  return response;
}

// 받은메일함 조회
function getInbox(token, page = 0, size = 20) {
  const url = `${BASE_URL}/api/v1/email/inbox?page=${page}&size=${size}`;
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };

  const startTime = Date.now();
  const response = http.get(url, params);
  const latency = Date.now() - startTime;

  check(response, {
    '받은메일함 조회 성공': (r) => r.status === 200,
  });

  emailRetrievalLatency.add(latency);

  if (response.status === 200) {
    try {
      const body = JSON.parse(response.body);
      emailsReceived.add(body.content?.length || 0);
    } catch (e) {
      console.error('받은메일함 응답 파싱 에러:', e);
    }
  }

  return response;
}

// 보낸메일함 조회
function getSentbox(token, page = 0, size = 20) {
  const url = `${BASE_URL}/api/v1/email/sentbox?page=${page}&size=${size}`;
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };

  const startTime = Date.now();
  const response = http.get(url, params);
  const latency = Date.now() - startTime;

  check(response, {
    '보낸메일함 조회 성공': (r) => r.status === 200,
  });

  emailRetrievalLatency.add(latency);

  return response;
}

// 이메일 상세 조회
function getEmailDetail(token, emailId) {
  const url = `${BASE_URL}/api/v1/email/${emailId}`;
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };

  const response = http.get(url, params);

  check(response, {
    '이메일 상세 조회 성공': (r) => r.status === 200,
  });

  return response;
}

// 미읽은 메일 개수 조회
function getUnreadCount(token) {
  const url = `${BASE_URL}/api/v1/email/inbox/unread-count`;
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };

  const response = http.get(url, params);

  check(response, {
    '미읽은 메일 개수 조회 성공': (r) => r.status === 200,
  });

  return response;
}

// 이메일 읽음 처리
function markEmailAsRead(token, emailId) {
  const url = `${BASE_URL}/api/v1/email/${emailId}/read`;
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };

  const response = http.patch(url, null, params);

  check(response, {
    '이메일 읽음 처리 성공': (r) => r.status === 200,
  });

  if (response.status === 200) {
    emailsMarkedAsRead.add(1);
  }

  return response;
}

// 이메일 임시저장
function saveDraft(token, recipients, subject, content) {
  const url = `${BASE_URL}/api/v1/email/draft`;
  const payload = JSON.stringify({
    emailTitle: subject,
    emailContent: content,
    recipients: recipients,
    emailSaveStatusYn: true,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };

  const response = http.post(url, payload, params);

  check(response, {
    '이메일 임시저장 성공': (r) => r.status === 200 || r.status === 201,
  });

  if (response.status === 200 || response.status === 201) {
    emailsSavedAsDraft.add(1);
  }

  return response;
}

// 임시보관함 조회
function getDraftbox(token, page = 0, size = 20) {
  const url = `${BASE_URL}/api/v1/email/draftbox?page=${page}&size=${size}`;
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };

  const response = http.get(url, params);

  check(response, {
    '임시보관함 조회 성공': (r) => r.status === 200,
  });

  return response;
}

// 휴지통 조회
function getTrash(token, page = 0, size = 20) {
  const url = `${BASE_URL}/api/v1/email/trash?page=${page}&size=${size}`;
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };

  const response = http.get(url, params);

  check(response, {
    '휴지통 조회 성공': (r) => r.status === 200,
  });

  return response;
}

// 중요 메일 조회
function getFavorites(token, page = 0, size = 20) {
  const url = `${BASE_URL}/api/v1/email/favorite?page=${page}&size=${size}`;
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };

  const response = http.get(url, params);

  check(response, {
    '중요 메일 조회 성공': (r) => r.status === 200,
  });

  return response;
}

// 중요 표시 토글
function toggleFavorite(token, emailId) {
  const url = `${BASE_URL}/api/v1/email/${emailId}/favorite`;
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };

  const response = http.patch(url, null, params);

  check(response, {
    '중요 표시 토글 성공': (r) => r.status === 200,
  });

  return response;
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

  // 2. 받은메일함 조회
  getInbox(token, 0, 20);
  sleep(1);

  // 3. 보낸메일함 조회
  getSentbox(token, 0, 20);
  sleep(1);

  // 4. 미읽은 메일 개수 조회
  const unreadCountResponse = getUnreadCount(token);
  sleep(1);

  // 5. 이메일 발송 테스트 (30% 확률)
  if (Math.random() < 0.3) {
    const recipientIndex = (__VU + 1) % TEST_USERS.length;
    const recipient = TEST_USERS[recipientIndex];

    const subject = `부하 테스트 메일 from VU ${__VU} at ${new Date().toISOString()}`;
    const content = `
      <h1>성능 테스트 이메일</h1>
      <p>이것은 k6 부하 테스트로 발송된 이메일입니다.</p>
      <p>Virtual User: ${__VU}</p>
      <p>Iteration: ${__ITER}</p>
      <p>시간: ${new Date().toISOString()}</p>
    `;

    sendEmail(token, [{ email: recipient.email }], subject, content);
    sleep(2);
  }

  // 6. 이메일 임시저장 테스트 (15% 확률)
  if (Math.random() < 0.15) {
    const recipientIndex = (__VU + 2) % TEST_USERS.length;
    const recipient = TEST_USERS[recipientIndex];

    const draftSubject = `임시저장 메일 from VU ${__VU}`;
    const draftContent = `임시저장된 이메일 내용입니다.`;

    saveDraft(token, [{ email: recipient.email }], draftSubject, draftContent);
    sleep(1);
  }

  // 7. 임시보관함 조회 (20% 확률)
  if (Math.random() < 0.2) {
    getDraftbox(token);
    sleep(1);
  }

  // 8. 받은메일함의 첫 번째 메일 상세 조회 및 읽음 처리 (40% 확률)
  if (Math.random() < 0.4) {
    const inboxResponse = getInbox(token, 0, 5);

    if (inboxResponse.status === 200) {
      try {
        const inbox = JSON.parse(inboxResponse.body);
        if (inbox.content && inbox.content.length > 0) {
          const firstEmail = inbox.content[0];
          const emailId = firstEmail.emailId;

          // 이메일 상세 조회
          getEmailDetail(token, emailId);
          sleep(1);

          // 읽음 처리
          if (!firstEmail.emailReadYn) {
            markEmailAsRead(token, emailId);
            sleep(1);
          }

          // 중요 표시 토글 (30% 확률)
          if (Math.random() < 0.3) {
            toggleFavorite(token, emailId);
            sleep(1);
          }
        }
      } catch (e) {
        console.error('받은메일함 응답 파싱 에러:', e);
      }
    }
  }

  // 9. 중요 메일 조회 (15% 확률)
  if (Math.random() < 0.15) {
    getFavorites(token);
    sleep(1);
  }

  // 10. 휴지통 조회 (10% 확률)
  if (Math.random() < 0.1) {
    getTrash(token);
    sleep(1);
  }

  sleep(2);
}

// 테스트 완료 후 실행되는 함수
export function handleSummary(data) {
  return {
    'email-test-summary.json': JSON.stringify(data),
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';

  let summary = '\n' + indent + '========== 이메일 기능 부하 테스트 결과 ==========\n\n';

  summary += indent + `총 요청 수: ${data.metrics.http_reqs.values.count}\n`;
  summary += indent + `실패한 요청: ${data.metrics.http_req_failed.values.passes || 0}\n`;
  summary += indent + `평균 응답 시간: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  summary += indent + `P95 응답 시간: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  summary += indent + `P99 응답 시간: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n\n`;

  summary += indent + `발송된 이메일: ${data.metrics.emails_sent.values.count}\n`;
  summary += indent + `조회된 이메일: ${data.metrics.emails_received.values.count}\n`;
  summary += indent + `임시저장된 이메일: ${data.metrics.emails_saved_as_draft.values.count}\n`;
  summary += indent + `읽음 처리된 이메일: ${data.metrics.emails_marked_as_read.values.count}\n`;
  summary += indent + `이메일 발송 성공률: ${(data.metrics.email_send_success_rate.values.rate * 100).toFixed(2)}%\n`;
  summary += indent + `평균 이메일 발송 시간: ${data.metrics.email_send_latency?.values.avg.toFixed(2) || 0}ms\n`;
  summary += indent + `P95 이메일 발송 시간: ${data.metrics.email_send_latency?.values['p(95)']?.toFixed(2) || 0}ms\n`;
  summary += indent + `평균 이메일 조회 시간: ${data.metrics.email_retrieval_latency?.values.avg.toFixed(2) || 0}ms\n\n`;

  summary += indent + '==================================================\n';

  return summary;
}
