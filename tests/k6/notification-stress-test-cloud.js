import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { getTestUser } from './common/test-users.js';

// ============================================================================
// Custom Metrics - 알림 시스템 성능 측정
// ============================================================================
const notificationSendDuration = new Trend('notification_send_duration');
const notificationSendSuccess = new Rate('notification_send_success_rate');
const notificationSendErrors = new Counter('notification_send_errors');

const notificationReadDuration = new Trend('notification_read_duration');
const notificationReadSuccess = new Rate('notification_read_success_rate');

const notificationBurstHandling = new Trend('notification_burst_handling');
const notificationThroughput = new Counter('notification_throughput');
const concurrentNotifications = new Gauge('concurrent_notifications');

// Kafka/Redis 성능 추정 메트릭
const messagingLayerLatency = new Trend('messaging_layer_latency');
const cacheHitRate = new Rate('cache_hit_rate');
const queueDepth = new Gauge('queue_depth_estimate');

// 병목 지점 파악
const bottleneckDetected = new Rate('bottleneck_detected');
const highLatencyNotifications = new Counter('high_latency_notifications');
const errorRate = new Rate('error_rate');

// ============================================================================
// k6 Cloud Configuration - Notification Burst Test
// ============================================================================
export const options = {
    // 알림 시스템은 버스트(급격한 증가)에 강해야 함
    stages: [
        { duration: '1m', target: 50 },    // 워밍업
        { duration: '2m', target: 200 },   // 정상 부하
        { duration: '1m', target: 1000 },  // 급격한 증가 (Spike) - 알림 버스트 시뮬레이션
        { duration: '2m', target: 1000 },  // 버스트 유지
        { duration: '1m', target: 200 },   // 안정화
        { duration: '2m', target: 500 },   // 2차 부하
        { duration: '1m', target: 1500 },  // 최대 버스트
        { duration: '2m', target: 0 },     // 스케일 다운
    ],
    
    // 알림 시스템 특성상 높은 처리량과 낮은 지연시간이 중요
    thresholds: {
        'http_req_duration': ['p(95)<3000', 'p(99)<5000'],   // 알림은 빠르게 처리되어야 함
        'http_req_failed': ['rate<0.05'],                     // 에러율 5% 미만
        'notification_send_duration': ['p(95)<2000', 'p(99)<4000'], // 알림 발송 2초 이내
        'notification_read_duration': ['p(95)<500', 'p(99)<1000'],  // 읽음 처리 1초 이내
        'notification_send_success_rate': ['rate>0.95'],      // 성공률 95% 이상
        'error_rate': ['rate<0.1'],                           // 전체 에러율 10% 미만
    },
    
    // k6 Cloud 설정
    ext: {
        loadimpact: {
            projectID: 6403215,
            name: 'CoreConnect - Notification System Burst Test',
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
    console.log('NOTIFICATION SYSTEM BURST TEST');
    console.log('========================================');
    console.log('Target: ' + BASE_URL);
    console.log('Max VUs: 1,500 (Burst Simulation)');
    console.log('Duration: 12 minutes');
    console.log('========================================');
    console.log('Test Scenarios:');
    console.log('  - Notification Send Performance');
    console.log('  - Notification Read Performance');
    console.log('  - Burst Handling (1000+ concurrent)');
    console.log('  - Kafka/Redis Performance Analysis');
    console.log('========================================');
    console.log('Expected Bottlenecks:');
    console.log('  ⚠ Kafka Producer throughput');
    console.log('  ⚠ Redis pub/sub capacity');
    console.log('  ⚠ Database write contention');
    console.log('========================================');
    
    return { 
        startTime: new Date().toISOString(),
        testType: 'NOTIFICATION_BURST_TEST'
    };
}

// ============================================================================
// Main Test Function
// ============================================================================
export default function () {
    const user = getTestUser(__VU);
    const iterationStart = Date.now();
    
    // 동시 알림 수 기록
    concurrentNotifications.add(__VU);
    
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
            name: 'Notification_Login',
            stage: getBurstStage(__VU, __ITER)
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
    // 2. Notification 발송 (70% 확률 - 버스트 시뮬레이션)
    // ========================================================================
    if (Math.random() < 0.7) {
        const recipientUser = getTestUser((__VU % 100) + 1);
        
        // 다양한 알림 타입 시뮬레이션
        const notificationTypes = ['CHAT', 'EMAIL', 'APPROVAL', 'SCHEDULE', 'MENTION'];
        const notificationType = notificationTypes[Math.floor(Math.random() * notificationTypes.length)];
        
        const notificationData = {
            recipientId: recipientUser.id || (__VU % 100) + 1,
            type: notificationType,
            message: `[${notificationType}] Notification from VU${__VU} at ${new Date().toISOString()}`,
            chatId: notificationType === 'CHAT' ? Math.floor(Math.random() * 100) + 1 : null,
            roomId: notificationType === 'CHAT' ? Math.floor(Math.random() * 50) + 1 : null,
        };
        
        const sendStart = Date.now();
        const sendResponse = http.post(
            `${BASE_URL}/api/v1/notification/send`,
            JSON.stringify(notificationData),
            {
                headers: headers,
                tags: { 
                    name: 'Notification_Send',
                    stage: getBurstStage(__VU, __ITER),
                    type: notificationType
                }
            }
        );
        const sendDuration = Date.now() - sendStart;
        
        notificationSendDuration.add(sendDuration);
        messagingLayerLatency.add(sendDuration); // Kafka/Redis 레이턴시 추정
        
        const sendSuccess = check(sendResponse, {
            'notification send successful': (r) => r.status === 200 || r.status === 201,
            'notification send response time OK': (r) => sendDuration < 3000,
        });
        
        if (sendSuccess) {
            notificationSendSuccess.add(1);
            notificationThroughput.add(1);
            errorRate.add(0);
            
            // 병목 지점 감지: 알림 발송이 2초 이상 걸리면 병목
            if (sendDuration > 2000) {
                bottleneckDetected.add(1);
                highLatencyNotifications.add(1);
                console.warn(`[VU ${__VU}] [BOTTLENECK] Notification send took ${sendDuration}ms at stage ${getBurstStage(__VU, __ITER)}`);
                
                // Kafka/Redis 병목 추정
                if (sendDuration > 3000) {
                    console.error(`[VU ${__VU}] [CRITICAL] Possible Kafka/Redis bottleneck: ${sendDuration}ms`);
                }
            }
            
            // 버스트 처리 성능 측정
            if (__VU > 800) {
                notificationBurstHandling.add(sendDuration);
                queueDepth.add(__VU); // 큐 깊이 추정
            }
        } else {
            notificationSendSuccess.add(0);
            notificationSendErrors.add(1);
            errorRate.add(1);
            console.error(`[VU ${__VU}] Notification send failed: ${sendResponse.status} - ${sendResponse.body}`);
        }
    }
    
    // ========================================================================
    // 3. Notification 읽음 처리 (30% 확률)
    // ========================================================================
    if (Math.random() < 0.3) {
        // 임의의 알림 ID로 읽음 처리 (실제로는 먼저 조회 후 읽음 처리해야 함)
        const notificationId = Math.floor(Math.random() * 1000) + 1;
        
        const readStart = Date.now();
        const readResponse = http.put(
            `${BASE_URL}/api/v1/notification/${notificationId}/read`,
            null,
            {
                headers: headers,
                tags: { 
                    name: 'Notification_Read',
                    stage: getBurstStage(__VU, __ITER)
                }
            }
        );
        const readDuration = Date.now() - readStart;
        
        notificationReadDuration.add(readDuration);
        
        const readSuccess = check(readResponse, {
            'notification read successful': (r) => r.status === 200 || r.status === 404, // 404도 정상 (알림이 없을 수 있음)
            'notification read response time OK': (r) => readDuration < 1000,
        });
        
        if (readSuccess) {
            notificationReadSuccess.add(1);
            notificationThroughput.add(1);
            
            // Redis 캐시 히트율 추정 (빠른 응답 = 캐시 히트)
            if (readDuration < 200) {
                cacheHitRate.add(1); // 캐시 히트
            } else {
                cacheHitRate.add(0); // 캐시 미스 (DB 조회)
            }
        } else {
            notificationReadSuccess.add(0);
            errorRate.add(1);
        }
    }
    
    // ========================================================================
    // 4. 버스트 시뮬레이션 - 높은 부하에서는 연속 발송
    // ========================================================================
    if (__VU > 1000) {
        // 최대 부하에서는 짧은 간격으로 여러 알림 발송
        for (let i = 0; i < 3; i++) {
            const burstRecipient = getTestUser(((__VU + i) % 100) + 1);
            
            const burstData = {
                recipientId: burstRecipient.id || ((__VU + i) % 100) + 1,
                type: 'CHAT',
                message: `[BURST] Rapid notification ${i+1}/3 from VU${__VU}`,
                chatId: Math.floor(Math.random() * 100) + 1,
                roomId: Math.floor(Math.random() * 50) + 1,
            };
            
            const burstStart = Date.now();
            const burstResponse = http.post(
                `${BASE_URL}/api/v1/notification/send`,
                JSON.stringify(burstData),
                {
                    headers: headers,
                    tags: { 
                        name: 'Notification_Burst',
                        stage: 'MAX_BURST'
                    }
                }
            );
            const burstDuration = Date.now() - burstStart;
            
            notificationBurstHandling.add(burstDuration);
            notificationThroughput.add(1);
            
            // 버스트 중 병목 감지
            if (burstDuration > 2000) {
                bottleneckDetected.add(1);
                console.error(`[VU ${__VU}] [BURST BOTTLENECK] Burst notification ${i+1} took ${burstDuration}ms`);
            }
            
            sleep(0.1); // 100ms 간격으로 발송
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
function getBurstStage(vu, iter) {
    if (vu <= 50) return 'WARMUP';
    if (vu <= 200) return 'NORMAL';
    if (vu <= 1000 && iter < 60) return 'BURST_1000'; // 첫 버스트
    if (vu <= 500) return 'STABILIZE';
    if (vu <= 1000) return 'LOAD_2';
    if (vu <= 1500) return 'MAX_BURST_1500';
    return 'SCALE_DOWN';
}

function getThinkTime(vu) {
    // 알림은 실시간 특성상 대기 시간이 매우 짧음
    if (vu <= 200) return 1 + Math.random();       // 1-2초
    if (vu <= 1000) return 0.5 + Math.random() * 0.5; // 0.5-1초
    return 0.2 + Math.random() * 0.3;              // 0.2-0.5초 (버스트)
}

// ============================================================================
// Teardown Phase - 결과 분석 및 리포팅
// ============================================================================
export function teardown(data) {
    console.log('');
    console.log('========================================');
    console.log('NOTIFICATION SYSTEM BURST TEST COMPLETED');
    console.log('========================================');
    console.log('Test Type: ' + data.testType);
    console.log('Start time: ' + data.startTime);
    console.log('End time: ' + new Date().toISOString());
    console.log('');
    console.log('📊 Check k6 Cloud Dashboard for:');
    console.log('  ✓ Notification Send Throughput');
    console.log('  ✓ Burst Handling Capacity');
    console.log('  ✓ Kafka/Redis Performance');
    console.log('  ✓ Cache Hit Rate');
    console.log('  ✓ Queue Depth Estimation');
    console.log('  ✓ Bottleneck Identification');
    console.log('');
    console.log('🔍 Key Metrics to Analyze:');
    console.log('  - notification_send_duration (p95, p99)');
    console.log('  - notification_burst_handling (spike performance)');
    console.log('  - messaging_layer_latency (Kafka/Redis latency)');
    console.log('  - cache_hit_rate (Redis caching effectiveness)');
    console.log('  - bottleneck_detected (high values = bottleneck)');
    console.log('  - notification_throughput (requests/sec)');
    console.log('');
    console.log('⚡ Performance Targets:');
    console.log('  - Send latency p95 < 2s');
    console.log('  - Read latency p95 < 500ms');
    console.log('  - Throughput > 100 notifications/sec');
    console.log('  - Cache hit rate > 70%');
    console.log('========================================');
}
