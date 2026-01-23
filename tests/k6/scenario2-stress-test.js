// ============================================
// 시나리오 2: 스트레스 테스트 (Stress Test)
// ============================================
// 목적: 시스템 한계점 파악
// 사용자: 1,000 → 5,000명 (점진적 증가)
// 기간: 20분
// ============================================

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { getUserForVU } from './common/test-users.js';
import { login, BASE_URL, WS_URL } from './common/api-client.js';
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
        { duration: '5m', target: 1000 },   // 1,000명
        { duration: '5m', target: 2000 },   // 2,000명
        { duration: '5m', target: 3000 },   // 3,000명 (Breaking Point 예상)
        { duration: '5m', target: 5000 },   // 5,000명
    ],
    thresholds: {
        'message_send_duration': ['p(95)<200'],  // 여유있게 설정
        'http_req_failed': ['rate<0.05'],
        'message_loss_rate': ['rate<0.01'],
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
            // 채팅방 참여
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
                // Ignore parse errors
            }
        });
        
        socket.on('error', (e) => {
            wsConnectionErrors.add(1);
            messageErrors.add(1);
        });
        
        socket.on('close', () => {
            activeConnections.add(-1);
        });
        
        // 적극적 채팅: 초당 1개 메시지 (높은 부하)
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
                    content: `Stress test message ${messageCount}`
                }));
                
                messagesSent.add(1);
                messageSendDuration.add(Date.now() - sendStart);
                sentMessages.add(messageId);
                
            } catch (e) {
                messageErrors.add(1);
            }
        }, 1000);  // 1초마다 (높은 빈도)
        
        // 20분 후 종료
        socket.setTimeout(() => {
            if (sentMessages.size > 0) {
                messageLossRate.add(1);
            } else {
                messageLossRate.add(0);
            }
            
            socket.clearInterval(sendInterval);
            socket.close();
        }, 1200000);  // 20분
    });
    
    sleep(1);
}

// ============================================
// 테스트 종료 후 요약
// ============================================
export function handleSummary(data) {
    const summary = generateSummary(data);
    
    // Breaking Point 분석 추가
    let breakingPointAnalysis = '\n';
    breakingPointAnalysis += '📉 Breaking Point 분석\n';
    breakingPointAnalysis += '  - 1,000명: 안정적 예상\n';
    breakingPointAnalysis += '  - 2,000명: 성능 저하 시작 예상\n';
    breakingPointAnalysis += '  - 3,000명: Breaking Point 예상\n';
    breakingPointAnalysis += '  - 5,000명: 시스템 한계 초과 예상\n\n';
    
    const fullSummary = summary + breakingPointAnalysis;
    
    console.log(fullSummary);
    
    return {
        'stdout': fullSummary,
        'results/scenario2-stress-test.json': JSON.stringify(data, null, 2),
        'results/scenario2-stress-test.txt': fullSummary,
    };
}
