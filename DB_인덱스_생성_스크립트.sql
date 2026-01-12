-- ==========================================
-- CoreConnect 성능 최적화 인덱스 생성 스크립트
-- ==========================================
-- 작성일: 2025-12-19
-- 목적: 이메일, 채팅, 알림 조회 성능 개선
-- 예상 효과: 응답시간 67% 단축 (25-30ms → 8-10ms)
-- ==========================================

USE db_coreconnect;

-- ==========================================
-- 1. 이메일 받은편지함 최적화 (최우선!)
-- ==========================================

-- 1-1. EmailRecipient: 수신자 이메일 주소 기반 조회 (가장 중요!)
-- 용도: 받은 메일함 목록 조회, 읽지 않은 메일 수 조회
-- 쿼리: WHERE emailRecipientAddress = ? AND deleted = false ORDER BY (email의 emailSentTime)
CREATE INDEX idx_email_recipient_address_deleted 
ON email_recipient(emailRecipientAddress, deleted, emailReadYn);

-- 설명:
-- - emailRecipientAddress: 수신자 이메일로 필터링
-- - deleted: 삭제되지 않은 메일만
-- - emailReadYn: 읽지 않은 메일 필터링 시 사용

-- 1-2. EmailRecipient: 타입별 조회 (TO/CC/BCC)
-- 용도: 받은 메일함에서 타입별 필터링
CREATE INDEX idx_email_recipient_type 
ON email_recipient(emailRecipientAddress, emailRecipientType, deleted);

-- 1-3. Email: 발송 시간 정렬용
-- 용도: ORDER BY emailSentTime DESC
CREATE INDEX idx_email_sent_time 
ON email(emailSentTime DESC);

-- 1-4. Email: 발신자 이메일 기반 조회 (보낸 메일함)
-- 용도: 보낸 메일함 목록 조회
CREATE INDEX idx_email_sender_time 
ON email(sender_email, emailSentTime DESC);

-- 1-5. Email: 발신자 ID 기반 조회
-- 용도: 발신자 정보 조회, 통계
CREATE INDEX idx_email_sender_id 
ON email(senderId, emailSentTime DESC);

-- 1-6. Email: 상태별 조회
-- 용도: SENT, BOUNCE, DELETED 등 상태별 필터링
CREATE INDEX idx_email_status 
ON email(emailStatus, emailSentTime DESC);

-- 1-7. Email: 중요 메일 조회
-- 용도: 즐겨찾기(중요) 메일함
CREATE INDEX idx_email_favorite 
ON email(favoriteStatus, emailSentTime DESC);


-- ==========================================
-- 2. 채팅 관련 최적화
-- ==========================================

-- 2-1. ChatMessage: 채팅방 ID + 발송 시간 (⭐ sent_at 사용)
-- 용도: 특정 채팅방의 최신 메시지 조회
-- 참고: chat_message 테이블에는 sent_at 컬럼 사용 (created_at 없음)
CREATE INDEX idx_chat_message_room_time 
ON chat_message(chat_room_id, sent_at DESC);

-- 2-2. ChatMessageReadStatus: 읽지 않은 메시지 수
-- 용도: 사용자별 읽지 않은 메시지 수 조회
-- 참고: 실제 컬럼명은 chat_message_read_status_read_yn
CREATE INDEX idx_chat_read_status 
ON chat_message_read_status(user_id, chat_message_read_status_read_yn);

-- 2-3. ChatRoom: 사용자별 참여 채팅방
-- 용도: 사용자가 참여 중인 채팅방 목록
-- 참고: chat_room_user 중간 테이블이 있을 경우
-- CREATE INDEX idx_chat_room_user 
-- ON chat_room_user(user_id, room_id);


-- ==========================================
-- 3. 알림 관련 최적화
-- ==========================================

-- 3-1. Notification: 사용자별 알림 목록
-- 용도: 사용자별 알림 목록 조회 (최신순)
-- 참고: notification_sent_at 컬럼 사용
CREATE INDEX idx_notification_user_time 
ON notification(user_id, notification_sent_at DESC);

-- 3-2. Notification: 읽지 않은 알림
-- 용도: 읽지 않은 알림 수, 읽지 않은 알림 목록
-- 참고: notification_read_yn 컬럼 사용
CREATE INDEX idx_notification_user_read 
ON notification(user_id, notification_read_yn, notification_sent_at DESC);


-- ==========================================
-- 4. 사용자 관련 최적화
-- ==========================================

-- 4-1. User: 이메일 주소로 조회
-- ⭐ 주의: 이미 엔티티에 @Index로 정의되어 있음!
-- @Table(indexes = @Index(name = "idx_user_email", columnList = "user_email"))
-- 따라서 별도 생성 불필요
-- 확인: SHOW INDEX FROM users WHERE Key_name = 'idx_user_email';

-- 4-2. User: 부서별 조회
-- 용도: 부서별 사용자 목록, 조직도
-- 참고: 테이블명 users, 컬럼명 user_name
CREATE INDEX idx_user_department 
ON users(dept_id, user_name);


-- ==========================================
-- 5. 첨부파일 관련 최적화
-- ==========================================

-- 5-1. EmailFile: 이메일별 첨부파일
-- 용도: 특정 이메일의 첨부파일 목록 조회
CREATE INDEX idx_email_file_email_id 
ON email_file(email_id);


-- ==========================================
-- 6. 인덱스 생성 확인
-- ==========================================

