-- =================================================================
-- 📊 인덱스 성능 비교 테스트 (빠른 실행용)
-- =================================================================
-- 사용 방법:
-- 1. 인덱스 생성 전에 이 스크립트 실행 (BEFORE 측정)
-- 2. 인덱스 생성
-- 3. 다시 이 스크립트 실행 (AFTER 측정)
-- 4. 두 결과 비교
-- =================================================================

USE coreconnect;

-- 타이머 활성화
SET profiling = 1;

-- 캐시 초기화
RESET QUERY CACHE;
FLUSH TABLES;

SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;
SELECT '📊 성능 측정 시작' AS status;
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;

-- =================================================================
-- 🧪 테스트 1: 채팅방 메시지 조회 (가장 중요!)
-- =================================================================

SELECT '🧪 테스트 1: 채팅방 메시지 조회 (LIMIT 20)' AS test_name;

SELECT * FROM chat_message 
WHERE chat_room_id = 1 
ORDER BY sent_at DESC 
LIMIT 20;

-- =================================================================
-- 🧪 테스트 2: 읽지 않은 메시지 조회
-- =================================================================

SELECT '🧪 테스트 2: 읽지 않은 메시지 조회' AS test_name;

SELECT * FROM chat_message 
WHERE chat_room_id = 1 AND read_yn = 'N' 
ORDER BY sent_at DESC;

-- =================================================================
-- 🧪 테스트 3: 사용자 참여 채팅방 조회
-- =================================================================

SELECT '🧪 테스트 3: 사용자 참여 채팅방 조회' AS test_name;

SELECT * FROM chat_room_user 
WHERE user_id = 1;

-- =================================================================
-- 🧪 테스트 4: 채팅방 참여자 목록 (JOIN)
-- =================================================================

SELECT '🧪 테스트 4: 채팅방 참여자 목록 조회 (JOIN)' AS test_name;

SELECT cru.*, u.user_name, u.user_email 
FROM chat_room_user cru
JOIN users u ON cru.user_id = u.user_id
WHERE cru.chat_room_id = 1;

-- =================================================================
-- 🧪 테스트 5: 읽지 않은 메시지 개수 카운트
-- =================================================================

SELECT '🧪 테스트 5: 읽지 않은 메시지 카운트' AS test_name;

SELECT COUNT(*) AS unread_count
FROM chat_message_read_status 
WHERE user_id = 1 AND chat_message_read_status_read_yn = 'N';

-- =================================================================
-- 🧪 테스트 6: 최근 메시지 100개 (복잡한 JOIN)
-- =================================================================

SELECT '🧪 테스트 6: 최근 메시지 100개 조회 (복잡한 JOIN)' AS test_name;

SELECT 
    cm.chat_message_id,
    cm.chat_room_id,
    cm.content,
    cm.sent_at,
    u.user_name AS sender_name,
    cr.room_name
FROM chat_message cm
LEFT JOIN users u ON cm.sender_id = u.user_id
LEFT JOIN chat_room cr ON cm.chat_room_id = cr.chat_room_id
WHERE cm.chat_room_id = 1
ORDER BY cm.sent_at DESC
LIMIT 100;

-- =================================================================
-- 🧪 테스트 7: 발신자별 메시지 조회
-- =================================================================

SELECT '🧪 테스트 7: 발신자별 메시지 조회' AS test_name;

SELECT * FROM chat_message 
WHERE sender_id = 1 
ORDER BY sent_at DESC 
LIMIT 20;

-- =================================================================
-- 🧪 테스트 8: 채팅방 타입별 조회
-- =================================================================

SELECT '🧪 테스트 8: 채팅방 타입별 조회' AS test_name;

SELECT * FROM chat_room 
WHERE room_type = 'GROUP' 
LIMIT 20;

-- =================================================================
-- 📊 실행 시간 확인
-- =================================================================

SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;
SELECT '✅ 측정 완료! 아래에서 실행 시간을 확인하세요' AS status;
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;

-- 모든 쿼리 실행 시간 표시
SHOW PROFILES;

SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;
SELECT '📋 주요 쿼리 실행 계획 (EXPLAIN)' AS section;
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;

-- =================================================================
-- 📋 EXPLAIN 분석
-- =================================================================

-- EXPLAIN 1: 채팅방 메시지 조회
SELECT '📋 EXPLAIN 1: 채팅방 메시지 조회' AS explain_name;
EXPLAIN 
SELECT * FROM chat_message 
WHERE chat_room_id = 1 
ORDER BY sent_at DESC 
LIMIT 20;

SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;

-- EXPLAIN 2: 사용자 참여 채팅방
SELECT '📋 EXPLAIN 2: 사용자 참여 채팅방 조회' AS explain_name;
EXPLAIN 
SELECT * FROM chat_room_user 
WHERE user_id = 1;

SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;

-- EXPLAIN 3: 읽지 않은 메시지 카운트
SELECT '📋 EXPLAIN 3: 읽지 않은 메시지 카운트' AS explain_name;
EXPLAIN 
SELECT COUNT(*) 
FROM chat_message_read_status 
WHERE user_id = 1 AND chat_message_read_status_read_yn = 'N';

SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;

-- EXPLAIN 4: 복잡한 JOIN 쿼리
SELECT '📋 EXPLAIN 4: 복잡한 JOIN 쿼리' AS explain_name;
EXPLAIN 
SELECT 
    cm.chat_message_id,
    cm.content,
    u.user_name,
    cr.room_name
FROM chat_message cm
LEFT JOIN users u ON cm.sender_id = u.user_id
LEFT JOIN chat_room cr ON cm.chat_room_id = cr.chat_room_id
WHERE cm.chat_room_id = 1
ORDER BY cm.sent_at DESC
LIMIT 100;

-- =================================================================
-- 📊 결과 기록용 템플릿
-- =================================================================

SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;
SELECT '📝 결과를 아래 표에 기록하세요' AS instruction;
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;

SELECT 
    '테스트명' AS test_case,
    'Query ID' AS query_id,
    '실행시간(초)' AS duration,
    'EXPLAIN type' AS explain_type,
    'EXPLAIN key' AS explain_key,
    'EXPLAIN rows' AS explain_rows

UNION ALL SELECT '1. 채팅방 메시지 조회', '?', '?', '?', '?', '?'
UNION ALL SELECT '2. 읽지 않은 메시지', '?', '?', '?', '?', '?'
UNION ALL SELECT '3. 사용자 채팅방 목록', '?', '?', '?', '?', '?'
UNION ALL SELECT '4. 채팅방 참여자 (JOIN)', '?', '?', '?', '?', '?'
UNION ALL SELECT '5. 읽지 않은 메시지 수', '?', '?', '?', '?', '?'
UNION ALL SELECT '6. 최근 메시지 100개', '?', '?', '?', '?', '?'
UNION ALL SELECT '7. 발신자별 메시지', '?', '?', '?', '?', '?'
UNION ALL SELECT '8. 채팅방 타입별 조회', '?', '?', '?', '?', '?';

SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;
SELECT '✅ 성능 측정 완료!' AS final_status;
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;

-- =================================================================
-- 📌 사용 방법
-- =================================================================
-- 
-- STEP 1: 인덱스 생성 전 (BEFORE)
-- ├─ 이 스크립트 실행
-- ├─ SHOW PROFILES 결과 기록
-- └─ EXPLAIN 결과 기록 (type, key, rows)
--
-- STEP 2: 인덱스 생성
-- └─ MySQL_8.0_빠른_인덱스_생성.sql 실행
--
-- STEP 3: 인덱스 생성 후 (AFTER)
-- ├─ 이 스크립트 다시 실행
-- ├─ SHOW PROFILES 결과 기록
-- └─ EXPLAIN 결과 기록
--
-- STEP 4: 비교 분석
-- ├─ BEFORE vs AFTER 실행 시간 비교
-- ├─ EXPLAIN type 비교 (ALL → ref)
-- ├─ EXPLAIN rows 비교 (큰 수 → 작은 수)
-- └─ 개선율 계산
--
-- =================================================================




