-- =================================================================
-- ⚡ 인덱스 초기화 (초간단 버전)
-- =================================================================
-- MySQL Workbench 설정:
-- Edit > Preferences > SQL Editor > "Continue on SQL Script Error" 체크 필수!
-- =================================================================

USE coreconnect;

-- 모든 인덱스 삭제 (에러 나도 무시하고 계속)
DROP INDEX idx_sender_sent_at ON chat_message;
DROP INDEX idx_chat_room_read_yn ON chat_message;
DROP INDEX idx_chat_room_sent_at ON chat_message;
DROP INDEX idx_sent_at ON chat_message;
DROP INDEX idx_chat_message_room_sent_at ON chat_message;

-- 필요한 인덱스만 4개 생성
CREATE INDEX idx_chat_room_sent_at ON chat_message(chat_room_id, sent_at DESC);
CREATE INDEX idx_chat_room_read_yn ON chat_message(chat_room_id, read_yn, sent_at DESC);
CREATE INDEX idx_sender_sent_at ON chat_message(sender_id, sent_at DESC);
CREATE INDEX idx_sent_at ON chat_message(sent_at DESC);

-- 통계 업데이트
ANALYZE TABLE chat_message;

-- 확인
SHOW INDEX FROM chat_message WHERE Key_name != 'PRIMARY';

-- EXPLAIN 테스트
EXPLAIN SELECT * FROM chat_message WHERE chat_room_id = 1 ORDER BY sent_at DESC LIMIT 20;

SELECT '✅ 완료!' AS status;




