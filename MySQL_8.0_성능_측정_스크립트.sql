-- =================================================================
-- 📊 MySQL 8.0 성능 측정 스크립트
-- =================================================================
-- MySQL 8.0에서는 Query Cache가 제거되었습니다
-- 대신 InnoDB Buffer Pool 초기화를 사용합니다
-- =================================================================

USE coreconnect;

-- =================================================================
-- 1. 타이머 활성화
-- =================================================================

SET profiling = 1;

SELECT '✅ Profiling 활성화 완료' AS status;

-- =================================================================
-- 2. 캐시 초기화 (MySQL 8.0 호환)
-- =================================================================

-- Query Cache는 MySQL 8.0에서 제거되었으므로 사용하지 않음
-- RESET QUERY CACHE;  ❌ MySQL 8.0에서 에러 발생!

-- 테이블 캐시 초기화 (선택사항)
FLUSH TABLES;

-- InnoDB Buffer Pool 통계 리셋 (선택사항)
-- 주의: 프로덕션 환경에서는 신중하게 사용
-- SET GLOBAL innodb_buffer_pool_dump_now = ON;
-- SET GLOBAL innodb_buffer_pool_load_now = ON;

SELECT '✅ 캐시 초기화 완료' AS status;

-- =================================================================
-- 3. 성능 측정 시작
-- =================================================================

SELECT '🚀 성능 측정 시작...' AS status;

-- 테스트 1: 채팅방 메시지 조회
SELECT * FROM chat_message 
WHERE chat_room_id = 1 
ORDER BY sent_at DESC 
LIMIT 20;

-- 테스트 2: 사용자 채팅방 목록
SELECT * FROM chat_room_user 
WHERE user_id = 1;

-- 테스트 3: 읽지 않은 메시지 카운트
SELECT COUNT(*) AS unread_count
FROM chat_message_read_status 
WHERE user_id = 1 AND chat_message_read_status_read_yn = 'N';

-- =================================================================
-- 4. 실행 시간 확인
-- =================================================================

SELECT '✅ 측정 완료!' AS status;

-- 모든 쿼리 실행 시간 표시
SHOW PROFILES;

-- =================================================================
-- 5. EXPLAIN 분석
-- =================================================================

SELECT '📊 EXPLAIN 분석...' AS status;

EXPLAIN SELECT * FROM chat_message 
WHERE chat_room_id = 1 
ORDER BY sent_at DESC 
LIMIT 20;

EXPLAIN SELECT * FROM chat_room_user 
WHERE user_id = 1;

EXPLAIN SELECT COUNT(*) 
FROM chat_message_read_status 
WHERE user_id = 1 AND chat_message_read_status_read_yn = 'N';

SELECT '✅ 완료!' AS final_status;

-- =================================================================
-- 📝 MySQL 8.0 변경 사항
-- =================================================================
-- 
-- ❌ 제거됨: RESET QUERY CACHE
-- ❌ 제거됨: Query Cache 관련 모든 기능
-- 
-- ✅ 대안:
-- 1. FLUSH TABLES (테이블 캐시 초기화)
-- 2. InnoDB Buffer Pool 관리
-- 3. 반복 측정 후 평균 사용
-- 
-- =================================================================




