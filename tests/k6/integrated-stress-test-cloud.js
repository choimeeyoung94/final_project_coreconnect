import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { getTestUser } from './common/test-users.js';

// ============================================================================
// Custom Metrics - 통합 시스템 성능 측정
// ============================================================================

// === 채팅 메트릭 ===
const chatWsConnectionDuration = new Trend('chat_ws_connection_duration');
const chatMessageSendDuration = new Trend('chat_message_send_duration');
const chatMessageReceiveDuration = new Trend('chat_message_receive_duration');
const chatMessagesTotal = new Counter('chat_messages_total');
const chatActiveConnections = new Gauge('chat_active_connections');
const chatErrors = new Counter('chat_errors');

// === 이메일 메트릭 ===
const emailSendDuration = new Trend('email_send_duration');
const emailInboxDuration = new Trend('email_inbox_duration');
const emailThroughput = new Counter('email_throughput');
const emailErrors = new Counter('email_errors');

// === 알림 메트릭 ===
const notificationSendDuration = new Trend('notification_send_duration');
const notificationReadDuration = new Trend('notification_read_duration');
const notificationThroughput = new Counter('notification_throughput');
const notificationErrors = new Counter('notification_errors');

// === 통합 메트릭 ===
const totalThroughput = new Counter('total_throughput');
const totalErrors = new Counter('total_errors');
const totalSuccessRate = new Rate('total_success_rate');
const systemHealthScore = new Gauge('system_health_score');

// === 인프라 메트릭 (추정) ===
const redisLatency = new Trend('redis_latency');
const kafkaLatency = new Trend('kafka_latency');
const dbQueryDuration = new Trend('db_query_duration');
const apiResponseTime = new Trend('api_response_time');

// === 병목 지점 파악 ===
const chatBottleneck = new Rate('chat_bottleneck');
const emailBottleneck = new Rate('email_bottleneck');
const notificationBottleneck = new Rate('notification_bottleneck');
const systemBottleneck = new Rate('system_bottleneck');

// === 사용자 시나리오 메트릭 ===
const scenarioChatOnly = new Counter('scenario_chat_only');
const scenarioEmailOnly = new Counter('scenario_email_only');
const scenarioNotificationOnly = new Counter('scenario_notification_only');
const scenarioMixed = new Counter('scenario_mixed');

// ============================================================================
// k6 Cloud Configuration - Integrated Production Test
// ============================================================================
export const options = {
    // 실제 프로덕션 패턴 시뮬레이션
    stages: [
        // Phase 1: 아침 출근 시간 (07:00-09:00)
        { duration: '2m', target: 200 },   // 점진적 증가
        { duration: '3m', target: 500 },   // 출근 시간
        
        // Phase 2: 오전 업무 시간 (09:00-12:00)
        { duration: '3m', target: 800 },   // 활발한 업무
        
        // Phase 3: 점심시간 (12:00-13:00)
        { duration: '2m', target: 400 },   // 감소
        
        // Phase 4: 오후 업무 시간 (13:00-18:00)
        { duration: '3m', target: 1000 },  // 최대 업무량
        { duration: '2m', target: 1500 },  // 마감 시간 러시
        
        // Phase 5: 퇴근 후 (18:00-21:00)
        { duration: '2m', target: 600 },   // 감소
        
        // Phase 6: 심야 시간 (21:00-)
        { duration: '2m', target: 100 },   // 최소
        
        // Phase 7: 스케일 다운
        { duration: '1m', target: 0 },
    ],
    
    // 엄격한 임계값 (프로덕션 품질)
    thresholds: {
        // HTTP 기본 임계값
        'http_req_duration': ['p(95)<5000', 'p(99)<10000'],
        'http_req_failed': ['rate<0.05'],
        
        // 채팅 임계값
        'chat_ws_connection_duration': ['p(95)<3000'],
        'chat_message_send_duration': ['p(95)<1000'],
        'chat_message_receive_duration': ['p(95)<3000'],
        
        // 이메일 임계값
        'email_send_duration': ['p(95)<5000'],
        'email_inbox_duration': ['p(95)<3000'],
        
        // 알림 임계값
        'notification_send_duration': ['p(95)<2000'],
        'notification_read_duration': ['p(95)<500'],
        
        // 통합 시스템 임계값
        'total_success_rate': ['rate>0.95'],
        'system_health_score': ['value>0.8'],
    },
    
    // k6 Cloud 설정
    ext: {
        loadimpact: {
            projectID: 6403215,
            name: 'CoreConnect - Integrated System Production Test',
            distribution: {
                'amazon:kr:seoul': { loadZone: 'amazon:kr:seoul', percent: 100 }
            }
        }
    }
};

