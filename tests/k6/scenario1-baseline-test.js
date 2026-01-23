// ============================================
// 시나리오 1: 일반 채팅 부하 테스트 (Baseline Test)
// ============================================
// 목적: 정상 상황에서의 기본 성능 측정
// 사용자: 1,000명
// 기간: 10분
// ============================================

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// ============================================
// Custom Metrics
// ============================================
const messageSendTime = new Trend('message_send_duration');
const messagesReceived = new Counter('messages_received');
const messagesSent = new Counter('messages_sent');
const messageErrors = new Counter('message_errors');
const messageLossRate = new Rate('message_loss_rate');
const loginDuration = new Trend('login_duration');
const wsConnectionDuration = new Trend('ws_connection_duration');

// ============================================
// 테스트 설정
// ============================================
export let options = {
    stages: [
        { duration: '5m', target: 1000 },   // Ramp-up: 5분간 1,000명까지 증가
        { duration: '5m', target: 1000 },   // 안정화: 5분간 1,000명 유지
    ],
    thresholds: {
        // 목표: P95 응답 시간
        'message_send_duration': ['p(95)<50', 'p(99)<100'],
        
        // 목표: 에러율 1% 이하
        'http_req_failed': ['rate<0.01'],
        
        // 목표: WebSocket 연결 성공률 99% 이상
        'ws_connecting': ['avg<3000'],
        
        // 목표: 메시지 유실률 0.1% 이하
        'message_loss_rate': ['rate<0.001'],
    },
};

// ============================================
// 테스트 사용자 목록 (1,000명)
// ============================================
// MySQL에서 생성한 사용자 사용
// email: testuser00001@loadtest.com ~ testuser01000@loadtest.com
// password: password (모두 동일)

function getTestUser(userId) {
    const userNumber = String(userId).padStart(5, '0');
    return {
        email: `testuser${userNumber}@loadtest.com`,
        password: 'password',
        name: `테스트유저${userNumber}`
    };
}

// ============================================
// 환경 설정
// ============================================
const BASE_URL = __ENV.BASE_URL || 'http://your-service.com';
const WS_URL = __ENV.WS_URL || 'ws://your-service.com/ws';

// ============================================
// 메인 테스트 시나리오
// ============================================
export default function() {
    // 1. 사용자 선택 (1-1000 범위)
    const userId = (__VU % 1000) + 1;  // VU (Virtual User) 번호 기반
    const user = getTestUser(userId);
    
    // 2. 로그인
    const loginStart = Date.now();
    const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
        email: user.email,
        password: user.password
    }), {
        headers: { 'Content-Type': 'application/json' },
    });
    
    const loginSuccess = check(loginRes, {
        'login status is 200': (r) => r.status === 200,
        'received JWT token': (r) => r.json('token') !== undefined,
    });
    
    if (!loginSuccess) {
        console.error(`Login failed for ${user.email}: ${loginRes.status}`);
        messageErrors.add(1);
        sleep(5);
        return;
    }
    
    loginDuration.add(Date.now() - loginStart);
    const token = loginRes.json('token');
    
    // 3. WebSocket 연결
    const wsStart = Date.now();
    const url = `${WS_URL}?token=${token}`;
    
    ws.connect(url, {}, function(socket) {
        wsConnectionDuration.add(Date.now() - wsStart);
        
        // 메시지 수신 추적
        const sentMessageIds = new Set();
        const receivedMessageIds = new Set();
        
        socket.on('open', () => {
            console.log(`[${user.email}] WebSocket connected`);
            
            // 채팅방 참여 (랜덤 채팅방 3개)
            for (let i = 0; i < 3; i++) {
                const roomId = Math.floor(Math.random() * 100) + 1;
                socket.send(JSON.stringify({
                    type: 'JOIN_ROOM',
                    roomId: roomId
                }));
            }
        });
        
        socket.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                messagesReceived.add(1);
                
                // 내가 보낸 메시지인지 확인
                if (message.messageId && sentMessageIds.has(message.messageId)) {
                    receivedMessageIds.add(message.messageId);
                }
            } catch (e) {
                console.error(`Failed to parse message: ${e}`);
            }
        });
        
        socket.on('error', (e) => {
            console.error(`WebSocket error: ${e}`);
            messageErrors.add(1);
        });
        
        // 5초마다 메시지 전송 (총 10분 = 120개 메시지)
        socket.setInterval(() => {
            const messageId = `${userId}-${Date.now()}`;
            const roomId = Math.floor(Math.random() * 100) + 1;
            
            const sendStart = Date.now();
            sentMessageIds.add(messageId);
            
            socket.send(JSON.stringify({
                type: 'SEND_MESSAGE',
                messageId: messageId,
                roomId: roomId,
                content: `Test message from ${user.name} at ${new Date().toISOString()}`
            }));
            
            messagesSent.add(1);
            messageSendTime.add(Date.now() - sendStart);
        }, 5000);  // 5초마다
        
        // 10초마다 채팅방 목록 조회
        socket.setInterval(() => {
            http.get(`${BASE_URL}/api/chatrooms`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
        }, 10000);  // 10초마다
        
        // 30초마다 메시지 히스토리 조회
        socket.setInterval(() => {
            const roomId = Math.floor(Math.random() * 100) + 1;
            http.get(`${BASE_URL}/api/chatrooms/${roomId}/messages?page=0&size=100`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
        }, 30000);  // 30초마다
        
        // 10분 후 연결 종료 및 메시지 유실률 계산
        socket.setTimeout(() => {
            const lostMessages = sentMessageIds.size - receivedMessageIds.size;
            if (lostMessages > 0) {
                messageLossRate.add(1);
                console.warn(`[${user.email}] Lost ${lostMessages} messages out of ${sentMessageIds.size}`);
            } else {
                messageLossRate.add(0);
            }
            
            socket.close();
        }, 600000);  // 10분 = 600,000ms
    });
    
    // 연결 실패 시 재시도 대기
    sleep(1);
}

