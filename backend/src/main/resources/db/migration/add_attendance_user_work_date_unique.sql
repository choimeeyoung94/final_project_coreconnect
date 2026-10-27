-- ⭐ attendance 테이블에 (user_id, att_work_date) 유니크 제약 추가
-- 같은 사용자의 같은 날 출근 기록이 2건 이상 저장되는 것을 DB에서 막음 (동시 출근 요청 대비)
-- 운영(ddl-auto=validate)에서는 자동 반영되지 않으므로 배포 전에 수동 실행 (필수)
-- ⚠ validate는 유니크 제약 유무를 검사하지 않아서, 이 SQL을 빼먹어도 서버는 정상 기동되지만 중복은 막히지 않음

-- 1. 근무일이 비어 있는 기록 확인 (있으면 2단계 전에 정리 필요)
SELECT att_id, user_id, att_check_in
FROM attendance
WHERE att_work_date IS NULL;

-- 1-1. (근무일 빈 기록이 있을 때만) 출근 시각의 날짜로 채움
-- UPDATE attendance
--    SET att_work_date = DATE(att_check_in)
--  WHERE att_work_date IS NULL;

-- 2. 중복 기록 확인 (결과가 0건이어야 4단계 실행 가능)
SELECT user_id, att_work_date, COUNT(*) AS cnt
FROM attendance
GROUP BY user_id, att_work_date
HAVING COUNT(*) > 1;

-- 3. (중복이 있을 때만) 가장 먼저 출근한 기록(att_id가 가장 작은 것)만 남기고 삭제
-- DELETE a FROM attendance a
-- JOIN attendance b
--   ON a.user_id = b.user_id
--  AND a.att_work_date = b.att_work_date
--  AND a.att_id > b.att_id;

-- 4. 근무일 NOT NULL + 유니크 제약 추가
ALTER TABLE attendance
  MODIFY att_work_date DATE NOT NULL;

ALTER TABLE attendance
  ADD CONSTRAINT uk_attendance_user_work_date UNIQUE (user_id, att_work_date);

-- 5. 확인
SHOW INDEX FROM attendance WHERE Key_name = 'uk_attendance_user_work_date';
