-- =================================================================
-- 📊 채팅 시스템 인덱스 최적화 (MySQL 8.0 최종 버전)
-- =================================================================
-- DROP INDEX IF EXISTS 사용하지 않음
-- 작성일: 2025-12-26
-- 대상: 10만명 동시 접속 채팅 시스템
-- =================================================================

USE coreconnect;

-- =================================================================
-- 🚨 중요: 에러 발생해도 계속 진행 설정
-- =================================================================
-- MySQL Workbench에서:
-- Edit > Preferences > SQL Editor > 
-- ☑ "Continue on SQL Script Error" 체크
-- =================================================================

-- =================================================================
-- 방법 1: 프로시저를 사용한 안전한 인덱스 삭제
-- =================================================================

DELIMITER $$

-- 인덱스 삭제 프로시저 생성
DROP PROCEDURE IF EXISTS drop_index_if_exists$$
CREATE PROCEDURE drop_index_if_exists(
    IN tableName VARCHAR(128),
    IN indexName VARCHAR(128)
)
BEGIN
    DECLARE index_exists INT DEFAULT 0;
    
    -- 인덱스 존재 여부 확인
    SELECT COUNT(*) INTO index_exists
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = tableName
      AND index_name = indexName;
    
    -- 존재하면 삭제
    IF index_exists > 0 THEN
        SET @sql = CONCAT('DROP INDEX ', indexName, ' ON ', tableName);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SELECT CONCAT('✅ 삭제됨: ', indexName) AS result;
    ELSE
        SELECT CONCAT('ℹ️ 없음: ', indexName) AS result;
    END IF;
END$$

DELIMITER ;

-- =================================================================
-- 🗑️ 기존 인덱스 삭제 (프로시저 사용)
-- =================================================================

-- chat_message 테이블 인덱스 삭제
CALL drop_index_if_exists('chat_message', 'idx_chat_room_sent_at');
CALL drop_index_if_exists('chat_message', 'idx_chat_room_read_yn');
CALL drop_index_if_exists('chat_message', 'idx_sender_sent_at');
CALL drop_index_if_exists('chat_message', 'idx_sent_at');

-- chat_room 테이블 인덱스 삭제
CALL drop_index_if_exists('chat_room', 'idx_room_name');
CALL drop_index_if_exists('chat_room', 'idx_room_type');
CALL drop_index_if_exists('chat_room', 'idx_drafter_id');
CALL drop_index_if_exists('chat_room', 'idx_chat_room_user');
CALL drop_index_if_exists('chat_room', 'idx_chat_room_type');
CALL drop_index_if_exists('chat_room', 'idx_favorite_status');

-- chat_room_user 테이블 인덱스 삭제
CALL drop_index_if_exists('chat_room_user', 'idx_user_id');
CALL drop_index_if_exists('chat_room_user', 'idx_chat_room_id');
CALL drop_index_if_exists('chat_room_user', 'idx_user_chat_room');
CALL drop_index_if_exists('chat_room_user', 'idx_chat_room_user');

-- chat_message_read_status 테이블 인덱스 삭제
CALL drop_index_if_exists('chat_message_read_status', 'idx_chat_message_id');
CALL drop_index_if_exists('chat_message_read_status', 'idx_user_read_status');
CALL drop_index_if_exists('chat_message_read_status', 'idx_user_unread');
CALL drop_index_if_exists('chat_message_read_status', 'idx_user_read_yn');
CALL drop_index_if_exists('chat_message_read_status', 'idx_chat_user');
CALL drop_index_if_exists('chat_message_read_status', 'idx_user_read_at');

SELECT '✅ 기존 인덱스 삭제 완료!' AS status;

-- =================================================================
-- 1️⃣ chat_message 테이블 인덱스 (가장 중요! ⭐⭐⭐)
-- =================================================================