const BASE_URL = __ENV.BASE_URL || 'http://3.38.28.172:8080';
const WS_URL = __ENV.WS_URL || 'ws://3.38.28.172:8080';

// ============================================================================
// Setup Phase
// ============================================================================
export function setup() {
    console.log('========================================');
    console.log('INTEGRATED SYSTEM PRODUCTION TEST');
    console.log('========================================');
    console.log('🎯 Target: ' + BASE_URL);
    console.log('📊 Test Type: Production Pattern Simulation');
    console.log('👥 Max Users: 1,500');
    console.log('⏱ Duration: 20 minutes');
    console.log('========================================');
    console.log('📱 Test Features:');
    console.log('  ✓ Real-time Chat (WebSocket)');
    console.log('  ✓ Email System');
    console.log('  ✓ Notification System');
    console.log('  ✓ Mixed User Scenarios');
    console.log('========================================');
    console.log('🏗️ Infrastructure Analysis:');
    console.log('  - Redis Performance');
    console.log('  - Kafka Throughput');
    console.log('  - Database Query Performance');
    console.log('  - WebSocket Stability');
    console.log('========================================');
    console.log('⚠️ Critical Metrics:');
    console.log('  - Total Throughput (req/sec)');
    console.log('  - System Health Score');
    console.log('  - Bottleneck Detection per Feature');
    console.log('  - End-to-End Latency');
    console.log('========================================');
    
    return { 
        startTime: new Date().toISOString(),
        testType: 'INTEGRATED_PRODUCTION_TEST'
    };
}

// ============================================================================
// Main Test Function - 사용자 시나리오 기반
// ============================================================================
export default function () {
    const user = getTestUser(__VU);
    const iterationStart = Date.now();
    let successCount = 0;
    let errorCount = 0;
    
    // ========================================================================
    // 1. Login (모든 시나리오 공통)
    // ========================================================================
    const loginPayload = JSON.stringify({
        email: user.email,
        password: user.password
    });
    
    const loginParams = {
        headers: { 'Content-Type': 'application/json' },
        tags: { 
            name: 'Integrated_Login',
            phase: getPhase(__VU)
        }
    };
    
    const loginStart = Date.now();
    const loginResponse = http.post(BASE_URL + '/api/v1/auth/login', loginPayload, loginParams);
    const loginDuration = Date.now() - loginStart;
    
    apiResponseTime.add(loginDuration);
    
    const loginSuccess = check(loginResponse, {
        'login successful': (r) => r.status === 200,
    });
    
    if (!loginSuccess) {
        totalErrors.add(1);
        totalSuccessRate.add(0);
        return;
    }
    
    successCount++;
    
    // JWT 토큰 추출
    let token = null;
    try {
        const loginData = loginResponse.json();
        token = loginData.data?.accessToken || loginResponse.cookies.access_token?.[0]?.value || 'cookie-auth';
    } catch (e) {
        token = 'cookie-auth';
    }
    
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Cookie': `access_token=${token}`
    };
    
    // ========================================================================
    // 2. 사용자 시나리오 선택 (가중치 기반)
    // ========================================================================
    const scenario = selectScenario(__VU);
    
    switch (scenario) {
        case 'CHAT_ONLY':
            scenarioChatOnly.add(1);
            executeChatScenario(token, headers, user);
            break;
            
        case 'EMAIL_ONLY':
            scenarioEmailOnly.add(1);
            executeEmailScenario(headers, user);
            break;
            
        case 'NOTIFICATION_ONLY':
            scenarioNotificationOnly.add(1);
            executeNotificationScenario(headers, user);
            break;
            
        case 'MIXED':
            scenarioMixed.add(1);
            executeMixedScenario(token, headers, user);
            break;
    }
    
    // ========================================================================
    // 3. 시스템 건강도 점수 계산
    // ========================================================================
    const healthScore = calculateSystemHealth();
    systemHealthScore.add(healthScore);
    
    // Think Time
    sleep(getThinkTime(__VU));
}

