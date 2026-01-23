import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { getTestUser } from './common/test-users.js';

// ============================================================================
// Custom Metrics - 채팅 시스템 고급 성능 측정
// ============================================================================
// WebSocket 연결 메트릭
const wsConnectionDuration = new Trend('ws_connection_duration');
const wsConnectionSuccess = new Rate('ws_connection_success_rate');
const wsConnectionErrors = new Counter('ws_connection_errors');
const activeConnections = new Gauge('active_connections');

// 메시지 전송/수신 메트릭
const messageSendDuration = new Trend('message_send_duration');
const messageReceiveDuration = new Trend('message_receive_duration');
const messagesSent = new Counter('messages_sent');
const messagesReceived = new Counter('messages_received');
const messageLossRate = new Rate('message_loss_rate');

// 채팅방 메트릭
const chatRoomJoinDuration = new Trend('chatroom_join_duration');
const chatRoomLoadDuration = new Trend('chatroom_load_duration');
const chatRoomListSize = new Trend('chatroom_list_size');

// 처리량 메트릭
const messagesPerSecond = new Counter('messages_per_second');
const throughput = new Gauge('current_throughput');

// Redis/Kafka 성능 추정
const messagingLatency = new Trend('messaging_latency');
const redisOperationDuration = new Trend('redis_operation_duration');
const kafkaPublishDuration = new Trend('kafka_publish_duration');

// 병목 지점 파악
const bottleneckDetected = new Rate('bottleneck_detected');
const highLatencyMessages = new Counter('high_latency_messages');
const connectionDropRate = new Rate('connection_drop_rate');
const errorRate = new Rate('error_rate');

