-- =================================================================
-- 📊 채팅 시스템 인덱스 최적화 (MySQL 5.7+ 호환)
-- =================================================================
-- DESC 키워드 제거 버전 (모든 MySQL 버전 호환)
-- =================================================================

USE coreconnect;

-- -----------------------------------------------------------------
-- 1️⃣ chat_message 테이블 인덱스 (가장 중요! ⭐⭐⭐)
-- -----------------------------------------------------------------

-- 1-1. 채팅방별 메시지 조회 (가장 많이 사용)
CREATE INDEX idx_chat_room_sent_at 
ON chat_message(chat_room_id, sent_at);

-- 1-2. 읽지 않은 메시지 조회
CREATE INDEX idx_chat_room_read_yn 
ON chat_message(chat_room_id, read_yn, sent_at);

-- 1-3. 발신자별 메시지 조회
CREATE INDEX idx_sender_sent_at 
ON chat_message(sender_id, sent_at);

-- 1-4. 전체 메시지 시간순 조회 (관리자 기능)
CREATE INDEX idx_sent_at 
ON chat_message(sent_at);

-- -----------------------------------------------------------------
-- 2️⃣ chat_room 테이블 인덱스 (중요! ⭐⭐)
-- -----------------------------------------------------------------

-- 2-1. 개설자별 채팅방 조회
CREATE INDEX idx_chat_room_user 
ON chat_room(user_id);

-- 2-2. 채팅방 타입별 조회
CREATE INDEX idx_chat_room_type 
ON chat_room(room_type);

-- 2-3. 즐겨찾기 채팅방 조회
CREATE INDEX idx_favorite_status 
ON chat_room(favorite_status);

-- -----------------------------------------------------------------
-- 3️⃣ chat_room_user 테이블 인덱스 (중요! ⭐⭐⭐)
-- -----------------------------------------------------------------

-- 3-1. 사용자별 참여 채팅방 조회
CREATE INDEX idx_user_chat_room 
ON chat_room_user(user_id, chat_room_id);

-- 3-2. 채팅방별 참여자 조회
CREATE INDEX idx_chat_room_user 
ON chat_room_user(chat_room_id, user_id);

-- -----------------------------------------------------------------
-- 4️⃣ chat_message_read_status 테이블 인덱스 (중요! ⭐⭐)
-- -----------------------------------------------------------------

-- 4-1. 사용자별 읽지 않은 메시지 조회
CREATE INDEX idx_user_read_yn 
ON chat_message_read_status(user_id, chat_message_read_status_read_yn);

-- 4-2. 메시지별 읽음 상태 조회
CREATE INDEX idx_chat_user 
ON chat_message_read_status(chat_message_id, user_id);

-- 4-3. 사용자별 읽은 시간 기준 조회
CREATE INDEX idx_user_read_at 
ON chat_message_read_status(user_id, chat_message_read_status_read_at);

-- -----------------------------------------------------------------
-- ✅ 인덱스 생성 완료 확인
-- -----------------------------------------------------------------

SELECT '✅ 모든 인덱스 생성 완료!' AS status;

-- 인덱스 목록 확인
SHOW INDEX FROM chat_message;
SHOW INDEX FROM chat_room;
SHOW INDEX FROM chat_room_user;
SHOW INDEX FROM chat_message_read_status;




