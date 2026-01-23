import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { getTestUser } from './common/test-users.js';

// ============================================================================
// Custom Metrics - 성능 분석을 위한 세밀한 메트릭
// ============================================================================
const emailSendDuration = new Trend('email_send_duration');
const emailSendSuccess = new Rate('email_send_success_rate');
const emailSendErrors = new Counter('email_send_errors');

const emailInboxDuration = new Trend('email_inbox_duration');
const emailInboxSuccess = new Rate('email_inbox_success_rate');
const emailInboxSize = new Trend('email_inbox_size');

const emailDetailDuration = new Trend('email_detail_duration');
const emailDetailSuccess = new Rate('email_detail_success_rate');

const dbQueryDuration = new Trend('db_query_duration'); // 예상 DB 쿼리 시간
const throughputPerSecond = new Counter('throughput_per_second');
const concurrentUsers = new Gauge('concurrent_users');
const errorRate = new Rate('error_rate');

// 병목 지점 파악용 메트릭
const bottleneckDetected = new Rate('bottleneck_detected');
const highLatencyRequests = new Counter('high_latency_requests');

// ============================================================================
// k6 Cloud Configuration - Stress Test
// ============================================================================
export const options = {
    // 점진적 부하 증가로 병목 지점 파악
    stages: [
        { duration: '2m', target: 50 },    // 워밍업
        { duration: '3m', target: 100 },   // 정상 부하
        { duration: '3m', target: 200 },   // 2배 부하
        { duration: '3m', target: 400 },   // 4배 부하
        { duration: '3m', target: 800 },   // 8배 부하 - 병목 예상
        { duration: '2m', target: 1000 },  // 최대 부하
        { duration: '2m', target: 0 },     // 스케일 다운
    ],
    
    // 성능 임계값 설정 (처리량, 지연시간)
    thresholds: {
        'http_req_duration': ['p(95)<5000', 'p(99)<10000'], // 95%는 5초, 99%는 10초 이내
        'http_req_failed': ['rate<0.1'],                     // 에러율 10% 미만
        'email_send_duration': ['p(95)<3000', 'p(99)<6000'], // 이메일 발송 지연시간
        'email_inbox_duration': ['p(95)<2000', 'p(99)<4000'], // 받은편지함 조회 지연시간
        'email_send_success_rate': ['rate>0.9'],             // 성공률 90% 이상
        'error_rate': ['rate<0.15'],                         // 전체 에러율 15% 미만
    },
    
    // k6 Cloud 설정
    ext: {
        loadimpact: {
            projectID: 6403215,
            name: 'CoreConnect - Email System Stress Test',
            distribution: {
                'amazon:kr:seoul': { loadZone: 'amazon:kr:seoul', percent: 100 }
            }
        }
    }
};

const BASE_URL = __ENV.BASE_URL || 'http://3.38.28.172:8080';

// ============================================================================
// Setup Phase
// ============================================================================
export function setup() {
    console.log('========================================');
    console.log('EMAIL SYSTEM STRESS TEST');
    console.log('========================================');
    console.log('Target: ' + BASE_URL);
    console.log('Max VUs: 1,000');
    console.log('Duration: 20 minutes');
    console.log('========================================');
    console.log('Test Scenarios:');
    console.log('  - Email Send Performance');
    console.log('  - Inbox Query Performance (N+1 check)');
    console.log('  - Email Detail Query');
    console.log('  - Concurrent Operations');
    console.log('========================================');
    
    return { 
        startTime: new Date().toISOString(),
        testType: 'EMAIL_STRESS_TEST'
    };
}

