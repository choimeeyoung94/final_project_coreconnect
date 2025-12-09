-- 근태 테이블에 유저번호 4번 더미 데이터 추가
-- 실행 전 확인 사항:
-- 1. 유저번호 4번이 존재하는지 확인
-- 2. 11월 1일부터 17일까지의 평일 근태 데이터 생성

-- 근태 상태: PRESENT(정상출근), LATE(지각), COMPLETED(정상퇴근), LEAVE_EARLY(조퇴)
-- 기준 시간: 출근 09:00, 퇴근 18:00

-- ==========================================
-- 11월 1일부터 17일까지 근태 데이터 (평일만)
-- ==========================================

-- 11월 3일 (월) - 정상 출근 및 정상 퇴근
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
    '2025-11-03 08:55:00',
    '2025-11-03 18:05:00',
    'COMPLETED',
    4,
    NULL,
    '2025-11-03',
    '2025-11-03 08:55:00',
    '2025-11-03 18:05:00'
);

-- 11월 4일 (화) - 지각 및 정상 퇴근
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
    '2025-11-04 09:15:00',
    '2025-11-04 18:00:00',
    'COMPLETED',
    4,
    NULL,
    '2025-11-04',
    '2025-11-04 09:15:00',
    '2025-11-04 18:00:00'
);

-- 11월 5일 (수) - 정상 출근 및 조퇴
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
    '2025-11-05 08:50:00',
    '2025-11-05 17:30:00',
    'LEAVE_EARLY',
    4,
    NULL,
    '2025-11-05',
    '2025-11-05 08:50:00',
    '2025-11-05 17:30:00'
);

-- 11월 6일 (목) - 정상 출근 및 정상 퇴근
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
    '2025-11-06 08:58:00',
    '2025-11-06 18:10:00',
    'COMPLETED',
    4,
    NULL,
    '2025-11-06',
    '2025-11-06 08:58:00',
    '2025-11-06 18:10:00'
);

-- 11월 7일 (금) - 지각 및 정상 퇴근
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
    '2025-11-07 09:20:00',
    '2025-11-07 18:00:00',
    'COMPLETED',
    4,
    NULL,
    '2025-11-07',
    '2025-11-07 09:20:00',
    '2025-11-07 18:00:00'
);

-- 11월 10일 (월) - 정상 출근 및 정상 퇴근
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
    '2025-11-10 08:52:00',
    '2025-11-10 18:08:00',
    'COMPLETED',
    4,
    NULL,
    '2025-11-10',
    '2025-11-10 08:52:00',
    '2025-11-10 18:08:00'
);

-- 11월 11일 (화) - 정상 출근 및 조퇴
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
    '2025-11-11 09:00:00',
    '2025-11-11 17:45:00',
    'LEAVE_EARLY',
    4,
    NULL,
    '2025-11-11',
    '2025-11-11 09:00:00',
    '2025-11-11 17:45:00'
);

-- 11월 12일 (수) - 정상 출근 및 정상 퇴근
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
    '2025-11-12 08:56:00',
    '2025-11-12 18:02:00',
    'COMPLETED',
    4,
    NULL,
    '2025-11-12',
    '2025-11-12 08:56:00',
    '2025-11-12 18:02:00'
);

-- 11월 13일 (목) - 지각 및 정상 퇴근
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
    '2025-11-13 09:10:00',
    '2025-11-13 18:00:00',
    'COMPLETED',
    4,
    NULL,
    '2025-11-13',
    '2025-11-13 09:10:00',
    '2025-11-13 18:00:00'
);

-- 11월 14일 (금) - 정상 출근 및 정상 퇴근
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
    '2025-11-14 08:54:00',
    '2025-11-14 18:05:00',
    'COMPLETED',
    4,
    NULL,
    '2025-11-14',
    '2025-11-14 08:54:00',
    '2025-11-14 18:05:00'
);

-- 11월 17일 (월) - 정상 출근 및 정상 퇴근
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
    '2025-11-17 08:57:00',
    '2025-11-17 18:03:00',
    'COMPLETED',
    4,
    NULL,
    '2025-11-17',
    '2025-11-17 08:57:00',
    '2025-11-17 18:03:00'
);

