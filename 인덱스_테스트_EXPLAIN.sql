-- =================================================================
-- 📊 인덱스 사용 확인 테스트 (EXPLAIN)
-- =================================================================
-- 인덱스가 제대로 작동하는지 확인하는 완벽한 테스트
-- =================================================================

USE coreconnect;

SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;
SELECT '📊 인덱스 사용 확인 테스트' AS title;
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;

-- =================================================================
-- 테스트 1: 채팅방별 메시지 조회
-- =================================================================

SELECT '🧪 테스트 1: 채팅방별 메시지 조회' AS test_name;
SELECT '   인덱스: idx_chat_room_sent_at' AS expected_index;
SELECT '   컬럼: (chat_room_id, sent_at)' AS index_columns;

EXPLAIN SELECT * FROM chat_message 
WHERE chat_room_id = 1 
ORDER BY sent_at DESC 
LIMIT 20;

-- ✅ 성공 기준:
-- type: ref 또는 range (ALL이 아님!)
-- key: idx_chat_room_sent_at
-- rows: 작은 수 (전체 행 수가 아님)

SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;

-- =================================================================
-- 테스트 2: 읽지 않은 메시지 조회
-- =================================================================

SELECT '🧪 테스트 2: 읽지 않은 메시지 조회' AS test_name;
SELECT '   인덱스: idx_chat_room_read_yn' AS expected_index;
SELECT '   컬럼: (chat_room_id, read_yn, sent_at)' AS index_columns;

EXPLAIN SELECT * FROM chat_message 
WHERE chat_room_id = 1 
  AND read_yn = 'N' 
ORDER BY sent_at DESC;

-- ✅ 성공 기준:
-- type: ref 또는 range
-- key: idx_chat_room_read_yn
-- rows: 작은 수

SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;

-- =================================================================
-- 테스트 3: 발신자별 메시지 조회
-- =================================================================

SELECT '🧪 테스트 3: 발신자별 메시지 조회' AS test_name;
SELECT '   인덱스: idx_sender_sent_at' AS expected_index;
SELECT '   컬럼: (sender_id, sent_at)' AS index_columns;

EXPLAIN SELECT * FROM chat_message 
WHERE sender_id = 1 
ORDER BY sent_at DESC 
LIMIT 20;

-- ✅ 성공 기준:
-- type: ref 또는 range
-- key: idx_sender_sent_at
-- rows: 작은 수

SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;

-- =================================================================
-- 테스트 4: 전체 메시지 시간순 조회
-- =================================================================

SELECT '🧪 테스트 4: 전체 메시지 시간순 조회' AS test_name;
SELECT '   인덱스: idx_sent_at' AS expected_index;
SELECT '   컬럼: (sent_at)' AS index_columns;

EXPLAIN SELECT * FROM chat_message 
ORDER BY sent_at DESC 
LIMIT 100;

-- ✅ 성공 기준:
-- type: index
-- key: idx_sent_at
-- rows: 작은 수

SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;

-- =================================================================
-- 테스트 5: 복잡한 JOIN 쿼리
-- =================================================================

SELECT '🧪 테스트 5: 복잡한 JOIN 쿼리' AS test_name;

EXPLAIN SELECT 
    cm.chat_message_id,
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

-- ✅ 성공 기준:
-- chat_message: key = idx_chat_room_sent_at

SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;

-- =================================================================
-- 📊 EXPLAIN 결과 해석 가이드
-- =================================================================

SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;
SELECT '📊 EXPLAIN 결과 해석 가이드' AS guide;
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;

SELECT 
    '항목' AS item,
    '성공 ✅' AS success,
    '실패 ❌' AS fail
UNION ALL
SELECT 'type', 'ref, range, index', 'ALL'
UNION ALL
SELECT 'key', 'idx_xxx (인덱스명)', 'NULL'
UNION ALL
SELECT 'rows', '작은 수 (100 이하)', '큰 수 (1000+)'
UNION ALL
SELECT 'Extra', 'Using index (최고!)', 'Using filesort (느림)';

SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;

-- =================================================================
-- 🎯 성능 비교 (선택사항)
-- =================================================================

SELECT '🎯 실제 성능 측정 (선택사항)' AS optional_test;
SELECT 'SET profiling = 1 을 먼저 실행하세요' AS instruction;

-- 타이머 활성화
SET profiling = 1;

-- 테스트 쿼리 실행
SELECT * FROM chat_message WHERE chat_room_id = 1 ORDER BY sent_at DESC LIMIT 20;
SELECT * FROM chat_message WHERE chat_room_id = 1 AND read_yn = 'N' ORDER BY sent_at DESC;
SELECT * FROM chat_message WHERE sender_id = 1 ORDER BY sent_at DESC LIMIT 20;

-- 실행 시간 확인
SHOW PROFILES;

SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;
SELECT '✅ 테스트 완료!' AS final_status;
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS separator;

-- =================================================================
-- 📝 결과 기록 템플릿
-- =================================================================

SELECT '
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 테스트 결과 기록

테스트 1 (채팅방 메시지):
├─ type: _______ (기대: ref)
├─ key: _______ (기대: idx_chat_room_sent_at)
└─ rows: _______ (기대: 100 이하)

테스트 2 (읽지 않은 메시지):
├─ type: _______ (기대: ref)
├─ key: _______ (기대: idx_chat_room_read_yn)
└─ rows: _______ (기대: 50 이하)

테스트 3 (발신자별 메시지):
├─ type: _______ (기대: ref)
├─ key: _______ (기대: idx_sender_sent_at)
└─ rows: _______ (기대: 20 이하)

테스트 4 (시간순 전체 조회):
├─ type: _______ (기대: index)
├─ key: _______ (기대: idx_sent_at)
└─ rows: _______ (기대: 100)

✅ 모든 테스트 통과: YES / NO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
' AS result_template;




