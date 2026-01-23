-- ============================================
-- 부하 테스트용 가상 사용자 생성 스크립트
-- ============================================
-- 목적: k6 부하 테스트를 위한 10,000명의 테스트 사용자 생성
-- 비밀번호: 모두 "password" (BCrypt 암호화)
-- ============================================

USE db_coreconnect;

-- 1. 기존 테스트 사용자 삭제 (선택적)
-- DELETE FROM users WHERE user_email LIKE 'testuser%@loadtest.com';

-- 2. BCrypt로 암호화된 "password" 값
-- Spring Security BCrypt: $2a$10$rounds
-- 아래는 "password"를 BCrypt로 암호화한 값입니다.
SET @encrypted_password = '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cyhwhwNSqIfPkAFMJqsWL/tGHqMOa';

-- 3. 부하 테스트에 필요한 사용자 수 분석
-- ============================================
-- 시나리오 1 (일반 채팅):     1,000명
-- 시나리오 2 (스트레스):      5,000명
-- 시나리오 3 (스파이크):      5,000명
-- 시나리오 4 (지속성):        2,000명
-- 시나리오 5 (대규모 그룹):   1,500명
-- 시나리오 6 (알림 폭주):    10,000명
-- ============================================
-- 권장: 10,000명 생성 (모든 시나리오 대응)
-- ============================================

-- 4. 대량 사용자 생성 프로시저
DELIMITER $$

DROP PROCEDURE IF EXISTS CreateLoadTestUsers$$

CREATE PROCEDURE CreateLoadTestUsers(IN user_count INT)
BEGIN
    DECLARE i INT DEFAULT 1;
    DECLARE batch_size INT DEFAULT 1000;
    DECLARE current_batch INT DEFAULT 0;
    
    -- 트랜잭션 시작
    START TRANSACTION;
    
    -- 진행 상황 출력
    SELECT CONCAT('가상 사용자 생성 시작: 총 ', user_count, '명') AS Status;
    
    WHILE i <= user_count DO
        INSERT INTO users (
            user_password,
            user_name,
            user_role,
            user_email,
            user_phone,
            user_join_date,
            user_status,
            user_employee_number,
            dept_id,
            user_rank
        ) VALUES (
            @encrypted_password,                                    -- 비밀번호: "password"
            CONCAT('테스트유저', LPAD(i, 5, '0')),                  -- 이름: 테스트유저00001
            'USER',                                                  -- 권한: USER
            CONCAT('testuser', LPAD(i, 5, '0'), '@loadtest.com'),   -- 이메일: testuser00001@loadtest.com
            CONCAT('010-', LPAD(FLOOR(i / 10000), 4, '0'), '-', LPAD(i % 10000, 4, '0')), -- 전화번호
            NOW(),                                                   -- 가입일
            'ACTIVE',                                                -- 상태: ACTIVE
            CONCAT('EMP', LPAD(i, 5, '0')),                         -- 사번: EMP00001
            NULL,                                                    -- 부서: NULL (선택적)
            'STAFF'                                                  -- 직급: STAFF
        );
        
        SET i = i + 1;
        
        -- 1,000명마다 진행 상황 출력 및 커밋
        IF i % batch_size = 0 THEN
            SET current_batch = current_batch + 1;
            COMMIT;
            SELECT CONCAT('진행: ', i, '명 / ', user_count, '명 완료 (', 
                         ROUND((i / user_count) * 100, 1), '%)') AS Progress;
            START TRANSACTION;
        END IF;
    END WHILE;
    
    -- 최종 커밋
    COMMIT;
    
    -- 완료 메시지
    SELECT CONCAT('✅ 가상 사용자 생성 완료: 총 ', user_count, '명') AS Result;
    
    -- 생성된 사용자 통계
    SELECT 
        COUNT(*) AS '총 사용자 수',
        COUNT(CASE WHEN user_email LIKE 'testuser%@loadtest.com' THEN 1 END) AS '테스트 사용자 수',
        MIN(user_id) AS '최소 user_id',
        MAX(user_id) AS '최대 user_id'
    FROM users;
    
END$$

DELIMITER ;

-- ============================================
-- 5. 실행: 10,000명의 테스트 사용자 생성
-- ============================================
-- 소요 시간: 약 30-60초 (시스템 성능에 따라 다름)

CALL CreateLoadTestUsers(10000);

-- ============================================
-- 6. 생성된 사용자 확인
-- ============================================

-- 처음 10명 확인
SELECT 
    user_id,
    user_name,
    user_email,
    user_employee_number,
    user_status,
    user_join_date
FROM users 
WHERE user_email LIKE 'testuser%@loadtest.com'
ORDER BY user_id ASC
LIMIT 10;

-- 마지막 10명 확인
SELECT 
    user_id,
    user_name,
    user_email,
    user_employee_number,
    user_status,
    user_join_date
FROM users 
WHERE user_email LIKE 'testuser%@loadtest.com'
ORDER BY user_id DESC
LIMIT 10;

-- 총 개수 확인
SELECT 
    '테스트 사용자' AS 구분,
    COUNT(*) AS 총개수,
    MIN(user_id) AS 최소ID,
    MAX(user_id) AS 최대ID
FROM users 
WHERE user_email LIKE 'testuser%@loadtest.com';

-- ============================================
-- 7. 선택적: 특정 개수만 생성하고 싶은 경우
-- ============================================

