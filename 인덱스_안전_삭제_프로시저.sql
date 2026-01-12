-- =================================================================
-- 🔧 MySQL 8.0 인덱스 안전 삭제 (프로시저 사용)
-- =================================================================
-- IF EXISTS 기능을 프로시저로 구현
-- =================================================================

USE coreconnect;

-- =================================================================
-- 프로시저 생성: 인덱스 안전 삭제
-- =================================================================

DELIMITER $$

DROP PROCEDURE IF EXISTS safe_drop_index$$

CREATE PROCEDURE safe_drop_index(
    IN p_table_name VARCHAR(128),
    IN p_index_name VARCHAR(128)
)
BEGIN
    DECLARE index_exists INT DEFAULT 0;
    
    -- 인덱스 존재 여부 확인
    SELECT COUNT(*) INTO index_exists
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
      AND index_name = p_index_name;
    
    -- 존재하면 삭제
    IF index_exists > 0 THEN
        SET @sql = CONCAT('DROP INDEX `', p_index_name, '` ON `', p_table_name, '`');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SELECT CONCAT('✅ 삭제: ', p_index_name) AS result;
    ELSE
        SELECT CONCAT('ℹ️ 없음: ', p_index_name, ' (건너뜀)') AS result;
    END IF;
END$$

DELIMITER ;

SELECT '✅ 프로시저 생성 완료!' AS status;

-- =================================================================
-- 프로시저 사용: 기존 인덱스 안전 삭제
-- =================================================================

SELECT '🗑️ 기존 인덱스 삭제 시작...' AS status;

-- chat_message 테이블 인덱스 삭제
CALL safe_drop_index('chat_message', 'idx_chat_room_sent_at');
CALL safe_drop_index('chat_message', 'idx_chat_room_read_yn');
CALL safe_drop_index('chat_message', 'idx_sender_sent_at');
CALL safe_drop_index('chat_message', 'idx_sent_at');

-- 혹시 다른 이름으로 생성되었을 수도 있음
CALL safe_drop_index('chat_message', 'idx_chat_message_room_sent_at');

SELECT '✅ 기존 인덱스 삭제 완료!' AS status;

-- =================================================================
-- 인덱스 재생성
-- =================================================================

SELECT '🚀 인덱스 생성 시작...' AS status;

CREATE INDEX idx_chat_room_sent_at ON chat_message(chat_room_id, sent_at DESC);
CREATE INDEX idx_chat_room_read_yn ON chat_message(chat_room_id, read_yn, sent_at DESC);
CREATE INDEX idx_sender_sent_at ON chat_message(sender_id, sent_at DESC);
CREATE INDEX idx_sent_at ON chat_message(sent_at DESC);

SELECT '✅ 인덱스 생성 완료!' AS status;

-- =================================================================
-- 통계 업데이트
-- =================================================================

ANALYZE TABLE chat_message;
ALTER TABLE chat_message STATS_AUTO_RECALC=1;
OPTIMIZE TABLE chat_message;

SELECT '✅ 통계 업데이트 완료!' AS status;

-- =================================================================
-- 확인
-- =================================================================

-- 인덱스 목록
SHOW INDEX FROM chat_message WHERE Key_name != 'PRIMARY';

-- EXPLAIN 테스트
EXPLAIN SELECT * FROM chat_message 
WHERE chat_room_id = 1 
ORDER BY sent_at DESC 
LIMIT 20;

SELECT '🎉 모든 작업 완료!' AS final_status;

-- =================================================================
-- 프로시저 정리 (선택사항)
-- =================================================================

-- DROP PROCEDURE IF EXISTS safe_drop_index;