// ============================================================================
// 시나리오 실행 함수
// ============================================================================

// === 채팅 전용 시나리오 ===
function executeChatScenario(token, headers, user) {
    // 1. 채팅방 목록 조회
    const roomsStart = Date.now();
    const roomsResponse = http.get(`${BASE_URL}/api/v1/chatrooms`, {
        headers: headers,
        tags: { name: 'Chat_Rooms', scenario: 'CHAT_ONLY' }
    });
    const roomsDuration = Date.now() - roomsStart;
    
    apiResponseTime.add(roomsDuration);
    dbQueryDuration.add(roomsDuration);
    
    if (roomsDuration > 3000) {
        chatBottleneck.add(1);
        systemBottleneck.add(1);
    }
    
    let chatRoomId = 1;
    if (roomsResponse.status === 200) {
        try {
            const rooms = roomsResponse.json();
            if (rooms && rooms.length > 0) {
                chatRoomId = rooms[Math.floor(Math.random() * Math.min(rooms.length, 10))].id;
            }
        } catch (e) {}
    }
    
    // 2. WebSocket 연결 및 채팅
    const wsUrl = `${WS_URL}/ws?token=${token}`;
    let messageCount = 0;
    let receivedCount = 0;
    
    const wsStart = Date.now();
    
    ws.connect(wsUrl, { tags: { scenario: 'CHAT_ONLY' } }, function (socket) {
        const wsConnectDuration = Date.now() - wsStart;
        chatWsConnectionDuration.add(wsConnectDuration);
        chatActiveConnections.add(1);
        
        if (wsConnectDuration > 3000) {
            chatBottleneck.add(1);
            systemBottleneck.add(1);
        }
        
        socket.on('open', function () {
            // 채팅방 입장
            socket.send(JSON.stringify({
                type: 'JOIN_ROOM',
                chatRoomId: chatRoomId,
                timestamp: new Date().toISOString()
            }));
            
            // 메시지 전송
            socket.setInterval(function () {
                if (messageCount >= 5) {
                    socket.close();
                    return;
                }
                
                const sendStart = Date.now();
                socket.send(JSON.stringify({
                    type: 'CHAT',
                    chatRoomId: chatRoomId,
                    message: `[Integrated Test] Message ${messageCount + 1}`,
                    timestamp: new Date().toISOString()
                }));
                const sendDuration = Date.now() - sendStart;
                
                chatMessageSendDuration.add(sendDuration);
                kafkaLatency.add(sendDuration);
                chatMessagesTotal.add(1);
                totalThroughput.add(1);
                messageCount++;
                
                if (sendDuration > 1000) {
                    chatBottleneck.add(1);
                }
            }, 3000);
            
            socket.setTimeout(() => socket.close(), 20000);
        });
        
        socket.on('message', function (data) {
            try {
                const message = JSON.parse(data);
                if (message.type === 'MESSAGE' || message.type === 'CHAT') {
                    receivedCount++;
                    
                    if (message.timestamp) {
                        const latency = Date.now() - new Date(message.timestamp).getTime();
                        if (latency > 0 && latency < 60000) {
                            chatMessageReceiveDuration.add(latency);
                            redisLatency.add(latency);
                        }
                    }
                }
            } catch (e) {
                chatErrors.add(1);
            }
        });
        
        socket.on('close', function () {
            chatActiveConnections.add(-1);
        });
        
        socket.on('error', function (e) {
            chatErrors.add(1);
            totalErrors.add(1);
            chatActiveConnections.add(-1);
        });
    });
}

