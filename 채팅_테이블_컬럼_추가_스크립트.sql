-- ==========================================
-- 채팅 테이블 컬럼 추가 및 인덱스 수정 스크립트
-- ==========================================
-- 작성일: 2025-12-19
-- 목적: chat_message 테이블에 created_at 컬럼 추가
-- ==========================================

USE db_coreconnect;

-- ==========================================
-- Option 1: 기존 sent_at 사용 (권장 ⭐)
-- ==========================================

-- 현재 테이블 구조 확인
DESC chat_message;

-- ==========================================
-- Step 1: 기존 인덱스 현황 확인
-- ==========================================
SHOW INDEX FROM chat_message;

-- ==========================================
-- Step 2: 중복/불필요 인덱스 정리
-- ==========================================
-- 아래 인덱스 중 존재하는 것만 삭제 (에러 방지용 IF EXISTS 사용 불가 시 수동으로 확인 후 실행)
-- ALTER TABLE chat_message DROP INDEX idx_chat_message_room_time;
-- ALTER TABLE chat_message DROP INDEX idx_chat_message_room_last_time;
-- ALTER TABLE chat_message DROP INDEX idx_chat_message_room_latest_time;
-- ALTER TABLE chat_message DROP INDEX idx_chat_message_comprehensive;

-- ==========================================
-- Step 3: 최적화된 복합 인덱스 생성
-- ==========================================
-- 최신 메시지 조회용 단일 복합 인덱스 (chat_room_id + sent_at)
-- 참고: MySQL은 인덱스를 양방향으로 스캔할 수 있으므로 DESC 없이도 ORDER BY sent_at DESC를 최적화합니다

-- 이미 존재하는 인덱스가 있으면 먼저 삭제 (에러 발생 시 무시)
DROP INDEX idx_chat_message_room_sent_at ON chat_message;

-- 인덱스 생성
CREATE INDEX idx_chat_message_room_sent_at
ON chat_message(chat_room_id, sent_at);

-- ==========================================
-- Step 4: 기존 인덱스 전체 확인 및 문제 파악
-- ==========================================
-- 현재 테이블에 존재하는 모든 인덱스 확인
SHOW INDEX FROM chat_message;

-- chat_room_id 관련 인덱스가 여러 개 있으면 옵티마이저가 혼란스러워할 수 있음
-- 아래 불필요한 인덱스가 있으면 삭제 (실제 존재하는 것만 실행)
-- DROP INDEX idx_chat_message_room_time ON chat_message;
-- DROP INDEX idx_chat_message_room_last_time ON chat_message;
-- DROP INDEX idx_chat_message_room_latest_time ON chat_message;
-- DROP INDEX idx_chat_message_comprehensive ON chat_message;
-- DROP INDEX idx_chat_message_room_created ON chat_message;

-- ==========================================
-- Step 5: 통계 업데이트 (옵티마이저가 인덱스 활용하도록)
-- ==========================================
ANALYZE TABLE chat_message;

-- ==========================================
-- Step 6: 옵티마이저 힌트 확인 (MySQL 8.0+)
-- ==========================================
-- 테이블 통계 정보 확인
SELECT 
    TABLE_NAME,
    TABLE_ROWS,
    AVG_ROW_LENGTH,
    DATA_LENGTH,
    INDEX_LENGTH
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'db_coreconnect' 
  AND TABLE_NAME = 'chat_message';

-- ==========================================
-- Step 7: 인덱스 사용 확인 (EXPLAIN으로 검증)
-- ==========================================
-- 테스트 쿼리 1: 기본 쿼리
EXPLAIN 
SELECT * 
FROM chat_message 
WHERE chat_room_id = 1 
ORDER BY sent_at DESC 
LIMIT 50;

-- 테스트 쿼리 2: 강제 인덱스 사용
EXPLAIN 
SELECT * 
FROM chat_message FORCE INDEX (idx_chat_message_room_sent_at)
WHERE chat_room_id = 1 
ORDER BY sent_at DESC 
LIMIT 50;

-- 테스트 쿼리 3: 커버링 인덱스 (SELECT * 대신 필요한 컬럼만)
EXPLAIN 
SELECT chat_message_id, chat_room_id, sent_at, content 
FROM chat_message 
WHERE chat_room_id = 1 
ORDER BY sent_at DESC 
LIMIT 50;

-- ✅ 기대 결과:
-- - type: ref 또는 range (ALL이 아니어야 함)
-- - key: idx_chat_message_room_sent_at (인덱스가 사용되어야 함)
-- - rows: 실제 반환될 행 수 정도 (전체 테이블 스캔 X)
-- - Extra: "Using where" 또는 "Using index condition" (filesort 없어야 함)

-- ❌ 문제 징후 (이렇게 나오면 인덱스 미사용):
-- - type: ALL (전체 테이블 스캔)
-- - key: NULL (인덱스 사용 안 함)
-- - Extra: "Using filesort" (정렬을 위해 별도 정렬 작업 수행)

-- ==========================================
-- Step 6: 인덱스 최종 확인
-- ==========================================
SHOW INDEX FROM chat_message WHERE Key_name = 'idx_chat_message_room_sent_at';


-- ==========================================
-- Option 2: created_at 컬럼 새로 추가
-- ==========================================