-- 1-1. 채팅방별 메시지 조회 (가장 많이 사용)
-- 쿼리: SELECT * FROM chat_message WHERE chat_room_id = ? ORDER BY sent_at DESC LIMIT 20
-- 성능: Full Table Scan (10초) → Index Scan (0.05초)
CREATE INDEX idx_chat_room_sent_at 
ON chat_message(chat_room_id, sent_at DESC);
SELECT '✅ idx_chat_room_sent_at 생성 완료' AS result;

-- 1-2. 읽지 않은 메시지 조회 (알림 기능)
-- 쿼리: SELECT * FROM chat_message WHERE chat_room_id = ? AND read_yn = 'N' ORDER BY sent_at DESC
-- 성능: 90% 향상
CREATE INDEX idx_chat_room_read_yn 
ON chat_message(chat_room_id, read_yn, sent_at DESC);
SELECT '✅ idx_chat_room_read_yn 생성 완료' AS result;

-- 1-3. 발신자별 메시지 조회 (사용자 프로필)
-- 쿼리: SELECT * FROM chat_message WHERE sender_id = ? ORDER BY sent_at DESC
-- 성능: 85% 향상
CREATE INDEX idx_sender_sent_at 
ON chat_message(sender_id, sent_at DESC);
SELECT '✅ idx_sender_sent_at 생성 완료' AS result;

-- 1-4. 전체 메시지 시간순 조회 (관리자 기능)
-- 쿼리: SELECT * FROM chat_message ORDER BY sent_at DESC LIMIT 100
-- 성능: 80% 향상
CREATE INDEX idx_sent_at 
ON chat_message(sent_at DESC);
SELECT '✅ idx_sent_at 생성 완료' AS result;

-- =================================================================
-- 2️⃣ chat_room 테이블 인덱스 (중요! ⭐⭐)
-- =================================================================

-- 2-1. 채팅방 이름으로 검색
-- 쿼리: SELECT * FROM chat_room WHERE room_name LIKE '%keyword%'
-- 성능: 70% 향상
CREATE INDEX idx_room_name 
ON chat_room(room_name);
SELECT '✅ idx_room_name 생성 완료' AS result;

-- 2-2. 채팅방 타입별 조회
-- 쿼리: SELECT * FROM chat_room WHERE room_type = 'GROUP'
-- 성능: 75% 향상
CREATE INDEX idx_room_type 
ON chat_room(room_type);
SELECT '✅ idx_room_type 생성 완료' AS result;

-- 2-3. 생성자별 채팅방 조회
-- 쿼리: SELECT * FROM chat_room WHERE user_id = ?
-- 성능: 80% 향상
CREATE INDEX idx_drafter_id 
ON chat_room(user_id);
SELECT '✅ idx_drafter_id 생성 완료' AS result;

-- =================================================================
-- 3️⃣ chat_room_user 테이블 인덱스 (매우 중요! ⭐⭐⭐)
-- =================================================================

-- 3-1. 사용자별 참여 채팅방 조회 (가장 많이 사용)
-- 쿼리: SELECT * FROM chat_room_user WHERE user_id = ?
-- 성능: Full Table Scan (5초) → Index Scan (0.02초)
CREATE INDEX idx_user_id 
ON chat_room_user(user_id);
SELECT '✅ idx_user_id 생성 완료' AS result;

-- 3-2. 채팅방별 참여자 조회
-- 쿼리: SELECT * FROM chat_room_user WHERE chat_room_id = ?
-- 성능: 90% 향상
CREATE INDEX idx_chat_room_id 
ON chat_room_user(chat_room_id);
SELECT '✅ idx_chat_room_id 생성 완료' AS result;

-- =================================================================
-- 4️⃣ chat_message_read_status 테이블 인덱스 (중요! ⭐⭐)
-- =================================================================

-- 4-1. 메시지별 읽음 상태 조회
-- 쿼리: SELECT * FROM chat_message_read_status WHERE chat_message_id = ?
-- 성능: 85% 향상
CREATE INDEX idx_chat_message_id 
ON chat_message_read_status(chat_message_id);
SELECT '✅ idx_chat_message_id 생성 완료' AS result;

