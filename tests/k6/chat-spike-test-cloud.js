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
const spikeRecoveryTime = new Trend('spike_recovery_time');
const errorsDuringSpike = new Counter('errors_during_spike');

// k6 Cloud Configuration
export const options = {
    stages: [
        { duration: '1m', target: 50 },    // Normal load
        { duration: '30s', target: 500 },  // Spike! (10x increase)
        { duration: '30s', target: 500 },  // Hold spike
        { duration: '1m', target: 50 },    // Recovery
        { duration: '30s', target: 0 },    // Ramp down
    ],
    thresholds: {
        'http_req_duration': ['p(95)<2000', 'p(99)<5000'], // Allow higher during spike
        'http_req_failed': ['rate<0.10'], // Allow up to 10% failure during spike
        'message_send_duration': ['p(95)<1000', 'p(99)<3000'],
        'message_loss_rate': ['rate<0.10'],
        'websocket_connects': ['count>0'],
        'spike_recovery_time': ['p(95)<5000'], // Recovery should be under 5s
    },
    ext: {
        loadimpact: {
            projectID: 6403215,
            name: 'CoreConnect - Spike Test',
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
    console.log('Spike Test Started');
    console.log('========================================');
    console.log('API Server: ' + BASE_URL);
    console.log('WebSocket: ' + WS_URL);
    console.log('');
    console.log('Load Pattern:');
    console.log('  0-1min: Normal (50 VUs)');
    console.log('  1-1.5min: Spike! (50 -> 500 VUs)');
    console.log('  1.5-2min: Hold Spike (500 VUs)');
    console.log('  2-3min: Recovery (500 -> 50 VUs)');
    console.log('  3-3.5min: Ramp Down (50 -> 0 VUs)');
    console.log('========================================');
    console.log('');
    console.log('Purpose: Test system behavior under sudden traffic spike');
    console.log('Scenario: Event announcement, mass notification, viral content');
    console.log('========================================');
    
    return { 
        startTime: new Date().toISOString(),
        spikeStartTime: Date.now() + 60000 // Spike starts after 1 minute
    };
}

export default function (data) {
    const currentTime = Date.now();
    const isSpikePeriod = currentTime >= data.spikeStartTime && currentTime < (data.spikeStartTime + 60000);
    
    activeConnections.add(1);
    
    const user = getTestUser(__VU);
    
    const loginStartTime = Date.now();
    const loginPayload = JSON.stringify({
        email: user.email,
        password: user.password
    });
    
    const loginParams = {
        headers: { 'Content-Type': 'application/json' },
        tags: { 
            name: 'Login',
            phase: isSpikePeriod ? 'spike' : 'normal'
        }
    };
    
    const loginResponse = http.post(BASE_URL + '/api/v1/auth/login', loginPayload, loginParams);
    
    const loginSuccess = check(loginResponse, {
        'login successful': (r) => r.status === 200,
    });
    
    if (!loginSuccess) {
        console.error('[VU ' + __VU + '] Login failed: ' + loginResponse.status);
        if (isSpikePeriod) {
            errorsDuringSpike.add(1, { type: 'login_failure' });
        }
        activeConnections.add(-1);
        return;
    }
    
    const loginDuration = Date.now() - loginStartTime;
    if (isSpikePeriod) {
        spikeRecoveryTime.add(loginDuration);
    }
    
    let token = 'cookie-auth';
    if (loginResponse.cookies && loginResponse.cookies.access_token) {
        token = loginResponse.cookies.access_token[0].value;
    }
    
    const roomsResponse = http.get(BASE_URL + '/api/v1/chatrooms', {
        headers: { 
            'Authorization': 'Bearer ' + token,
            'Cookie': 'access_token=' + token
        },
        tags: { 
            name: 'GetChatRooms',
            phase: isSpikePeriod ? 'spike' : 'normal'
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
            console.log('[VU ' + __VU + '] Failed to parse rooms, using default');
        }
    }
    
    const wsUrl = WS_URL + '/ws?token=' + token;
    
    const wsParams = {
        tags: { 
            name: 'WebSocketConnection',
            phase: isSpikePeriod ? 'spike' : 'normal'
        }
    };
    
    let messageCount = 0;
    let receivedCount = 0;
    const maxMessages = isSpikePeriod ? 3 : 5; // Send fewer messages during spike
    
    const res = ws.connect(wsUrl, wsParams, function (socket) {
        wsConnects.add(1);
        
        socket.on('open', function () {
            console.log('[VU ' + __VU + '] WS connected - Room: ' + chatRoomId + ' [' + (isSpikePeriod ? 'SPIKE' : 'normal') + ']');
            
            const joinStartTime = Date.now();
            socket.send(JSON.stringify({
                type: 'JOIN_ROOM',
                chatRoomId: chatRoomId,
                timestamp: new Date().toISOString()
            }));
            const joinDuration = Date.now() - joinStartTime;
            chatRoomJoinDuration.add(joinDuration);
            
            if (isSpikePeriod && joinDuration > 1000) {
                errorsDuringSpike.add(1, { type: 'slow_join' });
            }
            
            socket.setInterval(function () {
                if (messageCount >= maxMessages) {
                    socket.close();
                    return;
                }
                
                const sendStartTime = Date.now();
                const message = {
                    type: 'CHAT',
                    chatRoomId: chatRoomId,
                    message: '[VU ' + __VU + '] ' + (isSpikePeriod ? 'SPIKE ' : '') + 'msg #' + (messageCount + 1),
                    timestamp: new Date().toISOString()
                };
                
                socket.send(JSON.stringify(message));
                messagesSent.add(1);
                messageCount++;
                
                const sendDuration = Date.now() - sendStartTime;
                messageSendDuration.add(sendDuration);
                
                if (isSpikePeriod && sendDuration > 500) {
                    errorsDuringSpike.add(1, { type: 'slow_send' });
                }
            }, isSpikePeriod ? 2000 : 3000); // Faster during spike
            
            socket.setTimeout(function () {
                console.log('[VU ' + __VU + '] Timeout - closing');
                socket.close();
            }, 30000);
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
                        
                        if (latency > 0 && latency < 10000) {
                            messageReceiveDuration.add(latency);
                            
                            if (isSpikePeriod) {
                                spikeRecoveryTime.add(latency);
                                if (latency > 2000) {
                                    errorsDuringSpike.add(1, { type: 'high_latency' });
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('[VU ' + __VU + '] Failed to parse message: ' + e);
                if (isSpikePeriod) {
                    errorsDuringSpike.add(1, { type: 'parse_error' });
                }
            }
        });
        
        socket.on('close', function () {
            console.log('[VU ' + __VU + '] WS closed - Sent: ' + messageCount + ', Received: ' + receivedCount);
            
            if (messageCount > 0) {
                const lossCount = messageCount - receivedCount;
                if (lossCount > 0) {
                    messageLossRate.add(true);
                    if (isSpikePeriod) {
                        errorsDuringSpike.add(lossCount, { type: 'message_loss' });
                    }
                } else {
                    messageLossRate.add(false);
                }
            }
            activeConnections.add(-1);
        });
        
        socket.on('error', function (e) {
            wsErrors.add(1);
            console.error('[VU ' + __VU + '] WS error: ' + e.error());
            if (isSpikePeriod) {
                errorsDuringSpike.add(1, { type: 'ws_error' });
            }
            activeConnections.add(-1);
        });
    });
    
    check(res, {
        'WebSocket status OK': (r) => r && r.status === 101,
    });
    
    sleep(1);
}

export function teardown(data) {
    console.log('');
    console.log('========================================');
    console.log('Spike Test Completed!');
    console.log('========================================');
    console.log('Start time: ' + data.startTime);
    console.log('End time: ' + new Date().toISOString());
    console.log('');
    console.log('Key Metrics to Check:');
    console.log('- Response time during spike vs normal');
    console.log('- Error rate during spike');
    console.log('- Recovery time after spike');
    console.log('- System stability after recovery');
    console.log('');
    console.log('Check detailed results in k6 Cloud dashboard');
    console.log('========================================');
}
