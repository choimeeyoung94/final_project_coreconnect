import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { getTestUser } from './common/test-users.js';

// Custom Metrics
const messageSendDuration = new Trend('message_send_duration');
const messageReceiveDuration = new Trend('message_receive_duration');
const messagesSent = new Counter('messages_sent');
const messagesReceived = new Counter('messages_received');
const messageLossRate = new Rate('message_loss_rate');
const wsConnects = new Counter('websocket_connects');
const wsErrors = new Counter('websocket_errors');
const chatRoomJoinDuration = new Trend('chatroom_join_duration');
const activeConnections = new Gauge('active_connections');
const breakingPointReached = new Rate('breaking_point_reached');

// k6 Cloud Configuration
export const options = {
    // Stress Test: Gradual increase to find breaking point
    stages: [
        { duration: '5m', target: 100 },   // Level 1: Baseline
        { duration: '5m', target: 200 },   // Level 2: 2x load
        { duration: '5m', target: 300 },   // Level 3: 3x load
        { duration: '5m', target: 500 },   // Level 4: 5x load
        { duration: '5m', target: 1000 },  // Level 5: 10x load - Breaking Point
        { duration: '2m', target: 0 },     // Ramp down
    ],
    thresholds: {
        'http_req_duration': ['p(95)<10000'],  // Relaxed for stress test
        'http_req_failed': ['rate<0.95'],      // Allow up to 95% failure
        'message_send_duration': ['p(95)<5000'],
        'websocket_connects': ['count>0'],
    },
    ext: {
        loadimpact: {
            projectID: 6403215,
            name: 'CoreConnect - Stress Test (Breaking Point)',
            distribution: {
                'amazon:kr:seoul': { loadZone: 'amazon:kr:seoul', percent: 100 }
            }
        }
    }
};

const BASE_URL = __ENV.BASE_URL || 'http://3.38.28.172:8080';
const WS_URL = __ENV.WS_URL || 'ws://3.38.28.172:8080';

export function setup() {
    console.log('========================================');
    console.log('STRESS TEST: Finding Breaking Point');
    console.log('========================================');
    console.log('API Server: ' + BASE_URL);
    console.log('WebSocket: ' + WS_URL);
    console.log('Max VUs: 1,000 (10x baseline)');
    console.log('Duration: 27 minutes');
    console.log('========================================');
    console.log('Load Pattern:');
    console.log('  0-5min:   100 VUs (Baseline)');
    console.log('  5-10min:  200 VUs (2x)');
    console.log('  10-15min: 300 VUs (3x)');
    console.log('  15-20min: 500 VUs (5x)');
    console.log('  20-25min: 1000 VUs (10x) <- Breaking Point');
    console.log('  25-27min: Ramp down');
    console.log('========================================');
    
    return { 
        startTime: new Date().toISOString(),
        testType: 'STRESS_TEST'
    };
}