-- ==========================================
-- 기존 데이터 (18일부터)
-- ==========================================

-- 오늘 날짜 - 정상 출근 및 정상 퇴근
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
    CONCAT(DATE(NOW()), ' 08:55:00'),  -- 출근 시간
    CONCAT(DATE(NOW()), ' 18:05:00'),  -- 퇴근 시간
    'COMPLETED',  -- 정상 퇴근
    4,  -- user_id
    NULL,  -- dash_id (선택사항)
    DATE(NOW()),  -- 근무일
    CONCAT(DATE(NOW()), ' 08:55:00'),  -- 생성일시
    CONCAT(DATE(NOW()), ' 18:05:00')   -- 수정일시
);

-- 어제 날짜 - 지각 및 정상 퇴근
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
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 1 DAY)), ' 09:15:00'),  -- 지각
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 1 DAY)), ' 18:00:00'),
    'COMPLETED',
    4,
    NULL,
    DATE(DATE_SUB(NOW(), INTERVAL 1 DAY)),
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 1 DAY)), ' 09:15:00'),
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 1 DAY)), ' 18:00:00')
);

-- 2일 전 - 정상 출근 및 조퇴
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
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 2 DAY)), ' 08:50:00'),
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 2 DAY)), ' 17:30:00'),  -- 조퇴
    'LEAVE_EARLY',
    4,
    NULL,
    DATE(DATE_SUB(NOW(), INTERVAL 2 DAY)),
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 2 DAY)), ' 08:50:00'),
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 2 DAY)), ' 17:30:00')
);

-- 3일 전 - 정상 출근 및 정상 퇴근
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
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 3 DAY)), ' 08:55:00'),
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 3 DAY)), ' 18:10:00'),
    'COMPLETED',
    4,
    NULL,
    DATE(DATE_SUB(NOW(), INTERVAL 3 DAY)),
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 3 DAY)), ' 08:55:00'),
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 3 DAY)), ' 18:10:00')
);

-- 4일 전 - 지각 및 정상 퇴근
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
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 4 DAY)), ' 09:20:00'),  -- 지각
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 4 DAY)), ' 18:00:00'),
    'COMPLETED',
    4,
    NULL,
    DATE(DATE_SUB(NOW(), INTERVAL 4 DAY)),
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 4 DAY)), ' 09:20:00'),
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 4 DAY)), ' 18:00:00')
);

-- 5일 전 - 정상 출근 및 정상 퇴근
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
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 5 DAY)), ' 08:58:00'),
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 5 DAY)), ' 18:02:00'),
    'COMPLETED',
    4,
    NULL,
    DATE(DATE_SUB(NOW(), INTERVAL 5 DAY)),
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 5 DAY)), ' 08:58:00'),
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 5 DAY)), ' 18:02:00')
);

-- 6일 전 - 정상 출근 및 조퇴
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
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 6 DAY)), ' 09:00:00'),
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 6 DAY)), ' 17:45:00'),  -- 조퇴
    'LEAVE_EARLY',
    4,
    NULL,
    DATE(DATE_SUB(NOW(), INTERVAL 6 DAY)),
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 6 DAY)), ' 09:00:00'),
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 6 DAY)), ' 17:45:00')
);

-- 7일 전 - 정상 출근 및 정상 퇴근
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
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 7 DAY)), ' 08:52:00'),
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 7 DAY)), ' 18:08:00'),
    'COMPLETED',
    4,
    NULL,
    DATE(DATE_SUB(NOW(), INTERVAL 7 DAY)),
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 7 DAY)), ' 08:52:00'),
    CONCAT(DATE(DATE_SUB(NOW(), INTERVAL 7 DAY)), ' 18:08:00')
);

-- 실행 결과 확인
SELECT 
    att_id,
    att_work_date as 근무일,
    att_check_in as 출근시간,
    att_check_out as 퇴근시간,
    att_status as 상태,
    user_id as 사용자ID
FROM attendance
WHERE user_id = 4
ORDER BY att_work_date DESC;

