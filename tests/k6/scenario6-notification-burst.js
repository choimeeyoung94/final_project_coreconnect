// ============================================
// 시나리오 6: 알림 폭주 (Notification Burst)
// ============================================
// 목적: 대량 알림 발송 시 성능 측정
// 구성:
//   - 1:1 메시지 알림: 5,000개/초
//   - 그룹 멘션: 100명 × 50회
//   - 시스템 공지: 전체 10,000명
// ============================================

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { getUserForVU } from './common/test-users.js';
import { login, WS_URL } from './common/api-client.js';
import {
    messagesSent,
    messagesReceived,
    notificationsSent,
    notificationDuration,
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
        { duration: '2m', target: 10000 },   // Ramp-up: 10,000명
        { duration: '3m', target: 10000 },   // 알림 폭주 테스트
    ],
    thresholds: {
        'notification_duration': ['p(95)<1000'], // 알림 1초 이내
        'message_loss_rate': ['rate<0.02'],      // 유실률 2% 이하
    },
};

// ============================================
// 메인 테스트 시나리오
// ============================================
export default function() {
    const user = getUserForVU(10000);
    
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
        
        const sentNotifications = new Map(); // notificationId -> sendTime
        let notificationReceivedCount = 0;
        
        socket.on('open', () => {
            // 채팅방 참여 (알림 수신용)
            const roomId = Math.floor(Math.random() * 100) + 1;
            socket.send(JSON.stringify({
                type: 'JOIN_ROOM',
                roomId: roomId
            }));
        });
        
        socket.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                
                // 알림 메시지 수신
                if (message.type === 'NOTIFICATION' || message.isNotification) {
                    messagesReceived.add(1);
                    notificationReceivedCount++;
                    
                    // 알림 지연 시간 측정
                    if (message.notificationId && sentNotifications.has(message.notificationId)) {
                        const sendTime = sentNotifications.get(message.notificationId);
                        const latency = Date.now() - sendTime;
                        notificationDuration.add(latency);
                        sentNotifications.delete(message.notificationId);
                    }
                } else {
                    messagesReceived.add(1);
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
        
        // 시나리오별 알림 전송
        
        // 1. 1:1 메시지 알림 (전체 사용자 중 일부가 발송)
        // 사용자 1-5000: 알림 발송자
        if (user.userId <= 5000) {
            let notificationCount = 0;
            
            // 초당 1개씩 알림 발송 (총 5분)
            const notificationInterval = socket.setInterval(() => {
                const notificationId = `1to1-${user.userId}-${Date.now()}-${notificationCount++}`;
                const targetUserId = Math.floor(Math.random() * 10000) + 1;
                const sendTime = Date.now();
                
                try {
                    socket.send(JSON.stringify({
                        type: 'SEND_NOTIFICATION',
                        notificationId: notificationId,
                        targetUserId: targetUserId,
                        content: `1:1 notification from user ${user.userId}`,
                        category: 'DIRECT_MESSAGE'
                    }));
                    
                    notificationsSent.add(1);
                    sentNotifications.set(notificationId, sendTime);
                    
                } catch (e) {
                    messageErrors.add(1);
                }
            }, 1000);  // 1초마다
            
            // 5분 후 중지
            socket.setTimeout(() => {
                socket.clearInterval(notificationInterval);
            }, 300000);
        }
        
        // 2. 그룹 멘션 알림 (사용자 5001-5050이 발송)
        if (user.userId >= 5001 && user.userId <= 5050) {
            let mentionCount = 0;
            
            // 10초마다 100명에게 멘션 알림
            const mentionInterval = socket.setInterval(() => {
                const notificationId = `mention-${user.userId}-${Date.now()}-${mentionCount++}`;
                const sendTime = Date.now();
                
                try {
                    // 100명에게 멘션
                    const targetUsers = [];
                    for (let i = 0; i < 100; i++) {
                        targetUsers.push(Math.floor(Math.random() * 10000) + 1);
                    }
                    
                    socket.send(JSON.stringify({
                        type: 'SEND_GROUP_MENTION',
                        notificationId: notificationId,
                        targetUserIds: targetUsers,
                        content: `Group mention from user ${user.userId}`,
                        category: 'MENTION'
                    }));
                    
                    notificationsSent.add(100); // 100명에게 발송
                    sentNotifications.set(notificationId, sendTime);
                    
                } catch (e) {
                    messageErrors.add(1);
                }
            }, 10000);  // 10초마다
            
            // 5분 후 중지
            socket.setTimeout(() => {
                socket.clearInterval(mentionInterval);
            }, 300000);
        }
        
        // 3. 시스템 공지 (사용자 1이 발송)
        if (user.userId === 1) {
            // 1분 후 전체 공지 1회
            socket.setTimeout(() => {
                const notificationId = `system-announce-${Date.now()}`;
                const sendTime = Date.now();
                
                try {
                    socket.send(JSON.stringify({
                        type: 'SEND_SYSTEM_ANNOUNCEMENT',
                        notificationId: notificationId,
                        content: 'System-wide announcement to all 10,000 users',
                        category: 'ANNOUNCEMENT'
                    }));
                    
                    notificationsSent.add(10000); // 전체 사용자에게
                    sentNotifications.set(notificationId, sendTime);
                    
                    console.log('System announcement sent to 10,000 users');
                    
                } catch (e) {
                    messageErrors.add(1);
                }
            }, 60000);  // 1분 후
        }
        
        // 5분 후 종료
        socket.setTimeout(() => {
            console.log(`[${user.email}] Received ${notificationReceivedCount} notifications`);
            
            if (sentNotifications.size > 0) {
                messageLossRate.add(1);
                console.warn(`[${user.email}] Lost ${sentNotifications.size} notifications`);
            } else {
                messageLossRate.add(0);
            }
            
            socket.close();
        }, 300000);  // 5분
    });
    
    sleep(1);
}