-- ⚠️ 주의: 이 방법은 테이블 구조 변경이 필요합니다!
-- 프로덕션 적용 시 백업 필수!

-- Step 1: created_at 컬럼 추가
ALTER TABLE chat_message 
ADD COLUMN created_at DATETIME NULL 
COMMENT '메시지 생성 시간';

-- Step 2: 기존 데이터 마이그레이션 (sent_at 값 복사)
UPDATE chat_message 
SET created_at = sent_at 
WHERE created_at IS NULL;

-- Step 3: NOT NULL 제약조건 추가 (선택사항)
-- ALTER TABLE chat_message 
-- MODIFY COLUMN created_at DATETIME NOT NULL;

-- Step 4: 인덱스 생성
CREATE INDEX idx_chat_message_room_created 
ON chat_message(chat_room_id, created_at DESC);

-- Step 5: 기존 인덱스와 함께 확인
SHOW INDEX FROM chat_message;


-- ==========================================
-- Option 3: sent_at과 created_at 모두 활용
-- ==========================================

-- 상황:
-- - sent_at: 실제 전송 시간
-- - created_at: 메시지 생성(작성) 시간
-- 
-- 대부분의 경우 sent_at으로 충분하지만,
-- 예약 메시지나 임시 저장 기능이 있다면 created_at이 유용할 수 있음

-- 복합 인덱스 생성
CREATE INDEX idx_chat_message_comprehensive 
ON chat_message(chat_room_id, sent_at DESC, created_at DESC);


-- ==========================================
-- 전체 채팅 관련 인덱스 (최종 권장안)
-- ==========================================

-- 1. 채팅 메시지: 채팅방별 최신 메시지 조회 (sent_at 사용)
CREATE INDEX idx_chat_message_room_time 
ON chat_message(chat_room_id, sent_at DESC);

-- 2. 채팅 메시지 읽음 상태: 사용자별 읽지 않은 메시지 수
-- ⚠️ 복합키 테이블이므로 인덱스 생성 방법 다름
CREATE INDEX idx_chat_read_status_user 
ON chat_message_read_status(user_id, chat_message_read_status_read_yn);

-- 3. 채팅방: 사용자가 참여 중인 채팅방 (chat_room_user 테이블)
-- CREATE INDEX idx_chat_room_user 
-- ON chat_room_user(user_id, chat_room_id);


-- ==========================================
-- 인덱스 효과 확인 (EXPLAIN)
-- ==========================================

-- 특정 채팅방의 최신 메시지 50개 조회
EXPLAIN 
SELECT * 
FROM chat_message 
WHERE chat_room_id = 1 
ORDER BY sent_at DESC 
LIMIT 50;

-- 확인 사항:
-- - type: ref (Index Range Scan) ← ALL에서 개선
-- - key: idx_chat_message_room_time
-- - rows: 50 ← 전체 행 수에서 개선
-- - Extra: Using index condition


-- 사용자별 읽지 않은 메시지 수
EXPLAIN 
SELECT COUNT(*) 
FROM chat_message_read_status 
WHERE user_id = 1 
  AND chat_message_read_status_read_yn = false;

-- 확인 사항:
-- - type: ref
-- - key: idx_chat_read_status_user


-- ==========================================
-- 성능 측정 (프로파일링)
-- ==========================================

SET profiling = 1;

-- 채팅방 최신 메시지 조회 테스트
SELECT * 
FROM chat_message 
WHERE chat_room_id = 1 
ORDER BY sent_at DESC 
LIMIT 50;

SHOW PROFILES;

-- 목표:
-- - BEFORE: 10-20ms
-- - AFTER: 2-5ms


-- ==========================================
-- 롤백 (문제 발생 시)
-- ==========================================

-- created_at 컬럼 삭제
-- ALTER TABLE chat_message DROP COLUMN created_at;

-- 인덱스 삭제
-- DROP INDEX idx_chat_message_room_time ON chat_message;
-- DROP INDEX idx_chat_message_room_created ON chat_message;
-- DROP INDEX idx_chat_read_status_user ON chat_message_read_status;


-- ==========================================
-- 프로덕션 적용 체크리스트
-- ==========================================

-- [ ] 1. 백업 완료 (mysqldump)
-- [ ] 2. 테스트 환경에서 테스트 완료
-- [ ] 3. 피크 시간 피하기 (새벽 3-4시)
-- [ ] 4. 온라인 DDL 사용 (ALGORITHM=INPLACE, LOCK=NONE)
-- [ ] 5. 인덱스 생성 완료 확인 (SHOW INDEX)
-- [ ] 6. EXPLAIN으로 효과 확인
-- [ ] 7. 애플리케이션 재시작 없이 즉시 반영됨
-- [ ] 8. 모니터링: 에러 로그 확인


-- ==========================================
-- 추천 방법 요약
-- ==========================================

/*
✅ 권장: Option 1 (기존 sent_at 사용)

이유:
1. 컬럼 추가 불필요 → 위험 최소화
2. 데이터 마이그레이션 불필요 → 시간 절약
3. 즉시 적용 가능
4. sent_at으로 충분히 정렬 가능

실행:
CREATE INDEX idx_chat_message_room_time 
ON chat_message(chat_room_id, sent_at DESC);

완료!
*/


