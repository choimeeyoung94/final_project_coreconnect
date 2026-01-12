-- ========================================
-- JWT 인증 부하 테스트용 계정 생성 스크립트
-- ========================================

-- 비밀번호: Test1234!
-- BCrypt 암호화된 비밀번호 (Spring Security PasswordEncoder 사용)
-- 실제 애플리케이션에서 생성한 해시값 사용 필요

-- 1. 테스트용 부서 생성 (없는 경우)
INSERT INTO department (dept_name, description, created_at, updated_at)
VALUES 
  ('테스트부서', '부하 테스트용 부서', NOW(), NOW())
ON DUPLICATE KEY UPDATE dept_name = dept_name;

-- 2. 테스트 계정 5개 생성
-- 주의: password는 실제로 BCrypt로 암호화된 값을 넣어야 합니다
-- 아래 예시는 'Test1234!'를 BCrypt로 암호화한 값입니다 (Spring Boot 앱에서 생성)

SET @test_dept_id = (SELECT dept_id FROM department WHERE dept_name = '테스트부서' LIMIT 1);

INSERT INTO user (
  email, 
  password, 
  name, 
  phone_number, 
  dept_id, 
  job_grade, 
  role, 
  status,
  created_at, 
  updated_at
) VALUES 
  (
    'test1@coreconnect.io', 
    '$2a$10$YourBCryptHashHere1', -- ⚠️ 실제 BCrypt 해시로 교체 필요
    '테스트유저1', 
    '010-0001-0001', 
    @test_dept_id, 
    'STAFF', 
    'USER',
    'ACTIVE',
    NOW(), 
    NOW()
  ),
  (
    'test2@coreconnect.io', 
    '$2a$10$YourBCryptHashHere2',
    '테스트유저2', 
    '010-0002-0002', 
    @test_dept_id, 
    'STAFF', 
    'USER',
    'ACTIVE',
    NOW(), 
    NOW()
  ),
  (
    'test3@coreconnect.io', 
    '$2a$10$YourBCryptHashHere3',
    '테스트유저3', 
    '010-0003-0003', 
    @test_dept_id, 
    'STAFF', 
    'USER',
    'ACTIVE',
    NOW(), 
    NOW()
  ),
  (
    'test4@coreconnect.io', 
    '$2a$10$YourBCryptHashHere4',
    '테스트유저4', 
    '010-0004-0004', 
    @test_dept_id, 
    'STAFF', 
    'USER',
    'ACTIVE',
    NOW(), 
    NOW()
  ),
  (
    'test5@coreconnect.io', 
    '$2a$10$YourBCryptHashHere5',
    '테스트유저5', 
    '010-0005-0005', 
    @test_dept_id, 
    'STAFF', 
    'USER',
    'ACTIVE',
    NOW(), 
    NOW()
  )
ON DUPLICATE KEY UPDATE email = email;

-- 3. 테스트용 채팅방 생성 (5개)
INSERT INTO chat_room (title, room_type, created_at, updated_at)
VALUES 
  ('테스트방 1', 'GROUP', NOW(), NOW()),
  ('테스트방 2', 'GROUP', NOW(), NOW()),
  ('테스트방 3', 'GROUP', NOW(), NOW()),
  ('테스트방 4', 'GROUP', NOW(), NOW()),
  ('테스트방 5', 'GROUP', NOW(), NOW())
ON DUPLICATE KEY UPDATE title = title;

-- 4. 모든 테스트 사용자를 모든 채팅방에 추가
SET @user1_id = (SELECT user_id FROM user WHERE email = 'test1@coreconnect.io' LIMIT 1);
SET @user2_id = (SELECT user_id FROM user WHERE email = 'test2@coreconnect.io' LIMIT 1);
SET @user3_id = (SELECT user_id FROM user WHERE email = 'test3@coreconnect.io' LIMIT 1);
SET @user4_id = (SELECT user_id FROM user WHERE email = 'test4@coreconnect.io' LIMIT 1);
SET @user5_id = (SELECT user_id FROM user WHERE email = 'test5@coreconnect.io' LIMIT 1);

SET @room1_id = (SELECT chat_room_id FROM chat_room WHERE title = '테스트방 1' LIMIT 1);
SET @room2_id = (SELECT chat_room_id FROM chat_room WHERE title = '테스트방 2' LIMIT 1);
SET @room3_id = (SELECT chat_room_id FROM chat_room WHERE title = '테스트방 3' LIMIT 1);
SET @room4_id = (SELECT chat_room_id FROM chat_room WHERE title = '테스트방 4' LIMIT 1);
SET @room5_id = (SELECT chat_room_id FROM chat_room WHERE title = '테스트방 5' LIMIT 1);

-- 모든 사용자를 모든 방에 추가
INSERT INTO chat_room_user (chat_room_id, user_id, joined_at)
SELECT room_id, user_id, NOW()
FROM (
  SELECT @room1_id AS room_id UNION ALL
  SELECT @room2_id UNION ALL
  SELECT @room3_id UNION ALL
  SELECT @room4_id UNION ALL
  SELECT @room5_id
) AS rooms
CROSS JOIN (
  SELECT @user1_id AS user_id UNION ALL
  SELECT @user2_id UNION ALL
  SELECT @user3_id UNION ALL
  SELECT @user4_id UNION ALL
  SELECT @user5_id
) AS users
ON DUPLICATE KEY UPDATE joined_at = joined_at;

-- 5. 확인 쿼리
SELECT 
  u.email, 
  u.name, 
  d.dept_name, 
  u.role
FROM user u
LEFT JOIN department d ON u.dept_id = d.dept_id
WHERE u.email LIKE 'test%@coreconnect.io';

SELECT 
  cr.title,
  COUNT(cru.user_id) AS participant_count
FROM chat_room cr
LEFT JOIN chat_room_user cru ON cr.chat_room_id = cru.chat_room_id
WHERE cr.title LIKE '테스트방%'
GROUP BY cr.chat_room_id, cr.title;

