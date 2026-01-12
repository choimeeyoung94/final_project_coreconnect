#!/bin/bash
# ================================================================
# MySQL Master-Slave Replication 자동 설정 스크립트
# ================================================================
# 용도: Slave 서버에서 Master와의 복제 연결 자동 설정
# 실행: docker exec -it <slave-container> bash /scripts/setup-replication.sh
# ================================================================

set -e

echo "🔄 MySQL Replication 설정 시작..."

# ================================================================
# 환경변수 설정
# ================================================================
MASTER_HOST=${MYSQL_MASTER_HOST:-"mysql-master"}
MASTER_PORT=${MYSQL_MASTER_PORT:-"3306"}
MASTER_USER="repl_user"
MASTER_PASSWORD=${MYSQL_REPLICATION_PASSWORD:-"Repl@2024!Pass"}
ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD:-"Chat@2024!Secure"}

echo "📡 Master 서버: $MASTER_HOST:$MASTER_PORT"

# ================================================================
# 1. Master 서버 연결 대기
# ================================================================
echo "⏳ Master 서버 대기 중..."
until mysql -h "$MASTER_HOST" -P "$MASTER_PORT" -u root -p"$ROOT_PASSWORD" -e "SELECT 1" &>/dev/null; do
    echo "   Master 서버가 아직 준비되지 않았습니다. 5초 후 재시도..."
    sleep 5
done
echo "✅ Master 서버 연결 성공!"

# ================================================================
# 2. Master 상태 조회 (Binary Log 위치)
# ================================================================
echo "📊 Master 상태 조회 중..."

MASTER_STATUS=$(mysql -h "$MASTER_HOST" -P "$MASTER_PORT" -u root -p"$ROOT_PASSWORD" -e "SHOW MASTER STATUS\G")

MASTER_LOG_FILE=$(echo "$MASTER_STATUS" | grep "File:" | awk '{print $2}')
MASTER_LOG_POS=$(echo "$MASTER_STATUS" | grep "Position:" | awk '{print $2}')

if [ -z "$MASTER_LOG_FILE" ] || [ -z "$MASTER_LOG_POS" ]; then
    echo "❌ Master 상태를 가져올 수 없습니다!"
    echo "$MASTER_STATUS"
    exit 1
fi

echo "📁 Master Log File: $MASTER_LOG_FILE"
echo "📍 Master Log Position: $MASTER_LOG_POS"

# ================================================================
# 3. Slave 복제 설정
# ================================================================
echo "🔧 Slave 복제 설정 중..."

mysql -u root -p"$ROOT_PASSWORD" <<EOF
-- 기존 복제 중지 (에러 무시)
STOP SLAVE;

-- 복제 설정 초기화
RESET SLAVE ALL;

-- Master 연결 정보 설정
CHANGE MASTER TO
    MASTER_HOST='$MASTER_HOST',
    MASTER_PORT=$MASTER_PORT,
    MASTER_USER='$MASTER_USER',
    MASTER_PASSWORD='$MASTER_PASSWORD',
    MASTER_LOG_FILE='$MASTER_LOG_FILE',
    MASTER_LOG_POS=$MASTER_LOG_POS,
    GET_MASTER_PUBLIC_KEY=1;

-- 복제 시작
START SLAVE;

-- 복제 상태 확인
SHOW SLAVE STATUS\G
EOF

# ================================================================
# 4. 복제 상태 검증
# ================================================================
echo "✅ 복제 상태 검증 중..."

SLAVE_STATUS=$(mysql -u root -p"$ROOT_PASSWORD" -e "SHOW SLAVE STATUS\G")

SLAVE_IO_RUNNING=$(echo "$SLAVE_STATUS" | grep "Slave_IO_Running:" | awk '{print $2}')
SLAVE_SQL_RUNNING=$(echo "$SLAVE_STATUS" | grep "Slave_SQL_Running:" | awk '{print $2}')

echo "   - Slave_IO_Running: $SLAVE_IO_RUNNING"
echo "   - Slave_SQL_Running: $SLAVE_SQL_RUNNING"

if [ "$SLAVE_IO_RUNNING" == "Yes" ] && [ "$SLAVE_SQL_RUNNING" == "Yes" ]; then
    echo "🎉 MySQL Replication 설정 완료!"
    echo "✅ 복제가 정상적으로 작동 중입니다."
else
    echo "⚠️  복제가 정상적으로 시작되지 않았습니다."
    echo "상세 정보:"
    echo "$SLAVE_STATUS" | grep -E "(Slave_IO_Running|Slave_SQL_Running|Last_Error)"
    exit 1
fi

echo ""
echo "================================================================"
echo "🎯 복제 설정 요약"
echo "================================================================"
echo "Master: $MASTER_HOST:$MASTER_PORT"
echo "Log File: $MASTER_LOG_FILE"
echo "Log Position: $MASTER_LOG_POS"
echo "IO Thread: $SLAVE_IO_RUNNING"
echo "SQL Thread: $SLAVE_SQL_RUNNING"
echo "================================================================"




