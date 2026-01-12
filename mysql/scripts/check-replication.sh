#!/bin/bash
# ================================================================
# MySQL Replication 상태 모니터링 스크립트
# ================================================================
# 용도: Master-Slave 복제 상태 실시간 모니터링
# 실행: docker exec -it <slave-container> bash /scripts/check-replication.sh
# ================================================================

set -e

ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD:-"Chat@2024!Secure"}

echo "================================================================"
echo "🔍 MySQL Replication 상태 모니터링"
echo "================================================================"
echo ""

# ================================================================
# Slave 상태 조회
# ================================================================
SLAVE_STATUS=$(mysql -u root -p"$ROOT_PASSWORD" -e "SHOW SLAVE STATUS\G" 2>/dev/null)

if [ -z "$SLAVE_STATUS" ]; then
    echo "❌ 이 서버는 Slave로 구성되지 않았습니다."
    echo ""
    echo "Master 상태 확인:"
    mysql -u root -p"$ROOT_PASSWORD" -e "SHOW MASTER STATUS\G"
    exit 1
fi

# ================================================================
# 주요 상태 정보 파싱
# ================================================================
MASTER_HOST=$(echo "$SLAVE_STATUS" | grep "Master_Host:" | awk '{print $2}')
MASTER_PORT=$(echo "$SLAVE_STATUS" | grep "Master_Port:" | awk '{print $2}')
MASTER_LOG_FILE=$(echo "$SLAVE_STATUS" | grep "Master_Log_File:" | awk '{print $2}')
READ_MASTER_LOG_POS=$(echo "$SLAVE_STATUS" | grep "Read_Master_Log_Pos:" | awk '{print $2}')
RELAY_LOG_FILE=$(echo "$SLAVE_STATUS" | grep "Relay_Log_File:" | awk '{print $2}')
RELAY_LOG_POS=$(echo "$SLAVE_STATUS" | grep "Relay_Log_Pos:" | awk '{print $2}')
SLAVE_IO_RUNNING=$(echo "$SLAVE_STATUS" | grep "Slave_IO_Running:" | awk '{print $2}')
SLAVE_SQL_RUNNING=$(echo "$SLAVE_STATUS" | grep "Slave_SQL_Running:" | awk '{print $2}')
SECONDS_BEHIND_MASTER=$(echo "$SLAVE_STATUS" | grep "Seconds_Behind_Master:" | awk '{print $2}')
LAST_IO_ERROR=$(echo "$SLAVE_STATUS" | grep "Last_IO_Error:" | cut -d':' -f2-)
LAST_SQL_ERROR=$(echo "$SLAVE_STATUS" | grep "Last_SQL_Error:" | cut -d':' -f2-)

# ================================================================
# 상태 출력
# ================================================================
echo "📡 Master 정보"
echo "   Host: $MASTER_HOST:$MASTER_PORT"
echo "   Log File: $MASTER_LOG_FILE"
echo "   Position: $READ_MASTER_LOG_POS"
echo ""

echo "📝 Relay Log 정보"
echo "   File: $RELAY_LOG_FILE"
echo "   Position: $RELAY_LOG_POS"
echo ""

echo "🔄 복제 상태"
if [ "$SLAVE_IO_RUNNING" == "Yes" ]; then
    echo "   ✅ IO Thread: Running"
else
    echo "   ❌ IO Thread: Not Running"
fi

if [ "$SLAVE_SQL_RUNNING" == "Yes" ]; then
    echo "   ✅ SQL Thread: Running"
else
    echo "   ❌ SQL Thread: Not Running"
fi

if [ "$SECONDS_BEHIND_MASTER" == "NULL" ]; then
    echo "   ⚠️  복제 지연: 측정 불가 (복제 중지 또는 오류)"
elif [ "$SECONDS_BEHIND_MASTER" -eq 0 ]; then
    echo "   ✅ 복제 지연: 0초 (실시간 동기화)"
elif [ "$SECONDS_BEHIND_MASTER" -lt 10 ]; then
    echo "   ⚠️  복제 지연: ${SECONDS_BEHIND_MASTER}초 (경고)"
else
    echo "   🔴 복제 지연: ${SECONDS_BEHIND_MASTER}초 (심각)"
fi
echo ""

# ================================================================
# 에러 확인
# ================================================================
if [ -n "$LAST_IO_ERROR" ] && [ "$LAST_IO_ERROR" != " " ]; then
    echo "⚠️  Last IO Error:"
    echo "   $LAST_IO_ERROR"
    echo ""
fi

if [ -n "$LAST_SQL_ERROR" ] && [ "$LAST_SQL_ERROR" != " " ]; then
    echo "⚠️  Last SQL Error:"
    echo "   $LAST_SQL_ERROR"
    echo ""
fi

# ================================================================
# 전체 상태 판정
# ================================================================
if [ "$SLAVE_IO_RUNNING" == "Yes" ] && [ "$SLAVE_SQL_RUNNING" == "Yes" ] && [ "$SECONDS_BEHIND_MASTER" != "NULL" ]; then
    if [ "$SECONDS_BEHIND_MASTER" -lt 10 ]; then
        echo "🎉 복제 상태: 정상"
    else
        echo "⚠️  복제 상태: 경고 (복제 지연 발생)"
    fi
else
    echo "❌ 복제 상태: 오류"
    echo ""
    echo "상세 정보:"
    echo "$SLAVE_STATUS"
fi

echo "================================================================"




