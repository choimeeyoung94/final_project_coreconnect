// ============================================
// 공통: 향상된 메트릭 정의
// ============================================

import { Trend, Counter, Rate, Gauge } from 'k6/metrics';

// 처리량 (Throughput) - 초당 처리된 요청 수
export const requestThroughput = new Counter('request_throughput');
export const dataThroughput = new Counter('data_throughput_bytes');

// TPS (Transactions Per Second) - 초당 트랜잭션 수
export const transactionsPerSecond = new Counter('transactions_total');
export const loginTPS = new Counter('login_tps');
export const chatRoomTPS = new Counter('chatroom_tps');
export const messageTPS = new Counter('message_tps');
export const notificationTPS = new Counter('notification_tps');

// 지연시간 (Latency) - 응답 시간 (밀리초)
export const loginLatency = new Trend('login_latency_ms');
export const chatRoomLatency = new Trend('chatroom_latency_ms');
export const messageLatency = new Trend('message_latency_ms');
export const notificationLatency = new Trend('notification_latency_ms');
export const apiLatency = new Trend('api_latency_ms');

// 성공률
export const loginSuccessRate = new Rate('login_success_rate');
export const apiSuccessRate = new Rate('api_success_rate');
export const transactionSuccessRate = new Rate('transaction_success_rate');

// 에러율
export const errorRate = new Rate('error_rate');
export const http4xxRate = new Rate('http_4xx_rate');
export const http5xxRate = new Rate('http_5xx_rate');

// 동시 접속자 (현재 활성 사용자)
export const activeUsers = new Gauge('active_users');
export const peakUsers = new Gauge('peak_users');

// WebSocket 메트릭
export const wsConnectionDuration = new Trend('ws_connection_duration_ms');
export const wsMessageLatency = new Trend('ws_message_latency_ms');
export const wsMessagesReceived = new Counter('ws_messages_received');
export const wsMessagesSent = new Counter('ws_messages_sent');
export const wsConnectionErrors = new Counter('ws_connection_errors');

// 응답 시간 백분위수
export const responseTime_P50 = new Trend('response_time_p50_ms');
export const responseTime_P90 = new Trend('response_time_p90_ms');
export const responseTime_P95 = new Trend('response_time_p95_ms');
export const responseTime_P99 = new Trend('response_time_p99_ms');

// 비즈니스 메트릭
export const chatRoomsCreated = new Counter('chatrooms_created');
export const messagesSuccessfullySent = new Counter('messages_sent_success');
export const notificationsDelivered = new Counter('notifications_delivered');