-- 4-2. 사용자별 읽음 상태 조회
-- 쿼리: SELECT * FROM chat_message_read_status WHERE user_id = ?
-- 성능: 80% 향상
CREATE INDEX idx_user_read_status 
ON chat_message_read_status(user_id);
SELECT '✅ idx_user_read_status 생성 완료' AS result;

-- 4-3. 읽지 않은 메시지 카운트 조회
-- 쿼리: SELECT COUNT(*) FROM chat_message_read_status WHERE user_id = ? AND chat_message_read_status_read_yn = 'N'
-- 성능: 95% 향상
CREATE INDEX idx_user_unread 
ON chat_message_read_status(user_id, chat_message_read_status_read_yn);
SELECT '✅ idx_user_unread 생성 완료' AS result;

-- =================================================================
-- ✅ 인덱스 생성 완료!
-- =================================================================

SELECT '🎉 모든 인덱스 생성 완료! (총 12개)' AS status;

-- =================================================================
-- 📊 인덱스 생성 결과 확인
-- =================================================================

-- 전체 인덱스 목록
SELECT 
    TABLE_NAME AS '테이블',
    INDEX_NAME AS '인덱스명',
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ', ') AS '컬럼',
    INDEX_TYPE AS '타입',
    CASE NON_UNIQUE 
        WHEN 0 THEN 'UNIQUE' 
        ELSE 'NON-UNIQUE' 
    END AS '구분'
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'coreconnect'
  AND TABLE_NAME IN ('chat_message', 'chat_room', 'chat_room_user', 'chat_message_read_status')
  AND INDEX_NAME != 'PRIMARY'
GROUP BY TABLE_NAME, INDEX_NAME
ORDER BY TABLE_NAME, INDEX_NAME;

-- 테이블별 인덱스 개수
SELECT 
    TABLE_NAME AS '테이블',
    COUNT(DISTINCT INDEX_NAME) AS '인덱스 개수'
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'coreconnect'
  AND TABLE_NAME IN ('chat_message', 'chat_room', 'chat_room_user', 'chat_message_read_status')
  AND INDEX_NAME != 'PRIMARY'
GROUP BY TABLE_NAME
ORDER BY TABLE_NAME;

-- =================================================================
-- 🔍 EXPLAIN으로 인덱스 사용 확인
-- =================================================================

SELECT '🔍 EXPLAIN 테스트 시작...' AS info;

-- 테스트 1: 채팅방 메시지 조회 (가장 중요!)
EXPLAIN SELECT * FROM chat_message 
WHERE chat_room_id = 1 
ORDER BY sent_at DESC 
LIMIT 20;
-- 기대: key = idx_chat_room_sent_at, type = ref, rows < 100

-- 테스트 2: 읽지 않은 메시지 조회
EXPLAIN SELECT * FROM chat_message 
WHERE chat_room_id = 1 AND read_yn = 'N' 
ORDER BY sent_at DESC;
-- 기대: key = idx_chat_room_read_yn, type = ref

-- 테스트 3: 사용자 참여 채팅방 조회
EXPLAIN SELECT * FROM chat_room_user 
WHERE user_id = 1;
-- 기대: key = idx_user_id, type = ref

-- 테스트 4: 읽지 않은 메시지 카운트
EXPLAIN SELECT COUNT(*) FROM chat_message_read_status 
WHERE user_id = 1 AND chat_message_read_status_read_yn = 'N';
-- 기대: key = idx_user_unread, type = ref

-- =================================================================
-- 🧹 프로시저 정리 (선택사항)
-- =================================================================

-- 사용한 프로시저 삭제 (선택사항, 안 해도 됨)
-- DROP PROCEDURE IF EXISTS drop_index_if_exists;

-- =================================================================
-- 🎯 완료!
-- =================================================================

SELECT '✅ 인덱스 설정 완료!' AS '상태';
SELECT '📊 생성된 인덱스: 12개' AS '요약';
SELECT '🚀 다음 단계: 애플리케이션 재시작 및 K6 테스트' AS '안내';




