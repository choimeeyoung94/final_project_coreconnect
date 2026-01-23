-- ============================================
-- MySQL Workbench에서 바로 실행 가능한 간단 버전
-- 10,000명의 테스트 사용자 생성
-- 비밀번호: 모두 "password"
-- ============================================

USE db_coreconnect;

-- BCrypt로 암호화된 "password" 값
SET @encrypted_password = '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cyhwhwNSqIfPkAFMJqsWL/tGHqMOa';

-- ============================================
-- 프로시저 생성 및 실행
-- ============================================

DELIMITER $$

DROP PROCEDURE IF EXISTS CreateTestUsers$$

CREATE PROCEDURE CreateTestUsers()
BEGIN
    DECLARE i INT DEFAULT 1;
    DECLARE batch INT DEFAULT 0;
    
    START TRANSACTION;
    
    SELECT '🚀 10,000명 테스트 사용자 생성 시작...' AS Status;
    
    WHILE i <= 10000 DO
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
            @encrypted_password,
            CONCAT('테스트유저', LPAD(i, 5, '0')),
            'USER',
            CONCAT('testuser', LPAD(i, 5, '0'), '@loadtest.com'),
            CONCAT('010-', LPAD(FLOOR(i / 10000), 4, '0'), '-', LPAD(i % 10000, 4, '0')),
            NOW(),
            'ACTIVE',
            CONCAT('EMP', LPAD(i, 5, '0')),
            NULL,
            'STAFF'
        );
        
        SET i = i + 1;
        
        -- 1,000명마다 진행 상황 출력
        IF i % 1000 = 0 THEN
            SET batch = batch + 1;
            COMMIT;
            SELECT CONCAT('✅ 진행: ', i, '명 완료 (', (i / 100), '%)') AS Progress;
            START TRANSACTION;
        END IF;
    END WHILE;
    
    COMMIT;
    
    SELECT '✅ 완료: 10,000명 생성 성공!' AS Result;
    
    -- 통계 출력
    SELECT 
        COUNT(*) AS '총 사용자 수',
        MIN(user_id) AS '최소 ID',
        MAX(user_id) AS '최대 ID'
    FROM users 
    WHERE user_email LIKE 'testuser%@loadtest.com';
    
END$$

DELIMITER ;

-- ============================================
-- 실행 (아래 명령어 하나만 실행하면 됩니다!)
-- ============================================

CALL CreateTestUsers();

-- ============================================
-- 생성 확인
-- ============================================

-- 총 개수 확인
SELECT COUNT(*) AS '생성된 테스트 사용자 수'
FROM users 
WHERE user_email LIKE 'testuser%@loadtest.com';

-- 처음 10명 확인
SELECT 
    user_id AS 'ID',
    user_name AS '이름',
    user_email AS '이메일',
    'password' AS '비밀번호',
    user_employee_number AS '사번',
    user_status AS '상태'
FROM users 
WHERE user_email LIKE 'testuser%@loadtest.com'
ORDER BY user_id ASC
LIMIT 10;

-- 마지막 10명 확인
SELECT 
    user_id AS 'ID',
    user_name AS '이름',
    user_email AS '이메일',
    'password' AS '비밀번호',
    user_employee_number AS '사번',
    user_status AS '상태'
FROM users 
WHERE user_email LIKE 'testuser%@loadtest.com'
ORDER BY user_id DESC
LIMIT 10;

-- ============================================
-- 삭제 (테스트 완료 후 실행)
-- ============================================

/*
DELETE FROM users 
WHERE user_email LIKE 'testuser%@loadtest.com';

SELECT CONCAT('✅ 삭제 완료! 남은 테스트 사용자: ', 
    (SELECT COUNT(*) FROM users WHERE user_email LIKE 'testuser%@loadtest.com'), '명'
) AS Result;
*/