-- 전체 인덱스 목록 확인
SHOW INDEX FROM email_recipient;
SHOW INDEX FROM email;
SHOW INDEX FROM chat_message;
SHOW INDEX FROM notification;

-- 인덱스 크기 확인
SELECT 
    table_name,
    index_name,
    ROUND(stat_value * @@innodb_page_size / 1024 / 1024, 2) AS size_mb
FROM mysql.innodb_index_stats
WHERE database_name = 'db_coreconnect'
  AND table_name IN ('email', 'email_recipient', 'chat_message', 'notification')
ORDER BY table_name, size_mb DESC;


-- ==========================================
-- 7. 인덱스 효과 확인 (EXPLAIN)
-- ==========================================

-- 7-1. 받은 메일함 조회 (BEFORE vs AFTER)
EXPLAIN 
SELECT r.*, e.*
FROM email_recipient r
LEFT JOIN email e ON r.email_id = e.emailId
WHERE r.emailRecipientAddress = 'admin@coreconnect.io.kr'
  AND r.deleted = false
ORDER BY e.emailSentTime DESC
LIMIT 20;

-- 확인 사항:
-- - type: ref (Index Range Scan) ← ALL(Full Scan)에서 개선
-- - key: idx_email_recipient_address_deleted ← NULL에서 개선
-- - rows: 20-100 ← 100,000+에서 개선
-- - Extra: Using index condition ← Using filesort에서 개선

-- 7-2. 채팅방 최신 메시지 조회
EXPLAIN 
SELECT * 
FROM chat_message 
WHERE chat_room_id = 1 
ORDER BY sent_at DESC 
LIMIT 50;

-- 확인 사항:
-- - type: ref (Index Range Scan)
-- - key: idx_chat_message_room_time
-- - rows: 50

-- 7-3. 읽지 않은 메일 수 조회
EXPLAIN 
SELECT COUNT(*)
FROM email_recipient r
WHERE r.emailRecipientAddress = 'admin@coreconnect.io.kr'
  AND r.deleted = false
  AND r.emailReadYn = false;

-- 확인 사항:
-- - type: ref
-- - key: idx_email_recipient_address_deleted
-- - rows: < 1000


-- ==========================================
-- 8. 성능 측정 (프로파일링)
-- ==========================================

-- 프로파일링 활성화
SET profiling = 1;

-- 8-1. 받은 메일함 조회 테스트
SELECT r.*, e.*
FROM email_recipient r
LEFT JOIN email e ON r.email_id = e.emailId
WHERE r.emailRecipientAddress = 'admin@coreconnect.io.kr'
  AND r.deleted = false
ORDER BY e.emailSentTime DESC
LIMIT 20;

-- 8-2. 채팅방 최신 메시지 조회 테스트
SELECT * 
FROM chat_message 
WHERE chat_room_id = 1 
ORDER BY sent_at DESC 
LIMIT 50;

-- 8-3. 알림 목록 조회 테스트
SELECT * 
FROM notification 
WHERE user_id = 1 
  AND notification_deleted_yn = false
ORDER BY notification_sent_at DESC 
LIMIT 30;

-- 실행 시간 확인
SHOW PROFILES;

-- 목표:
-- - 이메일: BEFORE 25-30ms → AFTER 5-10ms (67% 단축)
-- - 채팅: BEFORE 10-20ms → AFTER 2-5ms (70% 단축)
-- - 알림: BEFORE 5-10ms → AFTER 1-2ms (80% 단축)


-- ==========================================
-- 9. 롤백 스크립트 (문제 발생 시)
-- ==========================================

-- 모든 인덱스 삭제 (필요 시 실행)
/*
-- 이메일 관련
DROP INDEX idx_email_recipient_address_deleted ON email_recipient;
DROP INDEX idx_email_recipient_type ON email_recipient;
DROP INDEX idx_email_sent_time ON email;
DROP INDEX idx_email_sender_time ON email;
DROP INDEX idx_email_sender_id ON email;
DROP INDEX idx_email_status ON email;
DROP INDEX idx_email_favorite ON email;
DROP INDEX idx_email_file_email_id ON email_file;

-- 채팅 관련
DROP INDEX idx_chat_message_room_time ON chat_message;
DROP INDEX idx_chat_read_status ON chat_message_read_status;

-- 알림 관련
DROP INDEX idx_notification_user_time ON notification;
DROP INDEX idx_notification_user_read ON notification;

-- 사용자 관련
DROP INDEX idx_user_department ON users;
*/


-- ==========================================
-- 10. 프로덕션 적용 방법
-- ==========================================

-- ⚠️ 주의사항:
-- 1. 백업 필수: mysqldump로 DB 백업
-- 2. 피크 시간 피하기: 새벽 3-4시 작업 권장
-- 3. 온라인 DDL 사용: ALGORITHM=INPLACE, LOCK=NONE
-- 4. 인덱스 크기 확인: 디스크 용량 20-30% 여유 필요
-- 5. 모니터링: 인덱스 생성 중 에러 로그 확인

-- 온라인 DDL 예시 (테이블 락 방지):
/*
CREATE INDEX idx_email_recipient_address_deleted 
ON email_recipient(emailRecipientAddress, deleted, emailReadYn)
ALGORITHM=INPLACE, LOCK=NONE;
*/

-- ==========================================
-- 완료!
-- ==========================================

