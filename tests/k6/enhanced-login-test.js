// ============================================
// 향상된 로그인 부하 테스트
// 처리량, 지연시간, TPS, Latency 측정 포함
// ============================================

import http from 'k6/http';
import { check, sleep } from 'k6';
import { getTestUser } from './common/test-users.js';
import * as metrics from './common/metrics-enhanced.js';

export const options = {
    stages: [
        { duration: '30s', target: 50 },   // Ramp-up: 30초간 50 VU로 증가
        { duration: '2m', target: 100 },   // Load: 2분간 100 VU 유지
        { duration: '1m', target: 200 },   // Peak: 1분간 200 VU로 증가
        { duration: '1m', target: 100 },   // Cool-down: 1분간 100 VU로 감소
        { duration: '30s', target: 0 },    // Ramp-down: 30초간 0으로 감소
    ],
    thresholds: {
        // 처리량 임계값
        'request_throughput': ['count>1000'],
        
        // TPS 임계값
        'login_tps': ['count>500'],
        
        // 지연시간 임계값 (95%가 2초 이하)
        'login_latency_ms': ['p(95)<2000'],
        
        // 성공률 임계값 (95% 이상 성공)
        'login_success_rate': ['rate>0.95'],
        
        // 에러율 임계값 (5% 이하)
        'error_rate': ['rate<0.05'],
        
        // HTTP 요청 시간 임계값
        'http_req_duration': ['p(95)<2000', 'p(99)<3000'],
        
        // HTTP 요청 실패율 (1% 이하)
        'http_req_failed': ['rate<0.01'],
    },
};

export default function () {
    const user = getTestUser(__VU);
    const startTime = Date.now();
    
    // 활성 사용자 수 기록
    metrics.activeUsers.add(__VU);
    metrics.peakUsers.add(__VU);
    
    // 로그인 요청
    const payload = JSON.stringify({
        email: user.email,
        password: user.password
    });
    
    const params = {
        headers: { 'Content-Type': 'application/json' },
        timeout: '30s',
    };
    
    const requestStart = Date.now();
    const response = http.post(`${__ENV.BASE_URL}/api/v1/auth/login`, payload, params);
    const requestDuration = Date.now() - requestStart;
    
    // 메트릭 기록
    
    // 1. 처리량 (Throughput)
    metrics.requestThroughput.add(1);
    metrics.dataThroughput.add(response.body ? response.body.length : 0);
    
    // 2. TPS (Transactions Per Second)
    metrics.transactionsPerSecond.add(1);
    metrics.loginTPS.add(1);
    
    // 3. 지연시간 (Latency)
    metrics.loginLatency.add(requestDuration);
    metrics.apiLatency.add(requestDuration);
    
    // 4. 응답 시간 백분위수
    metrics.responseTime_P50.add(requestDuration);
    metrics.responseTime_P90.add(requestDuration);
    metrics.responseTime_P95.add(requestDuration);
    metrics.responseTime_P99.add(requestDuration);
    
    // 5. 성공률 및 에러율 체크
    const loginSuccess = check(response, {
        'login status is 200': (r) => r.status === 200,
        'response has user data': (r) => {
            try {
                const body = r.json();
                return body && body.email !== undefined;
            } catch (e) {
                return false;
            }
        },
        'response time < 3s': (r) => requestDuration < 3000,
        'response time < 5s': (r) => requestDuration < 5000,
    });
    
    // 성공률 기록
    metrics.loginSuccessRate.add(loginSuccess);
    metrics.apiSuccessRate.add(loginSuccess);
    metrics.transactionSuccessRate.add(loginSuccess);
    
    // 에러율 기록
    const hasError = response.status >= 400;
    metrics.errorRate.add(hasError);
    
    if (response.status >= 400 && response.status < 500) {
        metrics.http4xxRate.add(1);
    } else if (response.status >= 500) {
        metrics.http5xxRate.add(1);
    }
    
    // 디버그 로그 (실패 시)
    if (!loginSuccess || hasError) {
        console.log(`[ERROR] Login failed - VU: ${__VU}, Email: ${user.email}, Status: ${response.status}, Duration: ${requestDuration}ms`);
    }
    
    // 사용자 시뮬레이션: 로그인 후 잠시 대기
    sleep(1 + Math.random() * 2); // 1-3초 랜덤 대기
}

// 테스트 완료 후 요약
export function handleSummary(data) {
    return {
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
        'summary.json': JSON.stringify(data),
    };
}

function textSummary(data, options) {
    const indent = options.indent || '';
    const enableColors = options.enableColors || false;
    
    let summary = '\n';
    summary += `${indent}========================================\n`;
    summary += `${indent}부하 테스트 결과 요약\n`;
    summary += `${indent}========================================\n\n`;
    
    // 처리량
    summary += `${indent}📊 처리량 (Throughput)\n`;
    summary += `${indent}  - 총 요청 수: ${data.metrics.request_throughput ? data.metrics.request_throughput.values.count : 0}\n`;
    summary += `${indent}  - 전송 데이터: ${formatBytes(data.metrics.data_throughput_bytes ? data.metrics.data_throughput_bytes.values.count : 0)}\n\n`;
    
    // TPS
    summary += `${indent}⚡ TPS (Transactions Per Second)\n`;
    summary += `${indent}  - 로그인 TPS: ${data.metrics.login_tps ? Math.round(data.metrics.login_tps.values.count / (data.state.testRunDurationMs / 1000)) : 0} req/s\n\n`;
    
    // 지연시간
    summary += `${indent}⏱️  지연시간 (Latency)\n`;
    summary += `${indent}  - 평균: ${data.metrics.login_latency_ms ? Math.round(data.metrics.login_latency_ms.values.avg) : 0}ms\n`;
    summary += `${indent}  - 중간값 (P50): ${data.metrics.login_latency_ms ? Math.round(data.metrics.login_latency_ms.values.med) : 0}ms\n`;
    summary += `${indent}  - P95: ${data.metrics.login_latency_ms ? Math.round(data.metrics.login_latency_ms.values['p(95)']) : 0}ms\n`;
    summary += `${indent}  - P99: ${data.metrics.login_latency_ms ? Math.round(data.metrics.login_latency_ms.values['p(99)']) : 0}ms\n\n`;
    
    // 성공률
    summary += `${indent}✅ 성공률\n`;
    summary += `${indent}  - 로그인 성공률: ${data.metrics.login_success_rate ? (data.metrics.login_success_rate.values.rate * 100).toFixed(2) : 0}%\n`;
    summary += `${indent}  - 에러율: ${data.metrics.error_rate ? (data.metrics.error_rate.values.rate * 100).toFixed(2) : 0}%\n\n`;
    
    summary += `${indent}========================================\n\n`;
    
    return summary;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
