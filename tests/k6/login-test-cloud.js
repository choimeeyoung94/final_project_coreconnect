// ============================================
// k6 Cloud 로그인 부하 테스트
// ============================================
//
// 🚀 실행 방법:
//   k6 cloud login-test-cloud.js
//
// 📊 결과 확인:
//   실행 후 출력되는 URL에서 실시간 확인!
//
// ============================================

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { getTestUser } from './common/test-users.js';

// 커스텀 메트릭
const loginSuccessRate = new Rate('login_success_rate');
const loginDuration = new Trend('login_duration');
const loginCount = new Counter('login_count');
const errorCount = new Counter('error_count');

// k6 Cloud 설정
export const options = {
    // 테스트 시나리오
    stages: [
        { duration: '30s', target: 50 },   // Warm up: 50 VUs
        { duration: '1m', target: 100 },   // Ramp up: 100 VUs
        { duration: '2m', target: 100 },   // Stay: 100 VUs
        { duration: '30s', target: 0 },    // Ramp down: 0 VUs
    ],
    
    // 임계값 설정
    thresholds: {
        'http_req_duration': ['p(95)<500', 'p(99)<1000'],  // 95%는 500ms 이하
        'http_req_failed': ['rate<0.01'],                   // 에러율 1% 미만
        'login_success_rate': ['rate>0.99'],                // 로그인 성공률 99% 이상
        'checks': ['rate>0.95'],                            // 체크 성공률 95% 이상
    },
    
    // k6 Cloud 프로젝트 설정
    ext: {
        loadimpact: {
            projectID: 3706772,  // 기본값, Cloud에서 자동 할당
            name: 'CoreConnect - Login Load Test',
            distribution: {
                'amazon:ap:northeast:2': { loadZone: 'amazon:ap:northeast:2', percent: 100 }
            }
        }
    }
};

// 환경 변수
const BASE_URL = __ENV.BASE_URL || 'http://3.38.28.172:8080';

// 테스트 시작
export function setup() {
    console.log('========================================');
    console.log('🚀 k6 Cloud 부하 테스트 시작');
    console.log('========================================');
    console.log(`📍 대상 서버: ${BASE_URL}`);
    console.log(`👥 최대 가상 사용자: 100`);
    console.log(`⏱️  테스트 기간: 4분`);
    console.log('========================================');
    console.log('');
    console.log('📊 실시간 결과는 k6 Cloud 대시보드에서 확인하세요!');
    console.log('');
    
    return {
        startTime: new Date().toISOString()
    };
}

// 메인 테스트 함수
export default function () {
    const startTime = Date.now();
    
    // 각 VU마다 다른 사용자로 로그인
    const user = getTestUser(__VU);
    
    const payload = JSON.stringify({
        email: user.email,
        password: user.password
    });
    
    const params = {
        headers: { 
            'Content-Type': 'application/json' 
        },
        tags: {
            name: 'LoginAPI',
            endpoint: '/api/v1/auth/login'
        }
    };
    
    // 로그인 요청
    const response = http.post(
        `${BASE_URL}/api/v1/auth/login`, 
        payload, 
        params
    );
    
    // 응답 시간 측정
    const duration = Date.now() - startTime;
    loginDuration.add(duration);
    loginCount.add(1);
    
    // 응답 검증
    const loginSuccess = check(response, {
        '✅ 로그인 성공 (200)': (r) => r.status === 200,
        '✅ 응답에 이메일 포함': (r) => {
            try {
                const body = r.json();
                return body.email !== undefined;
            } catch (e) {
                return false;
            }
        },
        '✅ 쿠키에 토큰 포함': (r) => {
            return r.cookies && r.cookies.access_token !== undefined;
        },
        '⚡ 응답 시간 < 1초': (r) => r.timings.duration < 1000,
    });
    
    // 메트릭 기록
    loginSuccessRate.add(loginSuccess);
    
    if (!loginSuccess) {
        errorCount.add(1);
        console.error(`❌ 로그인 실패 [VU: ${__VU}] [User: ${user.email}] [Status: ${response.status}]`);
    }
    
    // 사용자 행동 시뮬레이션 (1-3초 대기)
    sleep(Math.random() * 2 + 1);
}

// 테스트 종료
export function teardown(data) {
    console.log('');
    console.log('========================================');
    console.log('🏁 k6 Cloud 테스트 완료!');
    console.log('========================================');
    console.log(`📅 시작 시간: ${data.startTime}`);
    console.log(`📅 종료 시간: ${new Date().toISOString()}`);
    console.log('');
    console.log('📊 상세 결과는 k6 Cloud 대시보드에서 확인하세요!');
    console.log('========================================');
}
