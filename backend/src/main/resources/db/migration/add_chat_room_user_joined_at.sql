-- ⭐ chat_room_user 테이블에 joined_at(방에 들어온 시각) 컬럼 추가
-- 방 만들기·초대·다시 초대 때 들어온 시각을 저장하고, 메시지 목록은 이 시각 이후 메시지만 보여 줌
-- 운영(ddl-auto=validate)에서는 자동 반영되지 않으므로 배포 전에 수동 실행 (필수)
-- ⚠ validate는 엔티티에 있는 컬럼이 테이블에 없으면 서버 기동을 실패시킴 → 이 SQL을 빼먹으면 배포한 서버가 뜨지 않음

-- 1. 컬럼 추가 (기존 행은 NULL = "언제 들어왔는지 모름" → 메시지를 전부 보여 줌, 채우지 않음)
ALTER TABLE chat_room_user ADD COLUMN joined_at DATETIME(6) NULL;

-- 2. 확인
SHOW COLUMNS FROM chat_room_user LIKE 'joined_at';