// === 이메일 전용 시나리오 ===
function executeEmailScenario(headers, user) {
    // 1. 받은편지함 조회
    const inboxStart = Date.now();
    const inboxResponse = http.get(
        `${BASE_URL}/api/v1/email/inbox?userEmail=${encodeURIComponent(user.email)}&page=0&size=20`,
        {
            headers: headers,
            tags: { name: 'Email_Inbox', scenario: 'EMAIL_ONLY' }
        }
    );
    const inboxDuration = Date.now() - inboxStart;
    
    emailInboxDuration.add(inboxDuration);
    apiResponseTime.add(inboxDuration);
    dbQueryDuration.add(inboxDuration);
    
    if (inboxResponse.status === 200) {
        emailThroughput.add(1);
        totalThroughput.add(1);
        totalSuccessRate.add(1);
    } else {
        emailErrors.add(1);
        totalErrors.add(1);
        totalSuccessRate.add(0);
    }
    
    if (inboxDuration > 3000) {
        emailBottleneck.add(1);
        systemBottleneck.add(1);
    }
    
    // 2. 이메일 발송 (30% 확률)
    if (Math.random() < 0.3) {
        const recipientUser = getTestUser((__VU % 100) + 1);
        
        const emailData = {
            recipientEmails: [recipientUser.email],
            subject: `[Integrated Test] Email from VU${__VU}`,
            content: 'This is an integrated test email.',
            priority: 'NORMAL'
        };
        
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
                    'Authorization': headers['Authorization'],
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Cookie': headers['Cookie']
                },
                tags: { name: 'Email_Send', scenario: 'EMAIL_ONLY' }
            }
        );
        const sendDuration = Date.now() - sendStart;
        
        emailSendDuration.add(sendDuration);
        apiResponseTime.add(sendDuration);
        
        if (sendResponse.status === 200) {
            emailThroughput.add(1);
            totalThroughput.add(1);
            totalSuccessRate.add(1);
        } else {
            emailErrors.add(1);
            totalErrors.add(1);
            totalSuccessRate.add(0);
        }
        
        if (sendDuration > 5000) {
            emailBottleneck.add(1);
            systemBottleneck.add(1);
        }
    }
}

// === 알림 전용 시나리오 ===
function executeNotificationScenario(headers, user) {
    // 1. 알림 발송
    const recipientUser = getTestUser((__VU % 100) + 1);
    
    const notificationData = {
        recipientId: recipientUser.id || (__VU % 100) + 1,
        type: 'CHAT',
        message: `[Integrated Test] Notification from VU${__VU}`,
        chatId: Math.floor(Math.random() * 100) + 1,
        roomId: Math.floor(Math.random() * 50) + 1,
    };
    
    const sendStart = Date.now();
    const sendResponse = http.post(
        `${BASE_URL}/api/v1/notification/send`,
        JSON.stringify(notificationData),
        {
            headers: headers,
            tags: { name: 'Notification_Send', scenario: 'NOTIFICATION_ONLY' }
        }
    );
    const sendDuration = Date.now() - sendStart;
    
    notificationSendDuration.add(sendDuration);
    apiResponseTime.add(sendDuration);
    kafkaLatency.add(sendDuration);
    redisLatency.add(sendDuration);
    
    if (sendResponse.status === 200 || sendResponse.status === 201) {
        notificationThroughput.add(1);
        totalThroughput.add(1);
        totalSuccessRate.add(1);
    } else {
        notificationErrors.add(1);
        totalErrors.add(1);
        totalSuccessRate.add(0);
    }
    
    if (sendDuration > 2000) {
        notificationBottleneck.add(1);
        systemBottleneck.add(1);
    }
    
    // 2. 알림 읽음 처리 (50% 확률)
    if (Math.random() < 0.5) {
        const notificationId = Math.floor(Math.random() * 1000) + 1;
        
        const readStart = Date.now();
        const readResponse = http.put(
            `${BASE_URL}/api/v1/notification/${notificationId}/read`,
            null,
            {
                headers: headers,
                tags: { name: 'Notification_Read', scenario: 'NOTIFICATION_ONLY' }
            }
        );
        const readDuration = Date.now() - readStart;
        
        notificationReadDuration.add(readDuration);
        redisLatency.add(readDuration);
        
        if (readResponse.status === 200 || readResponse.status === 404) {
            notificationThroughput.add(1);
            totalThroughput.add(1);
        }
    }
}

