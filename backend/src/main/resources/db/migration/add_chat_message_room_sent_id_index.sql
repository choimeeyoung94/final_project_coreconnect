-- ⭐ chat_message 메시지 목록용 인덱스 (chat_room_id, sent_at, id)로 바꾸기
-- 메시지 목록은 ORDER BY sent_at DESC, id DESC + LIMIT, 커서(before/after)는 (sent_at, id) 비교로 읽음
-- 이 인덱스를 거꾸로 읽으면 정렬 없이(filesort 없이) 필요한 행만 읽고 멈춤
-- 예전 idx_chat_room_sent_at (chat_room_id, sent_at DESC)은 뒤에 붙는 기본키 id가 오름차순이라 id DESC 동점 정렬에 filesort가 필요했음
-- 운영(ddl-auto=validate)은 인덱스를 자동으로 만들지 않음 → 배포 전에 수동 실행
-- (validate는 인덱스를 검사하지 않아서 빼먹어도 서버는 뜨지만, 메시지 목록이 인덱스를 못 써서 느려짐)

-- 같은 chat_room_id로 시작하는 idx_chat_room_read_yn (chat_room_id, read_yn, sent_at DESC)도 지움
-- - 이 인덱스를 쓰는 조회를 부르는 곳이 없음 (chat_message.read_yn으로 거르는 쿼리는 정의만 있고 호출 없음)
-- - 남겨 두면 MySQL이 메시지 목록 조회에 이 인덱스를 골라 방 메시지 전부를 정렬함 (테스트 EXPLAIN에서 확인)

-- 1. 지금 인덱스 확인
SHOW INDEX FROM chat_message WHERE Key_name IN ('idx_chat_room_sent_at', 'idx_chat_room_read_yn', 'idx_chat_room_sent_at_id');

-- 2. 새 인덱스 추가 (InnoDB 온라인 DDL: 만드는 동안에도 읽기·쓰기 가능)
ALTER TABLE chat_message ADD INDEX idx_chat_room_sent_at_id (chat_room_id, sent_at, id), ALGORITHM=INPLACE, LOCK=NONE;

-- 3. 예전 인덱스 삭제 (1번에서 있는 것만 실행)
ALTER TABLE chat_message DROP INDEX idx_chat_room_sent_at;
ALTER TABLE chat_message DROP INDEX idx_chat_room_read_yn;

-- 4. 확인: key=idx_chat_room_sent_at_id, Extra에 Using filesort가 없어야 함 (방 id는 아무 방이나)
EXPLAIN SELECT id FROM chat_message WHERE chat_room_id = 1 ORDER BY sent_at DESC, id DESC LIMIT 20;