// ============================================================================
// k6 Cloud Configuration - Enhanced Chat Stress Test
// ============================================================================
export const options = {
    // 실제 채팅 서비스 패턴: 점진적 증가 + 피크 타임 시뮬레이션
    stages: [
        { duration: '2m', target: 100 },   // 오전 워밍업
        { duration: '3m', target: 300 },   // 정상 부하
        { duration: '2m', target: 800 },   // 점심시간 피크
        { duration: '3m', target: 500 },   // 안정화
        { duration: '2m', target: 1200 },  // 최대 피크 (저녁)
        { duration: '3m', target: 1500 },  // 극한 부하
        { duration: '3m', target: 300 },   // 심야 시간
        { duration: '2m', target: 0 },     // 스케일 다운
    ],
    
    // 채팅 시스템 임계값 (실시간성이 중요)
    thresholds: {
        'http_req_duration': ['p(95)<3000', 'p(99)<5000'],
        'http_req_failed': ['rate<0.05'],
        'ws_connection_duration': ['p(95)<2000', 'p(99)<4000'],
        'ws_connection_success_rate': ['rate>0.95'],
        'message_send_duration': ['p(95)<1000', 'p(99)<2000'], // 메시지는 1초 이내
        'message_receive_duration': ['p(95)<2000', 'p(99)<4000'], // 수신은 2초 이내
        'message_loss_rate': ['rate<0.01'], // 메시지 손실률 1% 미만
        'connection_drop_rate': ['rate<0.05'], // 연결 끊김 5% 미만
        'error_rate': ['rate<0.1'],
    },
    
    // k6 Cloud 설정
    ext: {
        loadimpact: {
            projectID: 6403215,
            name: 'CoreConnect - Enhanced Chat System Stress Test',
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
    console.log('ENHANCED CHAT SYSTEM STRESS TEST');
    console.log('========================================');
    console.log('API Server: ' + BASE_URL);
    console.log('WebSocket: ' + WS_URL);
    console.log('Max VUs: 1,500');
    console.log('Duration: 20 minutes');
    console.log('========================================');
    console.log('Test Scenarios:');
    console.log('  - WebSocket Connection Stability');
    console.log('  - Message Send/Receive Performance');
    console.log('  - Chat Room Join/Load Performance');
    console.log('  - Peak Hour Simulation');
    console.log('  - Redis/Kafka Performance Analysis');
    console.log('========================================');
    console.log('Expected Bottlenecks:');
    console.log('  ⚠ WebSocket connection limit');
    console.log('  ⚠ Redis pub/sub capacity');
    console.log('  ⚠ Kafka throughput');
    console.log('  ⚠ Database connection pool');
    console.log('========================================');
    
    return { 
        startTime: new Date().toISOString(),
        testType: 'CHAT_ENHANCED_STRESS_TEST'
    };
}

// ============================================================================
// Main Test Function
// ============================================================================
export default function () {
    const user = getTestUser(__VU);
    const iterationStart = Date.now();
    
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
            name: 'Chat_Login',
            stage: getPeakStage(__VU)
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
        
        if (!token) {
            token = 'cookie-auth'; // Fallback
        }
    } catch (e) {
        token = 'cookie-auth';
    }
    
    // ========================================================================
    // 2. 채팅방 목록 조회 (N+1 문제 체크)
    // ========================================================================
    const roomsStart = Date.now();
    const roomsResponse = http.get(BASE_URL + '/api/v1/chatrooms', {
        headers: { 
            'Authorization': `Bearer ${token}`,
            'Cookie': `access_token=${token}`
        },
        tags: { 
            name: 'Chat_RoomList',
            stage: getPeakStage(__VU)
        }
    });
    const roomsDuration = Date.now() - roomsStart;
    
    chatRoomLoadDuration.add(roomsDuration);
    
    // N+1 문제 감지
    if (roomsDuration > 2000) {
        bottleneckDetected.add(1);
        console.warn(`[VU ${__VU}] [N+1 SUSPECTED] Chat room list took ${roomsDuration}ms`);
    }
    
    let chatRoomId = 1;
    let roomCount = 0;
    
    if (roomsResponse.status === 200) {
        try {
            const rooms = roomsResponse.json();
            if (rooms && rooms.length > 0) {
                roomCount = rooms.length;
                chatRoomListSize.add(roomCount);
                
                // 랜덤 채팅방 선택
                chatRoomId = rooms[Math.floor(Math.random() * Math.min(rooms.length, 20))].id;
                
                // Redis 캐싱 효과 추정
                if (roomsDuration < 500) {
                    redisOperationDuration.add(roomsDuration);
                }
            }
        } catch (e) {
            console.warn(`[VU ${__VU}] Failed to parse rooms: ${e.message}`);
        }
    }
    
    // ========================================================================
    // 3. WebSocket 연결 및 채팅
    // ========================================================================
    const wsUrl = `${WS_URL}/ws?token=${token}`;
    
    const wsParams = {
        tags: { 
            name: 'WebSocket_Connection',
            stage: getPeakStage(__VU)
        }
    };
    
    let messageCount = 0;
    let receivedCount = 0;
    let connectionSuccess = false;
    const messageSendTimes = new Map(); // 메시지 ID -> 전송 시간
    
    const wsStart = Date.now();
    
    const res = ws.connect(wsUrl, wsParams, function (socket) {
        const wsConnectDuration = Date.now() - wsStart;
        wsConnectionDuration.add(wsConnectDuration);
        wsConnectionSuccess.add(1);
        activeConnections.add(1);
        connectionSuccess = true;
        
        // WebSocket 연결 병목 감지
        if (wsConnectDuration > 3000) {
            bottleneckDetected.add(1);
            console.error(`[VU ${__VU}] [BOTTLENECK] WS connection took ${wsConnectDuration}ms`);
        }
        
        socket.on('open', function () {
            console.log(`[VU ${__VU}] ✓ Connected - Stage: ${getPeakStage(__VU)}, Room: ${chatRoomId}`);
            
            // 채팅방 입장
            const joinStart = Date.now();
            socket.send(JSON.stringify({
                type: 'JOIN_ROOM',
                chatRoomId: chatRoomId,
                timestamp: new Date().toISOString()
            }));
            const joinDuration = Date.now() - joinStart;
            chatRoomJoinDuration.add(joinDuration);
            
            // 메시지 전송 (부하에 따라 빈도 조절)
            const messageInterval = getMessageInterval(__VU);
            const maxMessages = getMaxMessages(__VU);
            
            socket.setInterval(function () {
                if (messageCount >= maxMessages) {
                    console.log(`[VU ${__VU}] ✓ Completed ${messageCount} messages, closing`);
                    socket.close();
                    return;
                }
                
                const sendStartTime = Date.now();
                const messageId = `${__VU}_${messageCount}_${Date.now()}`;
                const message = {
                    type: 'CHAT',
                    chatRoomId: chatRoomId,
                    message: `[VU${__VU}][${getPeakStage(__VU)}] Message #${messageCount + 1} - ${generateRealisticMessage(__VU)}`,
                    timestamp: new Date().toISOString(),
                    messageId: messageId
                };
                
                try {
                    socket.send(JSON.stringify(message));
                    messagesSent.add(1);
                    messagesPerSecond.add(1);
                    messageCount++;
                    
                    const sendDuration = Date.now() - sendStartTime;
                    messageSendDuration.add(sendDuration);
                    messageSendTimes.set(messageId, sendStartTime);
                    
                    // Kafka publish 레이턴시 추정
                    kafkaPublishDuration.add(sendDuration);
                    
                    // 메시지 전송 병목 감지
                    if (sendDuration > 1000) {
                        highLatencyMessages.add(1);
                        bottleneckDetected.add(1);
                        console.warn(`[VU ${__VU}] [BOTTLENECK] Message send took ${sendDuration}ms`);
                    }
                } catch (e) {
                    wsConnectionErrors.add(1);
                    errorRate.add(1);
                    console.error(`[VU ${__VU}] ✗ Send failed: ${e}`);
                }
            }, messageInterval);
            
            // 타임아웃 (부하에 따라 조절)
            const timeout = getSessionTimeout(__VU);
            socket.setTimeout(function () {
                console.log(`[VU ${__VU}] ⏱ Timeout after ${timeout}ms - closing`);
                socket.close();
            }, timeout);
        });
        
        socket.on('message', function (data) {
            try {
                const message = JSON.parse(data);
                
                if (message.type === 'MESSAGE' || message.type === 'CHAT') {
                    receivedCount++;
                    messagesReceived.add(1);
                    
                    // 메시지 레이턴시 계산 (end-to-end)
                    if (message.timestamp) {
                        const receiveTime = Date.now();
                        const sendTime = new Date(message.timestamp).getTime();
                        const latency = receiveTime - sendTime;
                        
                        if (latency > 0 && latency < 60000) {
                            messageReceiveDuration.add(latency);
                            messagingLatency.add(latency);
                            
                            // 높은 레이턴시 감지 (Redis/Kafka 병목)
                            if (latency > 5000) {
                                highLatencyMessages.add(1);
                                bottleneckDetected.add(1);
                                console.error(`[VU ${__VU}] [CRITICAL] Message latency ${latency}ms - Possible Redis/Kafka bottleneck`);
                            } else if (latency > 2000) {
                                console.warn(`[VU ${__VU}] [WARNING] Message latency ${latency}ms`);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error(`[VU ${__VU}] ✗ Parse failed: ${e}`);
            }
        });
        
        socket.on('close', function () {
            activeConnections.add(-1);
            console.log(`[VU ${__VU}] ✗ Closed - Sent: ${messageCount}, Received: ${receivedCount}`);
            
            // 메시지 손실률 계산
            if (messageCount > 0) {
                const lossCount = messageCount - receivedCount;
                if (lossCount > 0) {
                    const lossRateValue = lossCount / messageCount;
                    messageLossRate.add(true);
                    
                    // 높은 손실률 = 병목
                    if (lossRateValue > 0.1) {
                        bottleneckDetected.add(1);
                        console.error(`[VU ${__VU}] [BOTTLENECK] High message loss: ${(lossRateValue * 100).toFixed(2)}%`);
                    }
                } else {
                    messageLossRate.add(false);
                }
            }
            
            // 처리량 계산
            const totalDuration = Date.now() - iterationStart;
            if (totalDuration > 0) {
                const tps = (messageCount / (totalDuration / 1000)).toFixed(2);
                throughput.add(parseFloat(tps));
            }
        });
        
        socket.on('error', function (e) {
            wsConnectionErrors.add(1);
            connectionDropRate.add(1);
            errorRate.add(1);
            activeConnections.add(-1);
            console.error(`[VU ${__VU}] ✗ WebSocket error: ${e.error()}`);
        });
    });
    
    if (!connectionSuccess) {
        wsConnectionSuccess.add(0);
        connectionDropRate.add(1);
        errorRate.add(1);
    }
    
    check(res, {
        'WebSocket status OK': (r) => r && r.status === 101,
    });
    
    // ========================================================================
    // Think Time
    // ========================================================================
    const thinkTime = getThinkTime(__VU);
    sleep(thinkTime);
}

// ============================================================================
// Helper Functions
// ============================================================================
function getPeakStage(vu) {
    if (vu <= 100) return 'MORNING';
    if (vu <= 300) return 'NORMAL';
    if (vu <= 800) return 'LUNCH_PEAK';
    if (vu <= 500) return 'AFTERNOON';
    if (vu <= 1200) return 'EVENING_PEAK';
    if (vu <= 1500) return 'MAX_LOAD';
    if (vu <= 300) return 'NIGHT';
    return 'SCALE_DOWN';
}

function getMessageInterval(vu) {
    // 부하가 높을수록 메시지를 더 자주 전송
    if (vu <= 300) return 5000;   // 5초
    if (vu <= 800) return 3000;   // 3초
    if (vu <= 1200) return 2000;  // 2초
    return 1000;                  // 1초 (최대 부하)
}

function getMaxMessages(vu) {
    // 부하가 높을수록 적은 메시지 (더 많은 사용자)
    if (vu <= 300) return 10;
    if (vu <= 800) return 7;
    if (vu <= 1200) return 5;
    return 3;
}

function getSessionTimeout(vu) {
    // 부하가 높을수록 짧은 세션
    if (vu <= 300) return 60000;  // 60초
    if (vu <= 800) return 40000;  // 40초
    if (vu <= 1200) return 30000; // 30초
    return 20000;                 // 20초
}

function getThinkTime(vu) {
    if (vu <= 300) return 1 + Math.random();
    if (vu <= 1200) return 0.5 + Math.random() * 0.5;
    return 0.2 + Math.random() * 0.3;
}

function generateRealisticMessage(vu) {
    const messages = [
        '안녕하세요!',
        '회의 자료 확인 부탁드립니다.',
        '프로젝트 진행 상황 공유드립니다.',
        '감사합니다!',
        '확인했습니다.',
        '좋은 아이디어네요!',
        '다음 주 월요일 회의 어떠세요?',
        '네, 알겠습니다.',
        '수고하셨습니다!',
        '질문이 있습니다.'
    ];
    return messages[vu % messages.length];
}

// ============================================================================
// Teardown Phase
// ============================================================================
export function teardown(data) {
    console.log('');
    console.log('========================================');
    console.log('ENHANCED CHAT STRESS TEST COMPLETED');
    console.log('========================================');
    console.log('Test Type: ' + data.testType);
    console.log('Start time: ' + data.startTime);
    console.log('End time: ' + new Date().toISOString());
    console.log('');
    console.log('📊 Check k6 Cloud Dashboard for:');
    console.log('  ✓ WebSocket Connection Performance');
    console.log('  ✓ Message Send/Receive Latency');
    console.log('  ✓ Message Loss Rate');
    console.log('  ✓ Peak Hour Performance');
    console.log('  ✓ Redis/Kafka Performance');
    console.log('  ✓ Bottleneck Identification');
    console.log('');
    console.log('🔍 Key Metrics to Analyze:');
    console.log('  - ws_connection_duration (p95, p99)');
    console.log('  - message_send_duration (p95, p99)');
    console.log('  - message_receive_duration (end-to-end latency)');
    console.log('  - message_loss_rate (should be < 1%)');
    console.log('  - messaging_latency (Redis/Kafka performance)');
    console.log('  - bottleneck_detected (identifies bottlenecks)');
    console.log('  - messages_per_second (throughput)');
    console.log('');
    console.log('⚡ Performance Targets:');
    console.log('  - WS connection p95 < 2s');
    console.log('  - Message send p95 < 1s');
    console.log('  - Message receive p95 < 2s');
    console.log('  - Message loss rate < 1%');
    console.log('  - Throughput > 500 messages/sec');
    console.log('========================================');
}
