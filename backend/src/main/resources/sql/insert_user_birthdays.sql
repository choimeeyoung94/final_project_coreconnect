-- 전사원 생일 데이터 추가/수정 (유저번호 3-18)
-- 실행 전 확인 사항:
-- 1. 유저번호 3-18번이 존재하는지 확인
-- 2. user_detail_profiles 테이블에 해당 유저들의 레코드가 있는지 확인

-- 11월에 2명, 나머지는 다양한 월에 배분

-- ==========================================
-- 11월 생일 (2명)
-- ==========================================

-- 유저번호 4 - 11월 15일 생일
INSERT INTO user_detail_profiles (user_id, birthday)
VALUES (4, '1990-11-15')
ON DUPLICATE KEY UPDATE birthday = '1990-11-15';

-- 유저번호 12 - 11월 28일 생일
INSERT INTO user_detail_profiles (user_id, birthday)
VALUES (12, '1992-11-28')
ON DUPLICATE KEY UPDATE birthday = '1992-11-28';

-- ==========================================
-- 기타 월 생일 (나머지 유저들)
-- ==========================================

-- 유저번호 3 - 1월 5일 생일
INSERT INTO user_detail_profiles (user_id, birthday)
VALUES (3, '1988-01-05')
ON DUPLICATE KEY UPDATE birthday = '1988-01-05';

-- 유저번호 5 - 2월 14일 생일
INSERT INTO user_detail_profiles (user_id, birthday)
VALUES (5, '1991-02-14')
ON DUPLICATE KEY UPDATE birthday = '1991-02-14';

-- 유저번호 6 - 3월 20일 생일
INSERT INTO user_detail_profiles (user_id, birthday)
VALUES (6, '1989-03-20')
ON DUPLICATE KEY UPDATE birthday = '1989-03-20';

-- 유저번호 7 - 4월 10일 생일
INSERT INTO user_detail_profiles (user_id, birthday)
VALUES (7, '1993-04-10')
ON DUPLICATE KEY UPDATE birthday = '1993-04-10';

-- 유저번호 8 - 5월 25일 생일
INSERT INTO user_detail_profiles (user_id, birthday)
VALUES (8, '1990-05-25')
ON DUPLICATE KEY UPDATE birthday = '1990-05-25';

-- 유저번호 9 - 6월 8일 생일
INSERT INTO user_detail_profiles (user_id, birthday)
VALUES (9, '1992-06-08')
ON DUPLICATE KEY UPDATE birthday = '1992-06-08';

-- 유저번호 10 - 7월 18일 생일
INSERT INTO user_detail_profiles (user_id, birthday)
VALUES (10, '1987-07-18')
ON DUPLICATE KEY UPDATE birthday = '1987-07-18';

-- 유저번호 11 - 8월 3일 생일
INSERT INTO user_detail_profiles (user_id, birthday)
VALUES (11, '1991-08-03')
ON DUPLICATE KEY UPDATE birthday = '1991-08-03';

-- 유저번호 13 - 9월 12일 생일
INSERT INTO user_detail_profiles (user_id, birthday)
VALUES (13, '1994-09-12')
ON DUPLICATE KEY UPDATE birthday = '1994-09-12';

-- 유저번호 14 - 10월 22일 생일
INSERT INTO user_detail_profiles (user_id, birthday)
VALUES (14, '1989-10-22')
ON DUPLICATE KEY UPDATE birthday = '1989-10-22';

-- 유저번호 15 - 12월 7일 생일
INSERT INTO user_detail_profiles (user_id, birthday)
VALUES (15, '1990-12-07')
ON DUPLICATE KEY UPDATE birthday = '1990-12-07';

-- 유저번호 16 - 1월 30일 생일
INSERT INTO user_detail_profiles (user_id, birthday)
VALUES (16, '1992-01-30')
ON DUPLICATE KEY UPDATE birthday = '1992-01-30';

-- 유저번호 17 - 4월 15일 생일
INSERT INTO user_detail_profiles (user_id, birthday)
VALUES (17, '1993-04-15')
ON DUPLICATE KEY UPDATE birthday = '1993-04-15';

-- 유저번호 18 - 8월 20일 생일
INSERT INTO user_detail_profiles (user_id, birthday)
VALUES (18, '1991-08-20')
ON DUPLICATE KEY UPDATE birthday = '1991-08-20';

-- ==========================================
-- 실행 결과 확인
-- ==========================================

-- 전체 생일 데이터 확인
SELECT 
    udp.user_id as 유저번호,
    u.user_name as 이름,
    udp.birthday as 생일,
    MONTH(udp.birthday) as 월,
    DAY(udp.birthday) as 일
FROM user_detail_profiles udp
INNER JOIN users u ON udp.user_id = u.user_id
WHERE udp.user_id BETWEEN 3 AND 18
  AND udp.birthday IS NOT NULL
ORDER BY MONTH(udp.birthday), DAY(udp.birthday);

-- 11월 생일자만 확인
SELECT 
    udp.user_id as 유저번호,
    u.user_name as 이름,
    udp.birthday as 생일,
    DAY(udp.birthday) as 일
FROM user_detail_profiles udp
INNER JOIN users u ON udp.user_id = u.user_id
WHERE udp.user_id BETWEEN 3 AND 18
  AND udp.birthday IS NOT NULL
  AND MONTH(udp.birthday) = 11
ORDER BY DAY(udp.birthday);

