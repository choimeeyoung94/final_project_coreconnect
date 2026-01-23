// ============================================
// 시나리오 4: 지속성 테스트 (Endurance Test)
// ============================================
// 목적: 장시간 운영 시 메모리 누수, 성능 저하 확인
// 사용자: 2,000명 (일정)
// 기간: 4시간
// ============================================

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { getUserForVU } from './common/test-users.js';
import { login, WS_URL } from './common/api-client.js';
import {
    messagesSent,
    messagesReceived,
    messageSendDuration,
    wsConnectionDuration,
    messageErrors,
    messageLossRate,
    activeConnections,
    generateSummary
} from './common/metrics.js';

// ============================================
// 테스트 설정
// ============================================
export let options = {
    stages: [
        { duration: '10m', target: 2000 },    // Ramp-up
        { duration: '230m', target: 2000 },   // 유지 (4시간 - 10분)
    ],
    thresholds: {
        'message_send_duration': ['p(95)<100'],
        'message_loss_rate': ['rate<0.001'],
    },
};

// ============================================
// 메인 테스트 시나리오
// ============================================
export default function() {
    const user = getUserForVU(2000);
    
    // 로그인
    const token = login(user.email, user.password);
    
    if (!token) {
        sleep(5);
        return;
    }
    
    // WebSocket 연결
    const wsStart = Date.now();
    const url = `${WS_URL}?token=${token}`;
    
    ws.connect(url, {}, function(socket) {
        wsConnectionDuration.add(Date.now() - wsStart);
        activeConnections.add(1);
        
        const sentMessages = new Set();
        const performanceLog = []; // 시간별 성능 기록
        
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
            messageErrors.add(1);
        });
        
        socket.on('close', () => {
            activeConnections.add(-1);
        });
        
        // 메시지 전송 (5초마다)
        let messageCount = 0;
        let hourlyMessageCount = 0;
        
        const sendInterval = socket.setInterval(() => {
            const messageId = `${user.userId}-${Date.now()}-${messageCount++}`;
            const roomId = Math.floor(Math.random() * 100) + 1;
            
            const sendStart = Date.now();
            
            try {
                socket.send(JSON.stringify({
                    type: 'SEND_MESSAGE',
                    messageId: messageId,
                    roomId: roomId,
                    content: `Endurance test message ${messageCount}`
                }));
                
                messagesSent.add(1);
                const duration = Date.now() - sendStart;
                messageSendDuration.add(duration);
                sentMessages.add(messageId);
                
                hourlyMessageCount++;
                
            } catch (e) {
                messageErrors.add(1);
            }
        }, 5000);  // 5초마다
        
        // 1시간마다 성능 로그 기록
        const logInterval = socket.setInterval(() => {
            const hour = Math.floor(Date.now() / 3600000);
            performanceLog.push({
                hour: hour,
                messages: hourlyMessageCount,
                lostMessages: sentMessages.size
            });
            
            console.log(`[${user.email}] Hour ${hour}: Sent ${hourlyMessageCount}, Lost ${sentMessages.size}`);
            hourlyMessageCount = 0;
        }, 3600000);  // 1시간마다
        
        // 4시간 후 종료
        socket.setTimeout(() => {
            if (sentMessages.size > 0) {
                messageLossRate.add(1);
                console.warn(`[${user.email}] Final lost messages: ${sentMessages.size}`);
            } else {
                messageLossRate.add(0);
            }
            
            socket.clearInterval(sendInterval);
            socket.clearInterval(logInterval);
            socket.close();
        }, 14400000);  // 4시간 = 14,400,000ms
    });
    
    sleep(1);
}

// ============================================
// 테스트 종료 후 요약
// ============================================
export function handleSummary(data) {
    const summary = generateSummary(data);
    
    let enduranceAnalysis = '\n';
    enduranceAnalysis += '⏱️ 지속성 분석\n';
    enduranceAnalysis += '  - 테스트 시간: 4시간\n';
    enduranceAnalysis += '  - 성능 저하율: 측정 필요\n';
    enduranceAnalysis += '  - 메모리 누수: 모니터링 필요\n';
    enduranceAnalysis += '  - 안정성 평가: 시간별 비교\n\n';
    
    const fullSummary = summary + enduranceAnalysis;
    
    console.log(fullSummary);
    
    return {
        'stdout': fullSummary,
        'results/scenario4-endurance-test.json': JSON.stringify(data, null, 2),
        'results/scenario4-endurance-test.txt': fullSummary,
    };
}
