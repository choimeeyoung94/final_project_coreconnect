-- =================================================================
-- 🧹 인덱스 완전 초기화 및 재생성 (MySQL 8.0)
-- =================================================================
-- 모든 중복 인덱스 제거하고 깨끗하게 4개만 남기기
-- =================================================================

USE coreconnect;

SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;
SELECT '🧹 인덱스 완전 초기화 시작' AS status;
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;

-- =================================================================
-- 1단계: 모든 기존 인덱스 완전 삭제
-- =================================================================

SELECT '🗑️ 1단계: 모든 기존 인덱스 삭제 중...' AS step;

-- 가능한 모든 인덱스 이름으로 삭제 시도
DROP INDEX IF EXISTS idx_sender_sent_at ON chat_message;
DROP INDEX IF EXISTS idx_chat_room_read_yn ON chat_message;
DROP INDEX IF EXISTS idx_chat_room_sent_at ON chat_message;
DROP INDEX IF EXISTS idx_sent_at ON chat_message;
DROP INDEX IF EXISTS idx_chat_message_room_sent_at ON chat_message;

SELECT '✅ 기존 인덱스 삭제 완료 (또는 없었음)' AS result;

-- 확인: PRIMARY KEY만 남아있어야 함
SELECT '📋 남은 인덱스 확인:' AS check_point;
SHOW INDEX FROM chat_message;

SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;

-- =================================================================
-- 2단계: 필요한 인덱스만 정확히 4개 생성
-- =================================================================

SELECT '🚀 2단계: 새 인덱스 생성 중...' AS step;

-- 1️⃣ 채팅방별 메시지 조회 (가장 많이 사용)
-- 쿼리: WHERE chat_room_id = ? ORDER BY sent_at DESC
CREATE INDEX idx_chat_room_sent_at 
ON chat_message(chat_room_id, sent_at DESC);
SELECT '  ✅ idx_chat_room_sent_at 생성' AS progress;

-- 2️⃣ 읽지 않은 메시지 조회
-- 쿼리: WHERE chat_room_id = ? AND read_yn = 'N' ORDER BY sent_at DESC
CREATE INDEX idx_chat_room_read_yn 
ON chat_message(chat_room_id, read_yn, sent_at DESC);
SELECT '  ✅ idx_chat_room_read_yn 생성' AS progress;

-- 3️⃣ 발신자별 메시지 조회
-- 쿼리: WHERE sender_id = ? ORDER BY sent_at DESC
CREATE INDEX idx_sender_sent_at 
ON chat_message(sender_id, sent_at DESC);
SELECT '  ✅ idx_sender_sent_at 생성' AS progress;

-- 4️⃣ 전체 메시지 시간순 조회
-- 쿼리: ORDER BY sent_at DESC
CREATE INDEX idx_sent_at 
ON chat_message(sent_at DESC);
SELECT '  ✅ idx_sent_at 생성' AS progress;

SELECT '✅ 새 인덱스 4개 생성 완료!' AS result;

SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;

-- =================================================================
-- 3단계: 통계 정보 업데이트
-- =================================================================

SELECT '📊 3단계: 통계 업데이트 중...' AS step;

ANALYZE TABLE chat_message;
SELECT '  ✅ ANALYZE TABLE 완료' AS progress;

ALTER TABLE chat_message STATS_AUTO_RECALC=1;
SELECT '  ✅ 자동 통계 재계산 활성화' AS progress;

OPTIMIZE TABLE chat_message;
SELECT '  ✅ 테이블 최적화 완료' AS progress;

SELECT '✅ 통계 업데이트 완료!' AS result;

SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;

-- =================================================================
-- 4단계: 최종 확인
-- =================================================================

SELECT '🔍 4단계: 최종 확인...' AS step;

-- 인덱스 개수 확인
SELECT 
    COUNT(DISTINCT INDEX_NAME) AS total_indexes,
    '개 (PRIMARY 제외)' AS note
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'coreconnect'
  AND TABLE_NAME = 'chat_message'
  AND INDEX_NAME != 'PRIMARY';

-- 인덱스 상세 목록
SELECT '📋 생성된 인덱스 목록:' AS info;
SELECT 
    INDEX_NAME AS '인덱스명',
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ', ') AS '컬럼',
    INDEX_TYPE AS '타입',
    CASE NON_UNIQUE 
        WHEN 0 THEN 'UNIQUE' 
        ELSE 'NON-UNIQUE' 
    END AS '구분'
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'coreconnect'
  AND TABLE_NAME = 'chat_message'
  AND INDEX_NAME != 'PRIMARY'
GROUP BY INDEX_NAME
ORDER BY INDEX_NAME;

SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;
SELECT '🎉 인덱스 완전 초기화 완료!' AS final_status;
SELECT '총 4개의 인덱스가 생성되었습니다' AS summary;
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;




