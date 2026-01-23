// ============================================
// 시나리오 1: 일반 채팅 (Baseline Test)
// ============================================
// 목적: 정상 상황에서의 기본 성능 측정
// 사용자: 1,000명
// 기간: 10분
// 메시지 빈도: 5초당 1개
// ============================================

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { getUserForVU } from './common/test-users.js';
import { login, getChatRooms, getMessages, BASE_URL, WS_URL } from './common/api-client.js';
import {
    messagesSent,
    messagesReceived,
    loginDuration,
    messageSendDuration,
    messageE2EDuration,
    wsConnectionDuration,
    chatRoomListDuration,
    messageHistoryDuration,
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
        { duration: '5m', target: 1000 },   // Ramp-up: 5분간 1,000명까지 증가
        { duration: '5m', target: 1000 },   // 안정화: 5분간 1,000명 유지
    ],
    thresholds: {
        // 목표: P95 응답 시간
        'message_send_duration': ['p(95)<50', 'p(99)<100'],
        
        // 목표: 에러율 1% 이하
        'http_req_failed': ['rate<0.01'],
        
        // 목표: WebSocket 연결 성공률
        'ws_connecting': ['avg<3000'],
        
        // 목표: 메시지 유실률 0.1% 이하
        'message_loss_rate': ['rate<0.001'],
    },
};

// ============================================
// 메인 테스트 시나리오
// ============================================
export default function() {
    // 1. 사용자 선택 (1-1000)
    const user = getUserForVU(1000);
    
    // 2. 로그인
    const loginStart = Date.now();
    const token = login(user.email, user.password);
    
    if (!token) {
        loginErrors.add(1);
        sleep(5);
        return;
    }
    
    loginDuration.add(Date.now() - loginStart);
    
    // 3. WebSocket 연결
    const wsStart = Date.now();
    const url = `${WS_URL}?token=${token}`;
    
    ws.connect(url, {}, function(socket) {
        wsConnectionDuration.add(Date.now() - wsStart);
        activeConnections.add(1);
        
        // 메시지 추적
        const sentMessages = new Map(); // messageId -> timestamp
        
        socket.on('open', () => {
            console.log(`[${user.email}] WebSocket connected`);
            
            // 채팅방 3개에 랜덤 참여
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
                
                // End-to-End 시간 측정
                if (message.messageId && sentMessages.has(message.messageId)) {
                    const sendTime = sentMessages.get(message.messageId);
                    const e2eTime = Date.now() - sendTime;
                    messageE2EDuration.add(e2eTime);
                    sentMessages.delete(message.messageId);
                }
            } catch (e) {
                console.error(`Failed to parse message: ${e}`);
            }
        });
        
        socket.on('error', (e) => {
            console.error(`WebSocket error for ${user.email}: ${e}`);
            wsConnectionErrors.add(1);
            messageErrors.add(1);
        });
        
        socket.on('close', () => {
            activeConnections.add(-1);
        });
        
        // 5초마다 메시지 전송 (총 10분 = 120개 메시지)
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
                    content: `Test message from ${user.name} at ${new Date().toISOString()}`
                }));
                
                messagesSent.add(1);
                messageSendDuration.add(Date.now() - sendStart);
                sentMessages.set(messageId, Date.now());
                
            } catch (e) {
                console.error(`Failed to send message: ${e}`);
                messageErrors.add(1);
            }
        }, 5000);  // 5초마다
        
        // 10초마다 채팅방 목록 조회
        const roomListInterval = socket.setInterval(() => {
            const start = Date.now();
            const response = getChatRooms(token);
            
            check(response, {
                'chatroom list success': (r) => r.status === 200
            });
            
            chatRoomListDuration.add(Date.now() - start);
        }, 10000);  // 10초마다
        
        // 30초마다 메시지 히스토리 조회
        const historyInterval = socket.setInterval(() => {
            const roomId = Math.floor(Math.random() * 100) + 1;
            const start = Date.now();
            const response = getMessages(token, roomId, 0, 100);
            
            check(response, {
                'message history success': (r) => r.status === 200
            });
            
            messageHistoryDuration.add(Date.now() - start);
        }, 30000);  // 30초마다
        
        // 10분 후 연결 종료 및 메시지 유실률 계산
        socket.setTimeout(() => {
            // 남은 메시지 = 유실된 메시지
            const lostCount = sentMessages.size;
            if (lostCount > 0) {
                messageLossRate.add(1);
                console.warn(`[${user.email}] Lost ${lostCount} messages`);
            } else {
                messageLossRate.add(0);
            }
            
            // Interval 정리
            socket.clearInterval(sendInterval);
            socket.clearInterval(roomListInterval);
            socket.clearInterval(historyInterval);
            
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
    const summary = generateSummary(data);
    
    console.log(summary);
    
    return {
        'stdout': summary,
        'results/scenario1-baseline-chat.json': JSON.stringify(data, null, 2),
        'results/scenario1-baseline-chat.txt': summary,
    };
}
