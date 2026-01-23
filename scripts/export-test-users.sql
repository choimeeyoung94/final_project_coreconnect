-- ============================================
-- 부하 테스트용 사용자 데이터 추출 스크립트
-- ============================================
-- 목적: k6 테스트 스크립트에서 사용할 사용자 목록 생성
-- ============================================

USE db_coreconnect;

-- ============================================
-- 1. JSON 배열 형식으로 추출 (k6에서 바로 사용)
-- ============================================

SELECT JSON_ARRAYAGG(
    JSON_OBJECT(
        'userId', user_id,
        'email', user_email,
        'password', 'password',
        'name', user_name,
        'employeeNumber', user_employee_number
    )
) AS test_users_json
FROM users 
WHERE user_email LIKE 'testuser%@loadtest.com'
ORDER BY user_id ASC;

-- ============================================
-- 2. 시나리오별 사용자 목록 추출
-- ============================================

-- 시나리오 1: 일반 채팅 (1,000명)
SELECT 
    user_id,
    user_email,
    'password' AS password,
    user_name
FROM users 
WHERE user_email LIKE 'testuser%@loadtest.com'
ORDER BY user_id ASC
LIMIT 1000;

-- 시나리오 2/3: 스트레스/스파이크 테스트 (5,000명)
SELECT 
    user_id,
    user_email,
    'password' AS password,
    user_name
FROM users 
WHERE user_email LIKE 'testuser%@loadtest.com'
ORDER BY user_id ASC
LIMIT 5000;

-- 시나리오 6: 알림 폭주 (10,000명)
SELECT 
    user_id,
    user_email,
    'password' AS password,
    user_name
FROM users 
WHERE user_email LIKE 'testuser%@loadtest.com'
ORDER BY user_id ASC
LIMIT 10000;

-- ============================================
-- 3. 통계 정보
-- ============================================

SELECT 
    '생성된 테스트 사용자 통계' AS '구분',
    COUNT(*) AS '총 개수',
    MIN(user_id) AS '최소 ID',
    MAX(user_id) AS '최대 ID',
    MIN(user_email) AS '첫 이메일',
    MAX(user_email) AS '마지막 이메일'
FROM users 
WHERE user_email LIKE 'testuser%@loadtest.com';
