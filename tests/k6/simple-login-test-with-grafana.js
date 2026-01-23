// ============================================
// 로그인 부하 테스트 (Grafana 링크 포함)
// ============================================
//
// 🚀 실행 방법:
// 
// 방법 1: 스크립트 사용 (권장)
//   chmod +x run-login-test.sh
//   ./run-login-test.sh
//
// 방법 2: 직접 실행
//   BASE_URL=http://3.38.28.172:8080 \
//   GRAFANA_URL=http://3.38.28.172:3000 \
//   k6 run --out influxdb=http://localhost:8086/k6 \
//   simple-login-test-with-grafana.js
//
// 방법 3: 커스텀 설정
//   VUS=200 DURATION=5m ./run-login-test.sh
//
// ============================================

import http from 'k6/http';
import { check, sleep } from 'k6';
import { getTestUser } from './common/test-users.js';

// Grafana 설정
const GRAFANA_URL = __ENV.GRAFANA_URL || 'http://3.38.28.172:3000';
const GRAFANA_DASHBOARD_UID = __ENV.GRAFANA_DASHBOARD_UID || 'k6-load-test';

export const options = {
    vus: 100,
    duration: '2m',
};

// 테스트 시작 시 Grafana 링크 출력
export function setup() {
    const now = new Date();
    const startTime = now.toISOString();
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 k6 부하 테스트 시작');
    console.log('='.repeat(80));
    console.log(`🕐 시작 시간: ${startTime}`);
    console.log(`👥 가상 사용자: ${options.vus}`);
    console.log(`⏱️  테스트 기간: ${options.duration}`);
    console.log('='.repeat(80));
    console.log('📈 실시간 모니터링:');
    console.log(`   Grafana: ${GRAFANA_URL}/d/${GRAFANA_DASHBOARD_UID}`);
    console.log(`   InfluxDB: http://localhost:8086`);
    console.log('='.repeat(80) + '\n');
    
    return { startTime: now.getTime() };
}

export default function () {
    const user = getTestUser(__VU);
    
    const payload = JSON.stringify({
        email: user.email,
        password: user.password
    });
    
    const params = {
        headers: { 'Content-Type': 'application/json' },
    };
    
    const response = http.post(`${__ENV.BASE_URL}/api/v1/auth/login`, payload, params);
    
    check(response, {
        'login successful': (r) => r.status === 200,
        'has user email': (r) => {
            try {
                return r.json().email !== undefined;
            } catch (e) {
                return false;
            }
        },
    });
    
    sleep(1);
}

// 안전하게 숫자를 포맷하는 헬퍼 함수
function safeToFixed(value, decimals) {
    if (value === undefined || value === null || isNaN(value)) {
        return 'N/A';
    }
    return Number(value).toFixed(decimals);
}

// 테스트 완료 후 요약 및 Grafana 링크 출력
export function handleSummary(data) {
    const endTime = new Date();
    const duration = (endTime.getTime() - (data.state.isLocal ? 0 : 0)) / 1000;
    
    // 콘솔 출력
    let summary = '\n' + '='.repeat(80) + '\n';
    summary += '✅ k6 부하 테스트 완료\n';
    summary += '='.repeat(80) + '\n\n';
    
    // 기본 통계
    summary += '📊 테스트 결과 요약:\n';
    summary += '─'.repeat(80) + '\n';
    
    if (data.metrics.checks && data.metrics.checks.values) {
        const checksRate = safeToFixed(data.metrics.checks.values.rate * 100, 2);
        summary += `✅ 체크 성공률: ${checksRate}%\n`;
    }
    
    if (data.metrics.http_reqs && data.metrics.http_reqs.values) {
        const totalReqs = data.metrics.http_reqs.values.count || 0;
        const reqRate = safeToFixed(data.metrics.http_reqs.values.rate, 2);
        summary += `📨 총 요청 수: ${totalReqs}\n`;
        summary += `⚡ 초당 요청 (TPS): ${reqRate} req/s\n`;
    }
    
    if (data.metrics.http_req_duration && data.metrics.http_req_duration.values) {
        const values = data.metrics.http_req_duration.values;
        const avgDuration = safeToFixed(values.avg, 2);
        const p95Duration = safeToFixed(values['p(95)'], 2);
        const p99Duration = safeToFixed(values['p(99)'], 2);
        summary += `⏱️  평균 응답 시간: ${avgDuration}ms\n`;
        summary += `📈 P95 응답 시간: ${p95Duration}ms\n`;
        summary += `📈 P99 응답 시간: ${p99Duration}ms\n`;
    }
    
    if (data.metrics.http_req_failed && data.metrics.http_req_failed.values) {
        const failRate = safeToFixed(data.metrics.http_req_failed.values.rate * 100, 2);
        summary += `❌ 실패율: ${failRate}%\n`;
    }
    
    if (data.metrics.vus_max && data.metrics.vus_max.values) {
        const maxVUs = data.metrics.vus_max.values.max || 0;
        summary += `👥 최대 동시 사용자: ${maxVUs}\n`;
    }
    
    summary += '\n' + '─'.repeat(80) + '\n';
    summary += '📊 상세 결과 확인:\n';
    summary += '─'.repeat(80) + '\n';
    
    // Grafana 링크
    const timeRange = 'from=now-15m&to=now';
    summary += `\n🎯 Grafana 대시보드:\n`;
    summary += `   ${GRAFANA_URL}/d/${GRAFANA_DASHBOARD_UID}?${timeRange}\n`;
    
    // 직접 접속 가능한 링크들
    summary += `\n📈 추가 모니터링 링크:\n`;
    summary += `   • Grafana 홈: ${GRAFANA_URL}\n`;
    summary += `   • InfluxDB: http://localhost:8086\n`;
    summary += `   • Explore 데이터: ${GRAFANA_URL}/explore\n`;
    
    summary += '\n' + '='.repeat(80) + '\n';
    summary += '💡 팁: 위 링크를 Ctrl+클릭 하면 브라우저에서 바로 열립니다!\n';
    summary += '='.repeat(80) + '\n\n';
    
    // 파일로도 저장
    const jsonSummary = JSON.stringify(data, null, 2);
    
    return {
        'stdout': summary,
        'summary.json': jsonSummary,
    };
}

export function teardown(data) {
    console.log('\n🏁 테스트 종료\n');
}
