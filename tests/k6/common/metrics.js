// ============================================
// 공통: Custom Metrics
// ============================================

import { Counter, Trend, Rate, Gauge } from 'k6/metrics';

// 처리량 (Throughput)
export const messagesSent = new Counter('messages_sent');
export const messagesReceived = new Counter('messages_received');
export const notificationsSent = new Counter('notifications_sent');
export const chatRoomsCreated = new Counter('chatrooms_created');

// 응답 시간 (Latency)
export const loginDuration = new Trend('login_duration');
export const messageSendDuration = new Trend('message_send_duration');
export const messageReceiveDuration = new Trend('message_receive_duration');
export const messageE2EDuration = new Trend('message_e2e_duration'); // End-to-End
export const notificationDuration = new Trend('notification_duration');
export const chatRoomListDuration = new Trend('chatroom_list_duration');
export const messageHistoryDuration = new Trend('message_history_duration');
export const wsConnectionDuration = new Trend('ws_connection_duration');
export const broadcastDuration = new Trend('broadcast_duration');

// 안정성 (Reliability)
export const messageErrors = new Counter('message_errors');
export const messageLossRate = new Rate('message_loss_rate');
export const loginErrors = new Counter('login_errors');
export const wsConnectionErrors = new Counter('ws_connection_errors');
export const wsReconnections = new Counter('ws_reconnections');
export const apiErrors = new Counter('api_errors');
export const timeouts = new Counter('timeouts');

// 리소스 (Resource) - 참고용
export const activeConnections = new Gauge('active_ws_connections');
export const messagesInQueue = new Gauge('messages_in_queue');

/**
 * 테스트 결과 요약 생성
 * @param {object} data - k6 데이터 객체
 * @returns {string} 요약 텍스트
 */
export function generateSummary(data) {
    const duration = data.state.testRunDurationMs / 1000; // 초 단위
    
    // 처리량 계산
    const sentCount = data.metrics.messages_sent?.values.count || 0;
    const receivedCount = data.metrics.messages_received?.values.count || 0;
    const tps = sentCount / duration;
    
    // 에러율 계산
    const errorCount = data.metrics.message_errors?.values.count || 0;
    const errorRate = sentCount > 0 ? (errorCount / sentCount) * 100 : 0;
    
    // 메시지 유실률
    const lossRate = data.metrics.message_loss_rate?.values.rate || 0;
    
    let summary = '\n';
    summary += '============================================\n';
    summary += '테스트 결과 요약\n';
    summary += '============================================\n\n';
    
    summary += '📊 처리량 (Throughput)\n';
    summary += `  - 총 메시지 전송: ${sentCount}개\n`;
    summary += `  - 총 메시지 수신: ${receivedCount}개\n`;
    summary += `  - TPS (초당 처리): ${tps.toFixed(2)}\n`;
    summary += `  - 테스트 시간: ${duration.toFixed(0)}초\n\n`;
    
    if (data.metrics.message_send_duration) {
        summary += '⚡ 응답 시간 (Latency)\n';
        summary += `  - 메시지 전송 P50: ${(data.metrics.message_send_duration.values['p(50)'] || 0).toFixed(2)}ms\n`;
        summary += `  - 메시지 전송 P95: ${(data.metrics.message_send_duration.values['p(95)'] || 0).toFixed(2)}ms\n`;
        summary += `  - 메시지 전송 P99: ${(data.metrics.message_send_duration.values['p(99)'] || 0).toFixed(2)}ms\n`;
        summary += `  - 로그인 평균: ${(data.metrics.login_duration?.values.avg || 0).toFixed(2)}ms\n\n`;
    }
    
    summary += '🛡️ 안정성 (Reliability)\n';
    summary += `  - 메시지 유실률: ${(lossRate * 100).toFixed(3)}%\n`;
    summary += `  - 에러 발생: ${errorCount}건\n`;
    summary += `  - 에러율: ${errorRate.toFixed(2)}%\n\n`;
    
    summary += '🎯 목표 달성 여부\n';
    summary += `  - TPS > 450: ${tps > 450 ? '✅ 통과' : '❌ 실패'} (${tps.toFixed(0)})\n`;
    
    if (data.metrics.message_send_duration) {
        const p95 = data.metrics.message_send_duration.values['p(95)'] || 0;
        summary += `  - P95 < 50ms: ${p95 < 50 ? '✅ 통과' : '❌ 실패'} (${p95.toFixed(2)}ms)\n`;
    }
    
    summary += `  - 유실률 < 0.1%: ${lossRate < 0.001 ? '✅ 통과' : '❌ 실패'} (${(lossRate * 100).toFixed(3)}%)\n`;
    summary += `  - 에러율 < 1%: ${errorRate < 1 ? '✅ 통과' : '❌ 실패'} (${errorRate.toFixed(2)}%)\n\n`;
    
    summary += '============================================\n';
    
    return summary;
}
