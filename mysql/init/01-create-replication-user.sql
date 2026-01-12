-- ================================================================
-- MySQL Replication 사용자 생성 스크립트
-- ================================================================
-- Master 서버에서 자동 실행됨 (/docker-entrypoint-initdb.d/)
-- ================================================================

-- Replication 전용 사용자 생성
CREATE USER IF NOT EXISTS 'repl_user'@'%' IDENTIFIED BY 'Repl@2024!Pass';

-- Replication 권한 부여
GRANT REPLICATION SLAVE ON *.* TO 'repl_user'@'%';

-- 데이터베이스 생성
CREATE DATABASE IF NOT EXISTS db_coreconnect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 권한 새로고침
FLUSH PRIVILEGES;

-- Master 상태 확인 (로그 확인용)
SHOW MASTER STATUS;

-- 성공 메시지
SELECT '✅ Replication user created successfully' AS message;