// ============================================================================
// Main Test Function
// ============================================================================
export default function () {
    const user = getTestUser(__VU);
    const iterationStart = Date.now();
    
    // 동시 사용자 수 기록
    concurrentUsers.add(__VU);
    
    // ========================================================================
    // 1. Login (인증)
    // ========================================================================
    const loginPayload = JSON.stringify({
        email: user.email,
        password: user.password
    });
    
    const loginParams = {
        headers: { 'Content-Type': 'application/json' },
        tags: { 
            name: 'Email_Login',
            stage: getLoadStage(__VU)
        }
    };
    
    const loginStart = Date.now();
    const loginResponse = http.post(BASE_URL + '/api/v1/auth/login', loginPayload, loginParams);
    const loginDuration = Date.now() - loginStart;
    
    const loginSuccess = check(loginResponse, {
        'login successful': (r) => r.status === 200,
    });
    
    if (!loginSuccess) {
        errorRate.add(1);
        console.error(`[VU ${__VU}] Login failed: ${loginResponse.status}`);
        return;
    }
    
    // JWT 토큰 추출
    let token = null;
    try {
        const loginData = loginResponse.json();
        token = loginData.data?.accessToken || loginResponse.cookies.access_token?.[0]?.value;
    } catch (e) {
        console.error(`[VU ${__VU}] Token extraction failed`);
        errorRate.add(1);
        return;
    }
    
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Cookie': `access_token=${token}`
    };
    
    // ========================================================================
    // 2. Email Inbox 조회 (받은편지함 - N+1 문제 체크)
    // ========================================================================
    const inboxStart = Date.now();
    const inboxResponse = http.get(
        `${BASE_URL}/api/v1/email/inbox?userEmail=${encodeURIComponent(user.email)}&page=0&size=20`,
        {
            headers: headers,
            tags: { 
                name: 'Email_Inbox_Query',
                stage: getLoadStage(__VU)
            }
        }
    );
    const inboxDuration = Date.now() - inboxStart;
    
    emailInboxDuration.add(inboxDuration);
    
    const inboxSuccess = check(inboxResponse, {
        'inbox query successful': (r) => r.status === 200,
        'inbox response time OK': (r) => inboxDuration < 5000,
    });
    
    if (inboxSuccess) {
        emailInboxSuccess.add(1);
        errorRate.add(0);
        throughputPerSecond.add(1);
        
        try {
            const inboxData = inboxResponse.json();
            const emailCount = inboxData.data?.content?.length || 0;
            emailInboxSize.add(emailCount);
            
            // 병목 지점 감지: 받은편지함 조회가 3초 이상 걸리면 병목
            if (inboxDuration > 3000) {
                bottleneckDetected.add(1);
                highLatencyRequests.add(1);
                console.warn(`[VU ${__VU}] [BOTTLENECK] Inbox query took ${inboxDuration}ms at stage ${getLoadStage(__VU)}`);
            }
            
            // N+1 문제 추정: 이메일 개수에 비례하여 시간이 증가하는지 체크
            if (emailCount > 0) {
                const avgTimePerEmail = inboxDuration / emailCount;
                dbQueryDuration.add(avgTimePerEmail);
                
                if (avgTimePerEmail > 150) { // 이메일당 150ms 이상이면 N+1 의심
                    console.warn(`[VU ${__VU}] [N+1 SUSPECTED] Average time per email: ${avgTimePerEmail.toFixed(2)}ms`);
                }
            }
        } catch (e) {
            console.error(`[VU ${__VU}] Inbox data parsing failed: ${e.message}`);
        }
    } else {
        emailInboxSuccess.add(0);
        errorRate.add(1);
        console.error(`[VU ${__VU}] Inbox query failed: ${inboxResponse.status}`);
    }
    
    // ========================================================================
    // 3. Email 상세 조회 (1개만)
    // ========================================================================
    if (inboxSuccess) {
        try {
            const inboxData = inboxResponse.json();
            const emails = inboxData.data?.content || [];
            
            if (emails.length > 0) {
                const randomEmail = emails[Math.floor(Math.random() * emails.length)];
                const emailId = randomEmail.emailId;
                
                const detailStart = Date.now();
                const detailResponse = http.get(
                    `${BASE_URL}/api/v1/email/${emailId}?userEmail=${encodeURIComponent(user.email)}`,
                    {
                        headers: headers,
                        tags: { 
                            name: 'Email_Detail_Query',
                            stage: getLoadStage(__VU)
                        }
                    }
                );
                const detailDuration = Date.now() - detailStart;
                
                emailDetailDuration.add(detailDuration);
                
                const detailSuccess = check(detailResponse, {
                    'email detail query successful': (r) => r.status === 200,
                });
                
                if (detailSuccess) {
                    emailDetailSuccess.add(1);
                    throughputPerSecond.add(1);
                } else {
                    emailDetailSuccess.add(0);
                    errorRate.add(1);
                }
            }
        } catch (e) {
            console.error(`[VU ${__VU}] Email detail query failed: ${e.message}`);
        }
    }
    
    // ========================================================================
    // 4. Email 발송 (20% 확률로 실행 - 실제 부하 시뮬레이션)
    // ========================================================================
    if (Math.random() < 0.2) {
        const recipientUser = getTestUser((__VU % 100) + 1); // 다른 사용자에게 발송
        
        const emailData = {
            recipientEmails: [recipientUser.email],
            subject: `[Load Test] Email from VU${__VU} at ${new Date().toISOString()}`,
            content: `This is a stress test email sent during load testing.\nStage: ${getLoadStage(__VU)}\nTimestamp: ${new Date().toISOString()}\n\nTest data: ${'x'.repeat(500)}`, // 500 chars
            priority: Math.random() > 0.8 ? 'HIGH' : 'NORMAL'
        };
        
        // FormData 생성 (multipart/form-data)
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
        const formData = `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="data"\r\n` +
            `Content-Type: application/json\r\n\r\n` +
            JSON.stringify(emailData) + `\r\n` +
            `--${boundary}--\r\n`;
        
        const sendStart = Date.now();
        const sendResponse = http.post(
            `${BASE_URL}/api/v1/email/send`,
            formData,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Cookie': `access_token=${token}`
                },
                tags: { 
                    name: 'Email_Send',
                    stage: getLoadStage(__VU)
                }
            }
        );
        const sendDuration = Date.now() - sendStart;
        
        emailSendDuration.add(sendDuration);
        
        const sendSuccess = check(sendResponse, {
            'email send successful': (r) => r.status === 200,
            'email send response time OK': (r) => sendDuration < 5000,
        });
        
        if (sendSuccess) {
            emailSendSuccess.add(1);
            throughputPerSecond.add(1);
            errorRate.add(0);
            
            // 병목 지점 감지: 이메일 발송이 3초 이상 걸리면 병목
            if (sendDuration > 3000) {
                bottleneckDetected.add(1);
                highLatencyRequests.add(1);
                console.warn(`[VU ${__VU}] [BOTTLENECK] Email send took ${sendDuration}ms at stage ${getLoadStage(__VU)}`);
            }
        } else {
            emailSendSuccess.add(0);
            emailSendErrors.add(1);
            errorRate.add(1);
            console.error(`[VU ${__VU}] Email send failed: ${sendResponse.status} - ${sendResponse.body}`);
        }
    }
    
    // ========================================================================
    // Think Time - 실제 사용자 행동 시뮬레이션
    // ========================================================================
    const thinkTime = getThinkTime(__VU);
    sleep(thinkTime);
}

