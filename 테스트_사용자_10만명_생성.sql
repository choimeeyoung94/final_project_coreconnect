-- ============================================================
-- K6 대규모 부하 테스트용 사용자 10만명 생성
-- ============================================================
-- 
-- 사용법:
-- 1. MySQL 서버에 연결
-- 2. 이 스크립트 실행 (시간이 걸릴 수 있습니다)
--
-- 주의사항:
-- - 10만명 생성은 시간이 오래 걸립니다 (약 10-30분)
-- - 작은 규모로 먼저 테스트하려면 아래 LIMIT을 조정하세요
-- ============================================================

USE coreconnect;

-- 프로시저가 이미 존재하면 삭제
DROP PROCEDURE IF EXISTS CreateTestUsers;

DELIMITER $$

CREATE PROCEDURE CreateTestUsers(IN userCount INT)
BEGIN
    DECLARE i INT DEFAULT 1;
    DECLARE dept_id INT;
    DECLARE batch_size INT DEFAULT 1000;
    DECLARE current_batch INT DEFAULT 0;
    
    -- 기본 부서 ID 가져오기 (없으면 첫 번째 부서 사용)
    SELECT id INTO dept_id FROM department LIMIT 1;
    
    IF dept_id IS NULL THEN
        -- 부서가 없으면 기본 부서 생성
        INSERT INTO department (dept_name, created_at, updated_at) 
        VALUES ('테스트부서', NOW(), NOW());
        SET dept_id = LAST_INSERT_ID();
    END IF;
    
    -- 트랜잭션 시작
    START TRANSACTION;
    
    WHILE i <= userCount DO
        -- 테스트 사용자 생성
        -- 비밀번호: Test1234! (BCrypt 해시)
        INSERT INTO users (
            email,
            password,
            name,
            phone_number,
            job_grade,
            role,
            profile_image_url,
            department_id,
            created_at,
            updated_at
        ) VALUES (
            CONCAT('testuser', i, '@test.com'),
            '$2a$10$rZ7qQqK5YhGqxVK5vqQqOeK5YhGqxVK5vqQqOeK5YhGqxVK5vqQqO', -- Test1234!
            CONCAT('TestUser', i),
            CONCAT('010-', LPAD(FLOOR(RAND() * 10000), 4, '0'), '-', LPAD(FLOOR(RAND() * 10000), 4, '0')),
            'STAFF',
            'USER',
            NULL,
            dept_id,
            NOW(),
            NOW()
        )
        ON DUPLICATE KEY UPDATE email = email; -- 중복 방지
        
        -- 배치 커밋 (1000명마다)
        IF i % batch_size = 0 THEN
            COMMIT;
            SET current_batch = current_batch + 1;
            SELECT CONCAT('진행 중: ', i, '/', userCount, ' (', ROUND(i/userCount*100, 2), '%) - 배치 ', current_batch, ' 완료') AS progress;
            START TRANSACTION;
        END IF;
        
        SET i = i + 1;
    END WHILE;
    
    -- 마지막 배치 커밋
    COMMIT;
    
    SELECT CONCAT('✅ 완료: ', userCount, '명의 테스트 사용자 생성 완료!') AS result;
END$$

DELIMITER ;

-- ============================================================
-- 실행 옵션 (원하는 것을 주석 해제하여 실행)
-- ============================================================

-- 옵션 1: 소규모 테스트 (1,000명) - 로컬 테스트용
-- CALL CreateTestUsers(1000);

-- 옵션 2: 중간 부하 테스트 (10,000명) - 약 1-2분 소요
-- CALL CreateTestUsers(10000);

-- 옵션 3: 대규모 부하 테스트 (100,000명) - 약 10-30분 소요
-- CALL CreateTestUsers(100000);

-- ⚠️ 주의: 10만명 생성은 시간이 오래 걸립니다!
-- 처음에는 1000명으로 테스트해보세요.

-- ============================================================
-- 사용자 확인 쿼리
-- ============================================================

-- 생성된 테스트 사용자 수 확인
SELECT COUNT(*) AS test_user_count 
FROM users 
WHERE email LIKE 'testuser%@test.com';

-- 샘플 사용자 확인
SELECT id, email, name, created_at 
FROM users 
WHERE email LIKE 'testuser%@test.com' 
LIMIT 10;

-- ============================================================
-- 테스트 채팅방 생성 (선택사항)
-- ============================================================

-- 테스트용 대규모 채팅방 생성
INSERT INTO chat_room (room_name, created_at, updated_at)
VALUES ('10만명 부하 테스트 채팅방', NOW(), NOW())
ON DUPLICATE KEY UPDATE room_name = room_name;

-- 생성된 채팅방 ID 확인
SELECT id, room_name, created_at 
FROM chat_room 
WHERE room_name = '10만명 부하 테스트 채팅방';

-- 채팅방에 모든 테스트 사용자 추가 (선택사항)
-- ⚠️ 주의: 10만명을 한 채팅방에 추가하는 것은 매우 느립니다!
-- 실제 테스트에서는 사용자가 API를 통해 채팅방에 입장하는 것을 권장합니다.

/*
INSERT INTO chat_room_user (chat_room_id, user_id, is_active, created_at, updated_at)
SELECT 
    (SELECT id FROM chat_room WHERE room_name = '10만명 부하 테스트 채팅방'),
    u.id,
    TRUE,
    NOW(),
    NOW()
FROM users u
WHERE u.email LIKE 'testuser%@test.com'
ON DUPLICATE KEY UPDATE is_active = TRUE;
*/

-- ============================================================
-- 정리 (테스트 완료 후 사용자 삭제)
-- ============================================================

/*
-- 테스트 사용자 삭제
DELETE FROM users WHERE email LIKE 'testuser%@test.com';

-- 테스트 채팅방 삭제
DELETE FROM chat_room WHERE room_name = '10만명 부하 테스트 채팅방';

SELECT '✅ 테스트 데이터 정리 완료!' AS result;
*/

-- ============================================================
-- 성능 최적화를 위한 인덱스 확인
-- ============================================================

-- 이메일 인덱스 확인
SHOW INDEX FROM users WHERE Key_name = 'idx_email';

-- 인덱스가 없으면 생성
-- CREATE INDEX idx_email ON users(email);

-- 채팅방 ID 인덱스 확인
SHOW INDEX FROM chat WHERE Key_name = 'idx_chat_room_id';

-- 인덱스가 없으면 생성
-- CREATE INDEX idx_chat_room_id ON chat(chat_room_id);

-- ============================================================
-- 테스트 사용자 비밀번호 정보
-- ============================================================
/*
이메일: testuser1@test.com ~ testuser100000@test.com
비밀번호: Test1234!

로그인 테스트:
POST /api/v1/auth/login
{
  "email": "testuser1@test.com",
  "password": "Test1234!"
}
*/