export default function () {
    const user = getTestUser(__VU);
    const startTime = Date.now();
    
    // Track current VU level for breaking point detection
    const currentVUs = __VU;
    
    // 1. Login
    const loginPayload = JSON.stringify({
        email: user.email,
        password: user.password
    });
    
    const loginParams = {
        headers: { 'Content-Type': 'application/json' },
        tags: { 
            name: 'Login',
            stage: getStage(__ITER, __VU)
        }
    };
    
    const loginResponse = http.post(BASE_URL + '/api/v1/auth/login', loginPayload, loginParams);
    
    const loginSuccess = check(loginResponse, {
        'login successful': (r) => r.status === 200,
    });
    
    if (!loginSuccess) {
        breakingPointReached.add(1);
        console.error('[VU ' + __VU + '] Login failed at stage: ' + getStage(__ITER, __VU));
        return;
    }
    
    let token = 'cookie-auth';
    if (loginResponse.cookies && loginResponse.cookies.access_token) {
        token = loginResponse.cookies.access_token[0].value;
    }
    
    // 2. Get chat rooms
    const roomsResponse = http.get(BASE_URL + '/api/v1/chatrooms', {
        headers: { 
            'Authorization': 'Bearer ' + token,
            'Cookie': 'access_token=' + token
        },
        tags: { 
            name: 'GetChatRooms',
            stage: getStage(__ITER, __VU)
        }
    });
    
    let chatRoomId = 1;
    
    if (roomsResponse.status === 200) {
        try {
            const rooms = roomsResponse.json();
            if (rooms && rooms.length > 0) {
                chatRoomId = rooms[Math.floor(Math.random() * Math.min(rooms.length, 10))].id;
            }
        } catch (e) {
            console.log('[VU ' + __VU + '] Failed to parse rooms');
        }
    }
    
    // 3. WebSocket connection
    const wsUrl = WS_URL + '/ws?token=' + token;
    
    const wsParams = {
        tags: { 
            name: 'WebSocketConnection',
            stage: getStage(__ITER, __VU)
        }
    };
    
    let messageCount = 0;
    let receivedCount = 0;
    let connectionSuccess = false;
    
    const res = ws.connect(wsUrl, wsParams, function (socket) {
        wsConnects.add(1);
        activeConnections.add(1);
        connectionSuccess = true;
        
        socket.on('open', function () {
            console.log('[VU ' + __VU + '] Connected - Stage: ' + getStage(__ITER, __VU) + ', Room: ' + chatRoomId);
            
            const joinStartTime = Date.now();
            socket.send(JSON.stringify({
                type: 'JOIN_ROOM',
                chatRoomId: chatRoomId,
                timestamp: new Date().toISOString()
            }));
            chatRoomJoinDuration.add(Date.now() - joinStartTime);
            
            // Send messages more frequently to stress the system
            socket.setInterval(function () {
                if (messageCount >= 8) {  // Send 8 messages instead of 10
                    socket.close();
                    return;
                }
                
                const sendStartTime = Date.now();
                const message = {
                    type: 'CHAT',
                    chatRoomId: chatRoomId,
                    message: '[VU ' + __VU + '][Stage:' + getStage(__ITER, __VU) + '] Stress test message #' + (messageCount + 1),
                    timestamp: new Date().toISOString()
                };
                
                try {
                    socket.send(JSON.stringify(message));
                    messagesSent.add(1);
                    messageCount++;
                    messageSendDuration.add(Date.now() - sendStartTime);
                } catch (e) {
                    wsErrors.add(1);
                    breakingPointReached.add(1);
                    console.error('[VU ' + __VU + '] Send failed: ' + e);
                }
            }, 3000);  // Every 3 seconds (more aggressive)
            
            socket.setTimeout(function () {
                console.log('[VU ' + __VU + '] Timeout - closing');
                socket.close();
            }, 40000);  // 40 seconds
        });
        
        socket.on('message', function (data) {
            try {
                const message = JSON.parse(data);
                
                if (message.type === 'MESSAGE' || message.type === 'CHAT') {
                    receivedCount++;
                    messagesReceived.add(1);
                    
                    if (message.timestamp) {
                        const receiveTime = Date.now();
                        const sendTime = new Date(message.timestamp).getTime();
                        const latency = receiveTime - sendTime;
                        
                        if (latency > 0 && latency < 60000) {  // Increased max latency for stress test
                            messageReceiveDuration.add(latency);
                        }
                        
                        // Detect breaking point: if latency > 30 seconds
                        if (latency > 30000) {
                            breakingPointReached.add(1);
                            console.warn('[VU ' + __VU + '] BREAKING POINT: Latency ' + latency + 'ms at stage ' + getStage(__ITER, __VU));
                        }
                    }
                }
            } catch (e) {
                console.error('[VU ' + __VU + '] Parse failed: ' + e);
            }
        });
        
        socket.on('close', function () {
            activeConnections.add(-1);
            console.log('[VU ' + __VU + '] Closed - Sent: ' + messageCount + ', Received: ' + receivedCount);
            
            if (messageCount > 0) {
                const lossCount = messageCount - receivedCount;
                if (lossCount > 0) {
                    messageLossRate.add(true);
                    
                    // High message loss indicates breaking point
                    if (lossCount > messageCount * 0.5) {
                        breakingPointReached.add(1);
                    }
                } else {
                    messageLossRate.add(false);
                }
            }
        });
        
        socket.on('error', function (e) {
            wsErrors.add(1);
            breakingPointReached.add(1);
            activeConnections.add(-1);
            console.error('[VU ' + __VU + '] WebSocket error: ' + e.error());
        });
    });
    
    if (!connectionSuccess) {
        breakingPointReached.add(1);
    }
    
    check(res, {
        'WebSocket status OK': (r) => r && r.status === 101,
    });
    
    // Variable sleep based on current load
    const sleepTime = currentVUs > 500 ? 0.5 : 1;
    sleep(sleepTime);
}

// Helper function to determine current stage
function getStage(iteration, vu) {
    if (vu <= 100) return 'L1:100VUs';
    if (vu <= 200) return 'L2:200VUs';
    if (vu <= 300) return 'L3:300VUs';
    if (vu <= 500) return 'L4:500VUs';
    if (vu <= 1000) return 'L5:1000VUs';
    return 'RAMPDOWN';
}

export function teardown(data) {
    console.log('');
    console.log('========================================');
    console.log('STRESS TEST COMPLETED');
    console.log('========================================');
    console.log('Test Type: ' + data.testType);
    console.log('Start time: ' + data.startTime);
    console.log('End time: ' + new Date().toISOString());
    console.log('');
    console.log('Check k6 Cloud dashboard for:');
    console.log('  - Breaking Point identification');
    console.log('  - Performance degradation per stage');
    console.log('  - Error rate progression');
    console.log('  - Maximum stable throughput');
    console.log('========================================');
}