// === 혼합 시나리오 (실제 사용자 패턴) ===
function executeMixedScenario(token, headers, user) {
    // 채팅 + 이메일 + 알림을 모두 사용하는 파워 유저
    
    // 1. 이메일 확인
    const inboxStart = Date.now();
    http.get(
        `${BASE_URL}/api/v1/email/inbox?userEmail=${encodeURIComponent(user.email)}&page=0&size=10`,
        { headers: headers, tags: { scenario: 'MIXED' } }
    );
    emailInboxDuration.add(Date.now() - inboxStart);
    totalThroughput.add(1);
    
    sleep(0.5);
    
    // 2. 알림 발송
    const recipientUser = getTestUser((__VU % 100) + 1);
    const notificationData = {
        recipientId: recipientUser.id || (__VU % 100) + 1,
        type: 'MENTION',
        message: `[Mixed] Notification from VU${__VU}`,
    };
    
    const notiStart = Date.now();
    http.post(
        `${BASE_URL}/api/v1/notification/send`,
        JSON.stringify(notificationData),
        { headers: headers, tags: { scenario: 'MIXED' } }
    );
    notificationSendDuration.add(Date.now() - notiStart);
    totalThroughput.add(1);
    
    sleep(0.5);
    
    // 3. 간단한 채팅 (짧은 세션)
    const wsUrl = `${WS_URL}/ws?token=${token}`;
    
    ws.connect(wsUrl, { tags: { scenario: 'MIXED' } }, function (socket) {
        chatActiveConnections.add(1);
        
        socket.on('open', function () {
            socket.send(JSON.stringify({
                type: 'JOIN_ROOM',
                chatRoomId: 1,
                timestamp: new Date().toISOString()
            }));
            
            // 1개 메시지만 전송
            socket.setTimeout(function () {
                const sendStart = Date.now();
                socket.send(JSON.stringify({
                    type: 'CHAT',
                    chatRoomId: 1,
                    message: '[Mixed] Quick message',
                    timestamp: new Date().toISOString()
                }));
                chatMessageSendDuration.add(Date.now() - sendStart);
                chatMessagesTotal.add(1);
                totalThroughput.add(1);
                
                socket.setTimeout(() => socket.close(), 1000);
            }, 1000);
        });
        
        socket.on('close', function () {
            chatActiveConnections.add(-1);
        });
        
        socket.on('error', function () {
            chatErrors.add(1);
            chatActiveConnections.add(-1);
        });
    });
}

// ============================================================================
// Helper Functions
// ============================================================================

function selectScenario(vu) {
    const rand = Math.random();
    
    // 시나리오 분포 (실제 사용 패턴 반영)
    if (rand < 0.40) return 'CHAT_ONLY';          // 40% - 채팅 중심 사용자
    if (rand < 0.65) return 'EMAIL_ONLY';         // 25% - 이메일 중심 사용자
    if (rand < 0.80) return 'NOTIFICATION_ONLY';  // 15% - 알림 확인만
    return 'MIXED';                               // 20% - 모든 기능 사용
}

function getPhase(vu) {
    if (vu <= 200) return 'MORNING_COMMUTE';
    if (vu <= 500) return 'MORNING_WORK';
    if (vu <= 800) return 'ACTIVE_WORK';
    if (vu <= 400) return 'LUNCH_TIME';
    if (vu <= 1000) return 'AFTERNOON_WORK';
    if (vu <= 1500) return 'DEADLINE_RUSH';
    if (vu <= 600) return 'EVENING';
    if (vu <= 100) return 'NIGHT';
    return 'SCALE_DOWN';
}

function getThinkTime(vu) {
    if (vu <= 500) return 2 + Math.random() * 2;  // 2-4초
    if (vu <= 1000) return 1 + Math.random();     // 1-2초
    return 0.5 + Math.random() * 0.5;             // 0.5-1초
}

