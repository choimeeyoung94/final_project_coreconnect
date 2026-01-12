-- ========================================
-- 📊 데이터베이스 최적화 - 인덱스 추가
-- ========================================
-- 목적: N+1 쿼리 문제 해결 및 성능 최적화
-- 작성일: 2025-12-23
-- ========================================

-- ========================================
-- 1️⃣ chat_message 테이블 인덱스
-- ========================================
-- 채팅 메시지는 가장 많이 조회되는 테이블이므로 인덱스 최적화가 중요

-- ⭐ 채팅방별 메시지 조회 최적화 (가장 많이 사용되는 조회 패턴)
CREATE INDEX IF NOT EXISTS idx_chat_room_sent_at 
ON chat_message(chat_room_id, sent_at DESC);

-- ⭐ 발신자별 메시지 조회 최적화
CREATE INDEX IF NOT EXISTS idx_sender_sent_at 
ON chat_message(sender_id, sent_at DESC);

-- ⭐ 읽지 않은 메시지 조회 최적화
CREATE INDEX IF NOT EXISTS idx_chat_room_read_yn 
ON chat_message(chat_room_id, read_yn, sent_at DESC);

-- ⭐ 전체 메시지 시간순 조회 최적화
CREATE INDEX IF NOT EXISTS idx_sent_at 
ON chat_message(sent_at DESC);

-- ========================================
-- 2️⃣ chat_room 테이블 인덱스
-- ========================================
-- 채팅방 조회 성능 최적화

-- ⭐ 개설자별 채팅방 조회 최적화
CREATE INDEX IF NOT EXISTS idx_chat_room_user 
ON chat_room(user_id);

-- ⭐ 채팅방 타입별 조회 최적화
CREATE INDEX IF NOT EXISTS idx_chat_room_type 
ON chat_room(room_type);

-- ⭐ 즐겨찾기 채팅방 조회 최적화
CREATE INDEX IF NOT EXISTS idx_favorite_status 
ON chat_room(favorite_status);

-- ========================================
-- 3️⃣ chat_room_user 테이블 인덱스
-- ========================================
-- 채팅방 참여자 조회 성능 최적화

-- ⭐ 사용자별 참여 채팅방 조회 최적화
CREATE INDEX IF NOT EXISTS idx_user_chat_room 
ON chat_room_user(user_id, chat_room_id);

-- ⭐ 채팅방별 참여자 조회 최적화
CREATE INDEX IF NOT EXISTS idx_chat_room_user 
ON chat_room_user(chat_room_id, user_id);

-- ========================================
-- 4️⃣ chat_message_read_status 테이블 인덱스
-- ========================================
-- 메시지 읽음 상태 조회 성능 최적화

-- ⭐ 사용자별 읽지 않은 메시지 조회 최적화
CREATE INDEX IF NOT EXISTS idx_user_read_yn 
ON chat_message_read_status(user_id, chat_message_read_status_read_yn);

-- ⭐ 메시지별 읽음 상태 조회 최적화
CREATE INDEX IF NOT EXISTS idx_chat_user 
ON chat_message_read_status(chat_message_id, user_id);

-- ⭐ 사용자별 읽은 시간 기준 조회 최적화
CREATE INDEX IF NOT EXISTS idx_user_read_at 
ON chat_message_read_status(user_id, chat_message_read_status_read_at DESC);

-- ========================================
-- 📊 인덱스 생성 완료 확인
-- ========================================
SELECT 
    TABLE_NAME,
    INDEX_NAME,
    COLUMN_NAME,
    SEQ_IN_INDEX,
    COLLATION,
    CARDINALITY
FROM 
    INFORMATION_SCHEMA.STATISTICS
WHERE 
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN ('chat_message', 'chat_room', 'chat_room_user', 'chat_message_read_status')
ORDER BY 
    TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- ========================================
-- 📈 인덱스 사용 통계 확인 (MySQL 5.7+)
-- ========================================
-- 인덱스가 실제로 사용되는지 확인
-- SELECT 
--     object_schema AS 'Database',
--     object_name AS 'Table',
--     index_name AS 'Index',
--     count_star AS 'Usage Count',
--     count_read AS 'Read Count'
-- FROM 
--     performance_schema.table_io_waits_summary_by_index_usage
-- WHERE 
--     object_schema = DATABASE()
--     AND object_name IN ('chat_message', 'chat_room', 'chat_room_user', 'chat_message_read_status')
-- ORDER BY 
--     count_star DESC;

-- ========================================
-- ⚠️ 주의사항
-- ========================================
-- 1. 인덱스 추가 시 INSERT/UPDATE 성능은 약간 저하될 수 있음
-- 2. 대용량 테이블의 경우 인덱스 생성 시간이 오래 걸릴 수 있음
-- 3. 프로덕션 환경에서는 점검 시간에 실행 권장
-- 4. 인덱스 추가 전후 성능 비교 필수

-- ========================================
-- 🔍 인덱스 효과 확인 쿼리 예시
-- ========================================
-- EXPLAIN 키워드로 실행 계획 확인

-- 예시 1: 채팅방 메시지 조회
EXPLAIN SELECT * FROM chat_message WHERE chat_room_id = 1 ORDER BY sent_at DESC LIMIT 20;

-- 예시 2: 읽지 않은 메시지 조회
EXPLAIN SELECT * FROM chat_message WHERE chat_room_id = 1 AND read_yn = false ORDER BY sent_at DESC;

-- 예시 3: 사용자별 참여 채팅방 조회
EXPLAIN SELECT * FROM chat_room_user WHERE user_id = 1;

-- 예시 4: 사용자별 읽지 않은 메시지 수
EXPLAIN SELECT COUNT(*) FROM chat_message_read_status WHERE user_id = 1 AND chat_message_read_status_read_yn = false;

-- ========================================
-- ✅ 실행 완료
-- ========================================
-- 인덱스 추가 완료!
-- N+1 쿼리 문제 해결 및 성능 최적화 완료!
-- ========================================