// ============================================
// 테스트 종료 후 요약 리포트
// ============================================
export function handleSummary(data) {
    return {
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
        'summary.json': JSON.stringify(data),
        'summary.html': htmlReport(data),
    };
}

function textSummary(data, options) {
    const indent = options.indent || '';
    let output = '\n';
    
    output += `${indent}============================================\n`;
    output += `${indent}시나리오 1: 일반 채팅 부하 테스트 결과\n`;
    output += `${indent}============================================\n\n`;
    
    // 처리량 (TPS)
    const messagesSentCount = data.metrics.messages_sent.values.count || 0;
    const duration = data.state.testRunDurationMs / 1000;  // 초 단위
    const tps = messagesSentCount / duration;
    
    output += `${indent}📊 처리량 (Throughput)\n`;
    output += `${indent}  - 총 메시지 전송: ${messagesSentCount}개\n`;
    output += `${indent}  - 총 메시지 수신: ${data.metrics.messages_received.values.count || 0}개\n`;
    output += `${indent}  - TPS (초당 처리): ${tps.toFixed(2)}\n`;
    output += `${indent}  - 테스트 시간: ${duration.toFixed(0)}초\n\n`;
    
    // 응답 시간
    output += `${indent}⚡ 응답 시간 (Latency)\n`;
    output += `${indent}  - 메시지 전송 P50: ${data.metrics.message_send_duration.values['p(50)'].toFixed(2)}ms\n`;
    output += `${indent}  - 메시지 전송 P95: ${data.metrics.message_send_duration.values['p(95)'].toFixed(2)}ms\n`;
    output += `${indent}  - 메시지 전송 P99: ${data.metrics.message_send_duration.values['p(99)'].toFixed(2)}ms\n`;
    output += `${indent}  - 로그인 평균: ${data.metrics.login_duration.values.avg.toFixed(2)}ms\n\n`;
    
    // 안정성
    const messageLoss = data.metrics.message_loss_rate.values.rate || 0;
    const errorCount = data.metrics.message_errors.values.count || 0;
    const errorRate = (errorCount / messagesSentCount) * 100;
    
    output += `${indent}🛡️ 안정성 (Reliability)\n`;
    output += `${indent}  - 메시지 유실률: ${(messageLoss * 100).toFixed(3)}%\n`;
    output += `${indent}  - 에러 발생: ${errorCount}건\n`;
    output += `${indent}  - 에러율: ${errorRate.toFixed(2)}%\n\n`;
    
    // 목표 달성 여부
    output += `${indent}🎯 목표 달성 여부\n`;
    output += `${indent}  - TPS > 450: ${tps > 450 ? '✅ 통과' : '❌ 실패'} (${tps.toFixed(0)})\n`;
    output += `${indent}  - P95 < 50ms: ${data.metrics.message_send_duration.values['p(95)'] < 50 ? '✅ 통과' : '❌ 실패'}\n`;
    output += `${indent}  - 유실률 < 0.1%: ${messageLoss < 0.001 ? '✅ 통과' : '❌ 실패'}\n`;
    output += `${indent}  - 에러율 < 1%: ${errorRate < 1 ? '✅ 통과' : '❌ 실패'}\n\n`;
    
    output += `${indent}============================================\n`;
    
    return output;
}

function htmlReport(data) {
    // 간단한 HTML 리포트 생성
    return `
<!DOCTYPE html>
<html>
<head>
    <title>부하 테스트 결과</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #4CAF50; color: white; }
        .pass { color: green; font-weight: bold; }
        .fail { color: red; font-weight: bold; }
    </style>
</head>
<body>
    <h1>시나리오 1: 일반 채팅 부하 테스트 결과</h1>
    <p>테스트 시간: ${new Date().toLocaleString()}</p>
    
    <h2>처리량 (Throughput)</h2>
    <table>
        <tr><th>지표</th><th>값</th></tr>
        <tr><td>총 메시지 전송</td><td>${data.metrics.messages_sent.values.count}</td></tr>
        <tr><td>총 메시지 수신</td><td>${data.metrics.messages_received.values.count}</td></tr>
        <tr><td>TPS (초당 처리)</td><td>${((data.metrics.messages_sent.values.count || 0) / (data.state.testRunDurationMs / 1000)).toFixed(2)}</td></tr>
    </table>
    
    <h2>응답 시간 (Latency)</h2>
    <table>
        <tr><th>지표</th><th>값</th></tr>
        <tr><td>P50 (중간값)</td><td>${data.metrics.message_send_duration.values['p(50)'].toFixed(2)}ms</td></tr>
        <tr><td>P95</td><td>${data.metrics.message_send_duration.values['p(95)'].toFixed(2)}ms</td></tr>
        <tr><td>P99</td><td>${data.metrics.message_send_duration.values['p(99)'].toFixed(2)}ms</td></tr>
    </table>
    
    <h2>안정성 (Reliability)</h2>
    <table>
        <tr><th>지표</th><th>값</th></tr>
        <tr><td>메시지 유실률</td><td>${((data.metrics.message_loss_rate.values.rate || 0) * 100).toFixed(3)}%</td></tr>
        <tr><td>에러 발생</td><td>${data.metrics.message_errors.values.count || 0}건</td></tr>
    </table>
</body>
</html>
    `;
}
