-- =================================================================
-- 🔧 MySQL 8.0 인덱스 재생성 (IF EXISTS 없이)
-- =================================================================
-- MySQL Workbench 설정 필수:
-- Edit > Preferences > SQL Editor > "Continue on SQL Script Error" 체크
-- =================================================================

USE coreconnect;

SELECT '🗑️ 기존 인덱스 삭제 시작...' AS status;

-- =================================================================
-- 방법 1: 에러 무시하고 삭제 (가장 간단! ⭐)
-- =================================================================

-- chat_message 테이블 인덱스 삭제
DROP INDEX idx_chat_room_sent_at ON chat_message;
DROP INDEX idx_chat_room_read_yn ON chat_message;
DROP INDEX idx_sender_sent_at ON chat_message;
DROP INDEX idx_sent_at ON chat_message;

-- 에러 나도 계속 진행됨 ("Continue on SQL Script Error" 설정 덕분)

SELECT '✅ 인덱스 삭제 완료 (또는 없었음)' AS status;

-- =================================================================
-- 인덱스 재생성
-- =================================================================

SELECT '🚀 인덱스 생성 시작...' AS status;

-- 1. 채팅방별 메시지 조회 (가장 중요!)
CREATE INDEX idx_chat_room_sent_at 
ON chat_message(chat_room_id, sent_at DESC);

-- 2. 읽지 않은 메시지 조회
CREATE INDEX idx_chat_room_read_yn 
ON chat_message(chat_room_id, read_yn, sent_at DESC);

-- 3. 발신자별 메시지 조회
CREATE INDEX idx_sender_sent_at 
ON chat_message(sender_id, sent_at DESC);

-- 4. 전체 메시지 시간순 조회
CREATE INDEX idx_sent_at 
ON chat_message(sent_at DESC);

SELECT '✅ 인덱스 생성 완료!' AS status;

-- =================================================================
-- 통계 정보 업데이트
-- =================================================================

SELECT '📊 통계 업데이트 중...' AS status;

ANALYZE TABLE chat_message;

ALTER TABLE chat_message STATS_AUTO_RECALC=1;

OPTIMIZE TABLE chat_message;

SELECT '✅ 통계 업데이트 완료!' AS status;

-- =================================================================
-- 인덱스 확인
-- =================================================================

SELECT '🔍 인덱스 확인...' AS status;

SHOW INDEX FROM chat_message WHERE Key_name != 'PRIMARY';

-- =================================================================
-- EXPLAIN 테스트
-- =================================================================

SELECT '📊 EXPLAIN 테스트...' AS status;

EXPLAIN SELECT * FROM chat_message 
WHERE chat_room_id = 1 
ORDER BY sent_at DESC 
LIMIT 20;

-- 기대 결과:
-- type: ref (또는 range) ✅
-- key: idx_chat_room_sent_at ✅
-- rows: 작은 수 ✅

SELECT '🎉 완료!' AS final_status;




