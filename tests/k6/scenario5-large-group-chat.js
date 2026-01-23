// ============================================
// 시나리오 5: 대규모 그룹 채팅 (Group Chat Test)
// ============================================
// 목적: 1:N 메시지 브로드캐스트 성능 측정
// 구성:
//   - 50명 × 10개 방 = 500명
//   - 100명 × 5개 방 = 500명
//   - 500명 × 2개 방 = 1,000명 (중복 없이)
// 총 사용자: 1,500명
// ============================================

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { getUserForVU } from './common/test-users.js';
import { login, WS_URL } from './common/api-client.js';
import {
    messagesSent,
    messagesReceived,
    messageSendDuration,
    broadcastDuration,
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
        { duration: '5m', target: 1500 },   // Ramp-up
        { duration: '10m', target: 1500 },  // 유지
    ],
    thresholds: {
        'message_send_duration': ['p(95)<100'],
        'broadcast_duration': ['p(95)<200'], // 브로드캐스트 지연
        'message_loss_rate': ['rate<0.01'],
    },
};

// ============================================
// 채팅방 할당 함수
// ============================================
function assignChatRoom(userId) {
    // 사용자 1-500: 50명 방 (방 1-10)
    if (userId <= 500) {
        return {
            roomId: Math.floor((userId - 1) / 50) + 1,
            roomSize: 50,
            roomType: 'small'
        };
    }
    // 사용자 501-1000: 100명 방 (방 11-15)
    else if (userId <= 1000) {
        return {
            roomId: Math.floor((userId - 501) / 100) + 11,
            roomSize: 100,
            roomType: 'medium'
        };
    }
    // 사용자 1001-1500: 500명 방 (방 16-17)
    else {
        return {
            roomId: Math.floor((userId - 1001) / 500) + 16,
            roomSize: 500,
            roomType: 'large'
        };
    }
}

// ============================================
// 메인 테스트 시나리오
// ============================================
export default function() {
    const user = getUserForVU(1500);
    const room = assignChatRoom(user.userId);
    
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
        
        const sentMessages = new Map(); // messageId -> sendTime
        let firstReceiveTime = null;
        let lastReceiveTime = null;
        
        socket.on('open', () => {
            console.log(`[${user.email}] Joined room ${room.roomId} (${room.roomSize} users, ${room.roomType})`);
            
            // 채팅방 참여
            socket.send(JSON.stringify({
                type: 'JOIN_ROOM',
                roomId: room.roomId
            }));
        });
        
        socket.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                messagesReceived.add(1);
                
                const receiveTime = Date.now();
                
                // 첫 수신 시간 기록
                if (!firstReceiveTime) {
                    firstReceiveTime = receiveTime;
                }
                
                // 마지막 수신 시간 업데이트
                lastReceiveTime = receiveTime;
                
                // 브로드캐스트 시간 측정 (내가 보낸 메시지)
                if (message.messageId && sentMessages.has(message.messageId)) {
                    const sendTime = sentMessages.get(message.messageId);
                    const broadcastTime = receiveTime - sendTime;
                    broadcastDuration.add(broadcastTime);
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
        
        // 메시지 전송 빈도: 방 크기에 따라 조정
        let sendIntervalMs;
        if (room.roomSize <= 50) {
            sendIntervalMs = 10000;  // 10초마다
        } else if (room.roomSize <= 100) {
            sendIntervalMs = 20000;  // 20초마다
        } else {
            sendIntervalMs = 30000;  // 30초마다 (대규모 방)
        }
        
        let messageCount = 0;
        const sendInterval = socket.setInterval(() => {
            const messageId = `${user.userId}-${Date.now()}-${messageCount++}`;
            const sendStart = Date.now();
            
            try {
                socket.send(JSON.stringify({
                    type: 'SEND_MESSAGE',
                    messageId: messageId,
                    roomId: room.roomId,
                    content: `Group chat test from ${room.roomType} room (${room.roomSize} users)`
                }));
                
                messagesSent.add(1);
                messageSendDuration.add(Date.now() - sendStart);
                sentMessages.set(messageId, sendStart);
                
            } catch (e) {
                messageErrors.add(1);
            }
        }, sendIntervalMs);
        
        // 15분 후 종료
        socket.setTimeout(() => {
            // 브로드캐스트 전체 시간 (첫 수신 ~ 마지막 수신)
            if (firstReceiveTime && lastReceiveTime) {
                const totalBroadcastTime = lastReceiveTime - firstReceiveTime;
                console.log(`[${user.email}] Total broadcast time: ${totalBroadcastTime}ms for room ${room.roomId} (${room.roomSize} users)`);
            }
            
            if (sentMessages.size > 0) {
                messageLossRate.add(1);
            } else {
                messageLossRate.add(0);
            }
            
            socket.clearInterval(sendInterval);
            socket.close();
        }, 900000);  // 15분
    });
    
    sleep(1);
}

// ============================================
// 테스트 종료 후 요약
// ============================================
export function handleSummary(data) {
    const summary = generateSummary(data);
    
    let groupAnalysis = '\n';
    groupAnalysis += '👥 대규모 그룹 채팅 분석\n';
    groupAnalysis += '  - 50명 방 × 10개: 브로드캐스트 시간 측정\n';
    groupAnalysis += '  - 100명 방 × 5개: 브로드캐스트 시간 측정\n';
    groupAnalysis += '  - 500명 방 × 2개: 브로드캐스트 시간 측정\n';
    groupAnalysis += '  - 마지막 사용자 수신 시간: 중요 지표\n\n';
    
    if (data.metrics.broadcast_duration) {
        groupAnalysis += '📊 브로드캐스트 성능\n';
        groupAnalysis += `  - P50: ${(data.metrics.broadcast_duration.values['p(50)'] || 0).toFixed(2)}ms\n`;
        groupAnalysis += `  - P95: ${(data.metrics.broadcast_duration.values['p(95)'] || 0).toFixed(2)}ms\n`;
        groupAnalysis += `  - P99: ${(data.metrics.broadcast_duration.values['p(99)'] || 0).toFixed(2)}ms\n\n`;
    }
    
    const fullSummary = summary + groupAnalysis;
    
    console.log(fullSummary);
    
    return {
        'stdout': fullSummary,
        'results/scenario5-large-group-chat.json': JSON.stringify(data, null, 2),
        'results/scenario5-large-group-chat.txt': fullSummary,
    };
}