// ============================================================================
// Helper Functions
// ============================================================================
function getLoadStage(vu) {
    if (vu <= 50) return 'WARMUP';
    if (vu <= 100) return 'NORMAL';
    if (vu <= 200) return 'LOAD_2X';
    if (vu <= 400) return 'LOAD_4X';
    if (vu <= 800) return 'LOAD_8X';
    if (vu <= 1000) return 'MAX_LOAD';
    return 'SCALE_DOWN';
}

function getThinkTime(vu) {
    // 부하가 높을수록 대기 시간 감소 (더 공격적인 테스트)
    if (vu <= 100) return 2 + Math.random() * 2;  // 2-4초
    if (vu <= 400) return 1 + Math.random();       // 1-2초
    return 0.5 + Math.random() * 0.5;              // 0.5-1초
}

// ============================================================================
// Teardown Phase - 결과 분석 및 리포팅
// ============================================================================
export function teardown(data) {
    console.log('');
    console.log('========================================');
    console.log('EMAIL SYSTEM STRESS TEST COMPLETED');
    console.log('========================================');
    console.log('Test Type: ' + data.testType);
    console.log('Start time: ' + data.startTime);
    console.log('End time: ' + new Date().toISOString());
    console.log('');
    console.log('📊 Check k6 Cloud Dashboard for:');
    console.log('  ✓ Email Send Throughput & Latency');
    console.log('  ✓ Inbox Query Performance (N+1 analysis)');
    console.log('  ✓ Email Detail Query Performance');
    console.log('  ✓ Bottleneck Identification');
    console.log('  ✓ Error Rate per Load Stage');
    console.log('  ✓ Database Query Duration Estimation');
    console.log('');
    console.log('🔍 Key Metrics to Analyze:');
    console.log('  - email_send_duration (p95, p99)');
    console.log('  - email_inbox_duration (p95, p99)');
    console.log('  - throughput_per_second');
    console.log('  - bottleneck_detected (high values = bottleneck)');
    console.log('  - db_query_duration (N+1 problem indicator)');
    console.log('========================================');
}
