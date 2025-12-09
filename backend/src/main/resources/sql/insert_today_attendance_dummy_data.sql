-- 근태 테이블에 유저번호 3-18번 금일 출근 더미 데이터 추가
-- 실행 전 확인 사항:
-- 1. 유저번호 3-18번이 존재하는지 확인
-- 2. 오늘 날짜 기준으로 출근 데이터 생성

-- 근태 상태: PRESENT(정상출근), LATE(지각), COMPLETED(정상퇴근), LEAVE_EARLY(조퇴)
-- 기준 시간: 출근 09:00, 퇴근 18:00
-- 가정: 현재 시간 오전 11시, 아직 아무도 퇴근하지 않은 상태

-- ==========================================
-- 오늘 날짜 출근 데이터 (유저번호 3-18)
-- 모두 출근만 한 상태 (퇴근 전)
-- ==========================================

-- 유저번호 3 - 정상 출근 (아직 퇴근 전)
INSERT INTO attendance (
    att_check_in,
    att_check_out,
    att_status,
    user_id,
    dash_id,
    att_work_date,
    att_created_at,
    att_updated_at
) VALUES (
    CONCAT(DATE(NOW()), ' 08:53:00'),
    NULL,
    'PRESENT',
    3,
    NULL,
    DATE(NOW()),
    CONCAT(DATE(NOW()), ' 08:53:00'),
    CONCAT(DATE(NOW()), ' 08:53:00')
);

-- 유저번호 4 - 정상 출근 (아직 퇴근 전)
INSERT INTO attendance (
    att_check_in,
    att_check_out,
    att_status,
    user_id,
    dash_id,
    att_work_date,
    att_created_at,
    att_updated_at
) VALUES (
    CONCAT(DATE(NOW()), ' 08:47:00'),
    NULL,
    'PRESENT',
    4,
    NULL,
    DATE(NOW()),
    CONCAT(DATE(NOW()), ' 08:47:00'),
    CONCAT(DATE(NOW()), ' 08:47:00')
);

-- 유저번호 5 - 지각 (아직 퇴근 전)
INSERT INTO attendance (
    att_check_in,
    att_check_out,
    att_status,
    user_id,
    dash_id,
    att_work_date,
    att_created_at,
    att_updated_at
) VALUES (
    CONCAT(DATE(NOW()), ' 09:20:00'),
    NULL,
    'LATE',
    5,
    NULL,
    DATE(NOW()),
    CONCAT(DATE(NOW()), ' 09:20:00'),
    CONCAT(DATE(NOW()), ' 09:20:00')
);

-- 유저번호 6 - 정상 출근 (아직 퇴근 전)
INSERT INTO attendance (
    att_check_in,
    att_check_out,
    att_status,
    user_id,
    dash_id,
    att_work_date,
    att_created_at,
    att_updated_at
) VALUES (
    CONCAT(DATE(NOW()), ' 08:55:00'),
    NULL,
    'PRESENT',
    6,
    NULL,
    DATE(NOW()),
    CONCAT(DATE(NOW()), ' 08:55:00'),
    CONCAT(DATE(NOW()), ' 08:55:00')
);

-- 유저번호 7 - 지각 (아직 퇴근 전)
INSERT INTO attendance (
    att_check_in,
    att_check_out,
    att_status,
    user_id,
    dash_id,
    att_work_date,
    att_created_at,
    att_updated_at
) VALUES (
    CONCAT(DATE(NOW()), ' 09:25:00'),
    NULL,
    'LATE',
    7,
    NULL,
    DATE(NOW()),
    CONCAT(DATE(NOW()), ' 09:25:00'),
    CONCAT(DATE(NOW()), ' 09:25:00')
);

-- 유저번호 8 - 정상 출근 (아직 퇴근 전)
INSERT INTO attendance (
    att_check_in,
    att_check_out,
    att_status,
    user_id,
    dash_id,
    att_work_date,
    att_created_at,
    att_updated_at
) VALUES (
    CONCAT(DATE(NOW()), ' 08:50:00'),
    NULL,
    'PRESENT',
    8,
    NULL,
    DATE(NOW()),
    CONCAT(DATE(NOW()), ' 08:50:00'),
    CONCAT(DATE(NOW()), ' 08:50:00')
);

-- 유저번호 9 - 정상 출근 (아직 퇴근 전)
INSERT INTO attendance (
    att_check_in,
    att_check_out,
    att_status,
    user_id,
    dash_id,
    att_work_date,
    att_created_at,
    att_updated_at
) VALUES (
    CONCAT(DATE(NOW()), ' 09:02:00'),
    NULL,
    'PRESENT',
    9,
    NULL,
    DATE(NOW()),
    CONCAT(DATE(NOW()), ' 09:02:00'),
    CONCAT(DATE(NOW()), ' 09:02:00')
);

-- 유저번호 10 - 지각 (아직 퇴근 전)
INSERT INTO attendance (
    att_check_in,
    att_check_out,
    att_status,
    user_id,
    dash_id,
    att_work_date,
    att_created_at,
    att_updated_at
) VALUES (
    CONCAT(DATE(NOW()), ' 09:30:00'),
    NULL,
    'LATE',
    10,
    NULL,
    DATE(NOW()),
    CONCAT(DATE(NOW()), ' 09:30:00'),
    CONCAT(DATE(NOW()), ' 09:30:00')
);

-- 유저번호 11 - 정상 출근 (아직 퇴근 전)
INSERT INTO attendance (
    att_check_in,
    att_check_out,
    att_status,
    user_id,
    dash_id,
    att_work_date,
    att_created_at,
    att_updated_at
) VALUES (
    CONCAT(DATE(NOW()), ' 08:45:00'),
    NULL,
    'PRESENT',
    11,
    NULL,
    DATE(NOW()),
    CONCAT(DATE(NOW()), ' 08:45:00'),
    CONCAT(DATE(NOW()), ' 08:45:00')
);

