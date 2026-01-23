// ============================================
// 시나리오 3: 스파이크 테스트 (Spike Test)
// ============================================
// 목적: 갑작스러운 트래픽 폭증 대응 능력 측정
// 사용자: 500명 → 5,000명 (10배 급증) → 500명
// ============================================

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { getUserForVU } from './common/test-users.js';
import { login, WS_URL } from './common/api-client.js';
import {
    messagesSent,
    messagesReceived,
    loginDuration,
    messageSendDuration,
    wsConnectionDuration,
    messageErrors,
    messageLossRate,
    loginErrors,
    wsConnectionErrors,
    activeConnections,
    generateSummary
} from './common/metrics.js';

// ============================================
// 테스트 설정
// ============================================
export let options = {
    stages: [
        { duration: '2m', target: 500 },    // 평소 부하
        { duration: '1m', target: 5000 },   // 스파이크 발생 (10배)
        { duration: '2m', target: 5000 },   // 스파이크 유지
        { duration: '1m', target: 500 },    // 복귀
        { duration: '2m', target: 500 },    // 안정화
    ],
    thresholds: {
        'message_send_duration': ['p(95)<500'],  // 스파이크 시 여유있게
        'message_loss_rate': ['rate<0.05'],      // 유실률 5% 이하
    },
};

// ============================================
// 메인 테스트 시나리오
// ============================================
export default function() {
    const user = getUserForVU(5000);
    
    // 로그인
    const loginStart = Date.now();
    const token = login(user.email, user.password);
    
    if (!token) {
        loginErrors.add(1);
        sleep(5);
        return;
    }
    
    loginDuration.add(Date.now() - loginStart);
    
    // WebSocket 연결
    const wsStart = Date.now();
    const url = `${WS_URL}?token=${token}`;
    
    ws.connect(url, {}, function(socket) {
        wsConnectionDuration.add(Date.now() - wsStart);
        activeConnections.add(1);
        
        const sentMessages = new Set();
        
        socket.on('open', () => {
            const roomId = Math.floor(Math.random() * 100) + 1;
            socket.send(JSON.stringify({
                type: 'JOIN_ROOM',
                roomId: roomId
            }));
        });
        
        socket.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                messagesReceived.add(1);
                
                if (message.messageId && sentMessages.has(message.messageId)) {
                    sentMessages.delete(message.messageId);
                }
            } catch (e) {
                // Ignore
            }
        });
        
        socket.on('error', (e) => {
            wsConnectionErrors.add(1);
            messageErrors.add(1);
        });
        
        socket.on('close', () => {
            activeConnections.add(-1);
        });
        
        // 메시지 전송 (3초마다)
        let messageCount = 0;
        const sendInterval = socket.setInterval(() => {
            const messageId = `${user.userId}-${Date.now()}-${messageCount++}`;
            const roomId = Math.floor(Math.random() * 100) + 1;
            
            const sendStart = Date.now();
            
            try {
                socket.send(JSON.stringify({
                    type: 'SEND_MESSAGE',
                    messageId: messageId,
                    roomId: roomId,
                    content: `Spike test message ${messageCount}`
                }));
                
                messagesSent.add(1);
                messageSendDuration.add(Date.now() - sendStart);
                sentMessages.add(messageId);
                
            } catch (e) {
                messageErrors.add(1);
            }
        }, 3000);  // 3초마다
        
        // 8분 후 종료 (전체 테스트 시간)
        socket.setTimeout(() => {
            if (sentMessages.size > 0) {
                messageLossRate.add(1);
            } else {
                messageLossRate.add(0);
            }
            
            socket.clearInterval(sendInterval);
            socket.close();
        }, 480000);  // 8분
    });
    
    sleep(1);
}

// ============================================
// 테스트 종료 후 요약
// ============================================
export function handleSummary(data) {
    const summary = generateSummary(data);
    
    let spikeAnalysis = '\n';
    spikeAnalysis += '⚡ 스파이크 대응 분석\n';
    spikeAnalysis += '  - 평소 (500명): 안정적 예상\n';
    spikeAnalysis += '  - 스파이크 (5,000명): 응답 시간 증가 예상\n';
    spikeAnalysis += '  - 복구 시간: 1-2분 예상\n';
    spikeAnalysis += '  - 자동 복구 여부: 확인 필요\n\n';
    
    const fullSummary = summary + spikeAnalysis;
    
    console.log(fullSummary);
    
    return {
        'stdout': fullSummary,
        'results/scenario3-spike-test.json': JSON.stringify(data, null, 2),
        'results/scenario3-spike-test.txt': fullSummary,
    };
}