-- 1,000명만 생성 (시나리오 1 테스트)
-- CALL CreateLoadTestUsers(1000);

-- 5,000명만 생성 (시나리오 2, 3 테스트)
-- CALL CreateLoadTestUsers(5000);

-- 사용자 정의 개수
-- CALL CreateLoadTestUsers(500);

-- ============================================
-- 8. 테스트 사용자 삭제 (테스트 완료 후)
-- ============================================

-- DELIMITER $$
-- 
-- DROP PROCEDURE IF EXISTS DeleteLoadTestUsers$$
-- 
-- CREATE PROCEDURE DeleteLoadTestUsers()
-- BEGIN
--     DECLARE deleted_count INT;
--     
--     START TRANSACTION;
--     
--     -- 테스트 사용자 삭제 전 개수 확인
--     SELECT COUNT(*) INTO deleted_count 
--     FROM users 
--     WHERE user_email LIKE 'testuser%@loadtest.com';
--     
--     -- 삭제 실행
--     DELETE FROM users 
--     WHERE user_email LIKE 'testuser%@loadtest.com';
--     
--     COMMIT;
--     
--     -- 결과 출력
--     SELECT CONCAT('✅ 테스트 사용자 삭제 완료: ', deleted_count, '명') AS Result;
-- END$$
-- 
-- DELIMITER ;
-- 
-- -- 삭제 실행
-- CALL DeleteLoadTestUsers();

-- ============================================
-- 9. 부하 테스트 시나리오별 사용자 할당
-- ============================================

-- 시나리오 1: 일반 채팅 (사용자 1-1000)
SELECT 
    user_id, 
    user_email, 
    'password' AS plain_password,
    '시나리오1: 일반 채팅' AS scenario
FROM users 
WHERE user_email LIKE 'testuser%@loadtest.com'
ORDER BY user_id ASC
LIMIT 1000;

-- 시나리오 2: 스트레스 테스트 (사용자 1-5000)
-- SELECT user_id, user_email FROM users 
-- WHERE user_email LIKE 'testuser%@loadtest.com'
-- ORDER BY user_id ASC LIMIT 5000;

-- 시나리오 3: 스파이크 테스트 (사용자 1-5000)
-- SELECT user_id, user_email FROM users 
-- WHERE user_email LIKE 'testuser%@loadtest.com'
-- ORDER BY user_id ASC LIMIT 5000;

-- 시나리오 4: 지속성 테스트 (사용자 1-2000)
-- SELECT user_id, user_email FROM users 
-- WHERE user_email LIKE 'testuser%@loadtest.com'
-- ORDER BY user_id ASC LIMIT 2000;

-- 시나리오 5: 대규모 그룹 채팅 (사용자 1-1500)
-- 50명 × 10개 방 = 500명
-- 100명 × 5개 방 = 500명
-- 500명 × 2개 방 = 1000명
-- 총 1,500명 (중복 없이)
-- SELECT user_id, user_email FROM users 
-- WHERE user_email LIKE 'testuser%@loadtest.com'
-- ORDER BY user_id ASC LIMIT 1500;

-- 시나리오 6: 알림 폭주 (사용자 1-10000)
-- SELECT user_id, user_email FROM users 
-- WHERE user_email LIKE 'testuser%@loadtest.com'
-- ORDER BY user_id ASC LIMIT 10000;

-- ============================================
-- 10. k6 테스트 스크립트용 사용자 데이터 추출
-- ============================================

-- CSV 형식으로 추출 (k6에서 사용)
SELECT 
    user_id AS 'id',
    user_email AS 'email',
    'password' AS 'password',
    user_name AS 'name'
FROM users 
WHERE user_email LIKE 'testuser%@loadtest.com'
ORDER BY user_id ASC
INTO OUTFILE '/tmp/test-users.csv'
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"'
LINES TERMINATED BY '\n';

-- 또는 JSON 형식으로 (k6 활용 시)
-- SELECT JSON_ARRAYAGG(
--     JSON_OBJECT(
--         'id', user_id,
--         'email', user_email,
--         'password', 'password',
--         'name', user_name
--     )
-- ) AS test_users
-- FROM users 
-- WHERE user_email LIKE 'testuser%@loadtest.com'
-- ORDER BY user_id ASC;

-- ============================================
-- 사용 가이드
-- ============================================
-- 
-- 1. MySQL Workbench 또는 CLI에서 실행:
--    mysql -u admin -p db_coreconnect < create-test-users.sql
-- 
-- 2. 생성 시간: 약 30-60초 (10,000명 기준)
-- 
-- 3. 로그인 정보:
--    이메일: testuser00001@loadtest.com ~ testuser10000@loadtest.com
--    비밀번호: password (모든 사용자 동일)
-- 
-- 4. k6 테스트에서 사용:
--    const users = [
--      { email: 'testuser00001@loadtest.com', password: 'password' },
--      { email: 'testuser00002@loadtest.com', password: 'password' },
--      ...
--    ];
-- 
-- 5. 테스트 완료 후 삭제:
--    CALL DeleteLoadTestUsers();
-- 
-- ============================================
-- 주의사항
-- ============================================
-- 
-- ⚠️ 프로덕션 DB에서는 절대 실행하지 마세요!
-- ⚠️ 테스트 환경에서만 사용하세요!
-- ⚠️ 테스트 완료 후 반드시 삭제하세요!
-- 
-- ============================================
