-- =================================================================
-- 📊 채팅 시스템 인덱스 생성 (초간단 버전)
-- =================================================================
-- DROP 없이 바로 CREATE만 실행
-- 이미 인덱스가 있으면 에러 발생하지만 무시하고 진행
-- =================================================================

USE coreconnect;

-- =================================================================
-- 1️⃣ chat_message 테이블 인덱스 (4개)
-- =================================================================

CREATE INDEX idx_chat_room_sent_at ON chat_message(chat_room_id, sent_at DESC);
CREATE INDEX idx_chat_room_read_yn ON chat_message(chat_room_id, read_yn, sent_at DESC);
CREATE INDEX idx_sender_sent_at ON chat_message(sender_id, sent_at DESC);
CREATE INDEX idx_sent_at ON chat_message(sent_at DESC);

-- =================================================================
-- 2️⃣ chat_room 테이블 인덱스 (3개)
-- =================================================================

CREATE INDEX idx_room_name ON chat_room(room_name);
CREATE INDEX idx_room_type ON chat_room(room_type);
CREATE INDEX idx_drafter_id ON chat_room(user_id);

-- =================================================================
-- 3️⃣ chat_room_user 테이블 인덱스 (2개)
-- =================================================================

CREATE INDEX idx_user_id ON chat_room_user(user_id);
CREATE INDEX idx_chat_room_id ON chat_room_user(chat_room_id);

-- =================================================================
-- 4️⃣ chat_message_read_status 테이블 인덱스 (3개)
-- =================================================================

CREATE INDEX idx_chat_message_id ON chat_message_read_status(chat_message_id);
CREATE INDEX idx_user_read_status ON chat_message_read_status(user_id);
CREATE INDEX idx_user_unread ON chat_message_read_status(user_id, chat_message_read_status_read_yn);

-- =================================================================
-- ✅ 완료 확인
-- =================================================================

SELECT '✅ 인덱스 생성 완료!' AS status;

-- 인덱스 확인
SHOW INDEX FROM chat_message WHERE Key_name != 'PRIMARY';
SHOW INDEX FROM chat_room WHERE Key_name != 'PRIMARY';
SHOW INDEX FROM chat_room_user WHERE Key_name != 'PRIMARY';
SHOW INDEX FROM chat_message_read_status WHERE Key_name != 'PRIMARY';