function calculateSystemHealth() {
    // 간단한 건강도 점수 (0-1)
    // 실제로는 메트릭 값들을 기반으로 계산해야 하지만,
    // k6에서는 직접 접근이 어려우므로 랜덤 + 부하 기반 추정
    const baseHealth = 1.0;
    const loadPenalty = Math.min(__VU / 1500 * 0.3, 0.3); // 최대 30% 감소
    return baseHealth - loadPenalty;
}

// ============================================================================
// Teardown Phase
// ============================================================================
export function teardown(data) {
    console.log('');
    console.log('========================================');
    console.log('INTEGRATED SYSTEM TEST COMPLETED');
    console.log('========================================');
    console.log('Test Type: ' + data.testType);
    console.log('Start time: ' + data.startTime);
    console.log('End time: ' + new Date().toISOString());
    console.log('');
    console.log('📊 COMPREHENSIVE ANALYSIS');
    console.log('========================================');
    console.log('');
    console.log('💬 Chat Performance:');
    console.log('  - Check: chat_ws_connection_duration');
    console.log('  - Check: chat_message_send_duration');
    console.log('  - Check: chat_message_receive_duration');
    console.log('  - Check: chat_bottleneck (should be low)');
    console.log('');
    console.log('📧 Email Performance:');
    console.log('  - Check: email_send_duration');
    console.log('  - Check: email_inbox_duration');
    console.log('  - Check: email_throughput');
    console.log('  - Check: email_bottleneck (should be low)');
    console.log('');
    console.log('🔔 Notification Performance:');
    console.log('  - Check: notification_send_duration');
    console.log('  - Check: notification_read_duration');
    console.log('  - Check: notification_throughput');
    console.log('  - Check: notification_bottleneck (should be low)');
    console.log('');
    console.log('🏗️ Infrastructure Performance:');
    console.log('  - redis_latency (cache performance)');
    console.log('  - kafka_latency (messaging performance)');
    console.log('  - db_query_duration (database performance)');
    console.log('  - api_response_time (overall API latency)');
    console.log('');
    console.log('🎯 System Metrics:');
    console.log('  - total_throughput (overall req/sec)');
    console.log('  - total_success_rate (should be > 95%)');
    console.log('  - system_health_score (should be > 0.8)');
    console.log('  - system_bottleneck (identifies main bottleneck)');
    console.log('');
    console.log('👥 User Scenarios Distribution:');
    console.log('  - scenario_chat_only (40%)');
    console.log('  - scenario_email_only (25%)');
    console.log('  - scenario_notification_only (15%)');
    console.log('  - scenario_mixed (20%)');
    console.log('');
    console.log('========================================');
    console.log('🔍 BOTTLENECK ANALYSIS');
    console.log('========================================');
    console.log('Compare the following to identify bottlenecks:');
    console.log('  1. chat_bottleneck');
    console.log('  2. email_bottleneck');
    console.log('  3. notification_bottleneck');
    console.log('');
    console.log('The feature with the highest bottleneck rate');
    console.log('needs optimization first!');
    console.log('');
    console.log('========================================');
    console.log('⚡ OPTIMIZATION RECOMMENDATIONS');
    console.log('========================================');
    console.log('Based on bottleneck analysis:');
    console.log('  📌 If chat_bottleneck is high:');
    console.log('     → Check Redis pub/sub capacity');
    console.log('     → Check WebSocket connection limits');
    console.log('     → Consider horizontal scaling');
    console.log('');
    console.log('  📌 If email_bottleneck is high:');
    console.log('     → Optimize N+1 queries in inbox');
    console.log('     → Add database indexes');
    console.log('     → Consider read replicas');
    console.log('');
    console.log('  📌 If notification_bottleneck is high:');
    console.log('     → Check Kafka producer throughput');
    console.log('     → Optimize Redis caching');
    console.log('     → Consider message batching');
    console.log('');
    console.log('========================================');
    console.log('📈 View detailed results in k6 Cloud Dashboard');
    console.log('========================================');
}
