-- =================================================================
-- ⚡ 인덱스 성능 비교 (초간단 버전)
-- =================================================================
-- 실행 시간: 10초
-- =================================================================

USE coreconnect;

-- 타이머 활성화
SET profiling = 1;
RESET QUERY CACHE;
FLUSH TABLES;

SELECT '⚡ 성능 측정 시작...' AS status;

-- 테스트 1: 채팅방 메시지 조회
SELECT * FROM chat_message WHERE chat_room_id = 1 ORDER BY sent_at DESC LIMIT 20;

-- 테스트 2: 사용자 채팅방 목록
SELECT * FROM chat_room_user WHERE user_id = 1;

-- 테스트 3: 읽지 않은 메시지 수
SELECT COUNT(*) FROM chat_message_read_status WHERE user_id = 1 AND chat_message_read_status_read_yn = 'N';

-- 실행 시간 확인
SELECT '✅ 완료! 아래 결과 확인' AS status;
SHOW PROFILES;

-- EXPLAIN 확인
SELECT '📊 EXPLAIN 결과' AS status;

EXPLAIN SELECT * FROM chat_message WHERE chat_room_id = 1 ORDER BY sent_at DESC LIMIT 20;
EXPLAIN SELECT * FROM chat_room_user WHERE user_id = 1;
EXPLAIN SELECT COUNT(*) FROM chat_message_read_status WHERE user_id = 1 AND chat_message_read_status_read_yn = 'N';

-- =================================================================
-- 📝 결과 기록
-- =================================================================
-- 
-- BEFORE (인덱스 생성 전):
-- ├─ 테스트 1: _____ 초
-- ├─ 테스트 2: _____ 초
-- └─ 테스트 3: _____ 초
--
-- AFTER (인덱스 생성 후):
-- ├─ 테스트 1: _____ 초
-- ├─ 테스트 2: _____ 초
-- └─ 테스트 3: _____ 초
--
-- 개선율:
-- ├─ 테스트 1: _____ %
-- ├─ 테스트 2: _____ %
-- └─ 테스트 3: _____ %
--
-- =================================================================




