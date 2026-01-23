// ============================================
// 공통: 테스트 사용자 관리
// ============================================

/**
 * 테스트 사용자 정보 생성
 * @param {number} userId - 사용자 ID (1-10000)
 * @returns {object} 사용자 정보
 */
export function getTestUser(userId) {
    const userNumber = String(userId).padStart(5, '0');
    return {
        userId: userId,
        email: `testuser${userNumber}@loadtest.com`,
        password: 'password',
        name: `테스트유저${userNumber}`,
        employeeNumber: `EMP${userNumber}`
    };
}

/**
 * VU 번호 기반 사용자 선택
 * @param {number} maxUsers - 최대 사용자 수
 * @returns {object} 사용자 정보
 */
export function getUserForVU(maxUsers = 10000) {
    const userId = (__VU % maxUsers) + 1;
    return getTestUser(userId);
}

/**
 * 랜덤 사용자 선택
 * @param {number} maxUsers - 최대 사용자 수
 * @returns {object} 사용자 정보
 */
export function getRandomUser(maxUsers = 10000) {
    const userId = Math.floor(Math.random() * maxUsers) + 1;
    return getTestUser(userId);
}