// ============================================
// 테스트 종료 후 요약
// ============================================
export function handleSummary(data) {
    const summary = generateSummary(data);
    
    const notificationCount = data.metrics.notifications_sent?.values.count || 0;
    const receivedCount = data.metrics.messages_received?.values.count || 0;
    const duration = data.state.testRunDurationMs / 1000;
    const notificationTPS = notificationCount / duration;
    
    let notificationAnalysis = '\n';
    notificationAnalysis += '🔔 알림 폭주 분석\n';
    notificationAnalysis += `  - 총 발송 알림: ${notificationCount}개\n`;
    notificationAnalysis += `  - 알림 TPS: ${notificationTPS.toFixed(2)}\n`;
    notificationAnalysis += `  - 1:1 메시지: 5,000 TPS 목표\n`;
    notificationAnalysis += `  - 그룹 멘션: 50회 × 100명\n`;
    notificationAnalysis += `  - 시스템 공지: 10,000명 동시 발송\n\n`;
    
    if (data.metrics.notification_duration) {
        notificationAnalysis += '📊 알림 지연 시간\n';
        notificationAnalysis += `  - P50: ${(data.metrics.notification_duration.values['p(50)'] || 0).toFixed(2)}ms\n`;
        notificationAnalysis += `  - P95: ${(data.metrics.notification_duration.values['p(95)'] || 0).toFixed(2)}ms\n`;
        notificationAnalysis += `  - P99: ${(data.metrics.notification_duration.values['p(99)'] || 0).toFixed(2)}ms\n\n`;
    }
    
    const fullSummary = summary + notificationAnalysis;
    
    console.log(fullSummary);
    
    return {
        'stdout': fullSummary,
        'results/scenario6-notification-burst.json': JSON.stringify(data, null, 2),
        'results/scenario6-notification-burst.txt': fullSummary,
    };
}