-- 유저번호 12 - 정상 출근 (아직 퇴근 전)
INSERT INTO attendance (
    att_check_in,
    att_check_out,
    att_status,
    user_id,
    dash_id,
    att_work_date,
    att_created_at,
    att_updated_at
) VALUES (
    CONCAT(DATE(NOW()), ' 09:00:00'),
    NULL,
    'PRESENT',
    12,
    NULL,
    DATE(NOW()),
    CONCAT(DATE(NOW()), ' 09:00:00'),
    CONCAT(DATE(NOW()), ' 09:00:00')
);

-- 유저번호 13 - 지각 (아직 퇴근 전)
INSERT INTO attendance (
    att_check_in,
    att_check_out,
    att_status,
    user_id,
    dash_id,
    att_work_date,
    att_created_at,
    att_updated_at
) VALUES (
    CONCAT(DATE(NOW()), ' 09:18:00'),
    NULL,
    'LATE',
    13,
    NULL,
    DATE(NOW()),
    CONCAT(DATE(NOW()), ' 09:18:00'),
    CONCAT(DATE(NOW()), ' 09:18:00')
);

-- 유저번호 14 - 정상 출근 (아직 퇴근 전)
INSERT INTO attendance (
    att_check_in,
    att_check_out,
    att_status,
    user_id,
    dash_id,
    att_work_date,
    att_created_at,
    att_updated_at
) VALUES (
    CONCAT(DATE(NOW()), ' 08:58:00'),
    NULL,
    'PRESENT',
    14,
    NULL,
    DATE(NOW()),
    CONCAT(DATE(NOW()), ' 08:58:00'),
    CONCAT(DATE(NOW()), ' 08:58:00')
);

-- 유저번호 15 - 정상 출근 (아직 퇴근 전)
INSERT INTO attendance (
    att_check_in,
    att_check_out,
    att_status,
    user_id,
    dash_id,
    att_work_date,
    att_created_at,
    att_updated_at
) VALUES (
    CONCAT(DATE(NOW()), ' 08:52:00'),
    NULL,
    'PRESENT',
    15,
    NULL,
    DATE(NOW()),
    CONCAT(DATE(NOW()), ' 08:52:00'),
    CONCAT(DATE(NOW()), ' 08:52:00')
);

-- 유저번호 16 - 정상 출근 (아직 퇴근 전)
INSERT INTO attendance (
    att_check_in,
    att_check_out,
    att_status,
    user_id,
    dash_id,
    att_work_date,
    att_created_at,
    att_updated_at
) VALUES (
    CONCAT(DATE(NOW()), ' 09:05:00'),
    NULL,
    'PRESENT',
    16,
    NULL,
    DATE(NOW()),
    CONCAT(DATE(NOW()), ' 09:05:00'),
    CONCAT(DATE(NOW()), ' 09:05:00')
);

-- 유저번호 17 - 지각 (아직 퇴근 전)
INSERT INTO attendance (
    att_check_in,
    att_check_out,
    att_status,
    user_id,
    dash_id,
    att_work_date,
    att_created_at,
    att_updated_at
) VALUES (
    CONCAT(DATE(NOW()), ' 09:22:00'),
    NULL,
    'LATE',
    17,
    NULL,
    DATE(NOW()),
    CONCAT(DATE(NOW()), ' 09:22:00'),
    CONCAT(DATE(NOW()), ' 09:22:00')
);

-- 유저번호 18 - 정상 출근 (아직 퇴근 전)
INSERT INTO attendance (
    att_check_in,
    att_check_out,
    att_status,
    user_id,
    dash_id,
    att_work_date,
    att_created_at,
    att_updated_at
) VALUES (
    CONCAT(DATE(NOW()), ' 08:48:00'),
    NULL,
    'PRESENT',
    18,
    NULL,
    DATE(NOW()),
    CONCAT(DATE(NOW()), ' 08:48:00'),
    CONCAT(DATE(NOW()), ' 08:48:00')
);

-- ==========================================
-- 어제 날짜 출퇴근 데이터 (유저번호 4번)
-- ==========================================

-- 유저번호 4 - 어제 정상 출근 및 정상 퇴근
INSERT INTO attendance (
    att_check_in,
    att_check_out,
    att_status,
    user_id,
    dash_id,
    att_work_date,
    att_created_at,
    att_updated_at
) VALUES (
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 1 DAY)), ' 08:55:00'),
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 1 DAY)), ' 18:05:00'),
    'COMPLETED',
    4,
    NULL,
    DATE(DATE_SUB(NOW(), INTERVAL 1 DAY)),
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 1 DAY)), ' 08:55:00'),
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 1 DAY)), ' 18:05:00')
);

-- 실행 결과 확인
SELECT 
    att_id,
    user_id as 사용자ID,
    att_work_date as 근무일,
    att_check_in as 출근시간,
    att_check_out as 퇴근시간,
    att_status as 상태
FROM attendance
WHERE user_id BETWEEN 3 AND 18
  AND att_work_date = DATE(NOW())
ORDER BY user_id;

-- 유저번호 4번 어제 데이터 확인
SELECT 
    att_id,
    user_id as 사용자ID,
    att_work_date as 근무일,
    att_check_in as 출근시간,
    att_check_out as 퇴근시간,
    att_status as 상태
FROM attendance
WHERE user_id = 4
  AND att_work_date = DATE(DATE_SUB(NOW(), INTERVAL 1 DAY));
