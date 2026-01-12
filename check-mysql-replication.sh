#!/bin/bash
# ================================================================
# MySQL Master-Slave Replication 상태 확인 스크립트
# ================================================================

set -e

echo "========================================"
echo "🔍 MySQL Replication 상태 확인"
echo "========================================"
echo ""

# 색상 정의
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# MySQL 비밀번호 (환경 변수 또는 기본값)
MYSQL_PASSWORD=${MYSQL_ROOT_PASSWORD:-Chat@2024!Secure}

# ----------------------------------------------------------------
# 1️⃣ 컨테이너 상태 확인
# ----------------------------------------------------------------
echo "1️⃣ MySQL 컨테이너 상태 확인:"
echo ""

for container in chat-mysql-master chat-mysql-slave-1 chat-mysql-slave-2; do
    if docker ps | grep -q $container; then
        echo -e "${GREEN}✅ $container 실행 중${NC}"
    else
        echo -e "${RED}❌ $container 실행 안 됨!${NC}"
        echo "   컨테이너를 먼저 시작하세요: docker-compose up -d"
        exit 1
    fi
done

echo ""

# ----------------------------------------------------------------
# 2️⃣ Master 상태 확인
# ----------------------------------------------------------------
echo "2️⃣ Master 상태 확인:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

MASTER_STATUS=$(docker exec chat-mysql-master mysql -uroot -p"$MYSQL_PASSWORD" -e "SHOW MASTER STATUS\G" 2>/dev/null)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Master 정상 작동${NC}"
    echo ""
    echo "$MASTER_STATUS"
    
    # Binary Log 정보 추출
    LOG_FILE=$(echo "$MASTER_STATUS" | grep "File:" | awk '{print $2}')
    LOG_POS=$(echo "$MASTER_STATUS" | grep "Position:" | awk '{print $2}')
    
    echo ""
    echo -e "${BLUE}📊 Master 정보:${NC}"
    echo "  - Binary Log File: $LOG_FILE"
    echo "  - Binary Log Position: $LOG_POS"
else
    echo -e "${RED}❌ Master 상태 확인 실패!${NC}"
    exit 1
fi

echo ""

# ----------------------------------------------------------------
# 3️⃣ Slave 1 상태 확인
# ----------------------------------------------------------------
echo "3️⃣ Slave 1 상태 확인:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SLAVE1_STATUS=$(docker exec chat-mysql-slave-1 mysql -uroot -p"$MYSQL_PASSWORD" -e "SHOW SLAVE STATUS\G" 2>/dev/null)

if [ $? -eq 0 ]; then
    # Slave IO Running 확인
    SLAVE1_IO=$(echo "$SLAVE1_STATUS" | grep "Slave_IO_Running:" | awk '{print $2}')
    SLAVE1_SQL=$(echo "$SLAVE1_STATUS" | grep "Slave_SQL_Running:" | awk '{print $2}')
    SLAVE1_LAG=$(echo "$SLAVE1_STATUS" | grep "Seconds_Behind_Master:" | awk '{print $2}')
    
    echo -e "${BLUE}📊 Slave 1 상태:${NC}"
    
    # IO Thread 상태
    if [ "$SLAVE1_IO" = "Yes" ]; then
        echo -e "  - Slave_IO_Running: ${GREEN}✅ Yes${NC}"
    else
        echo -e "  - Slave_IO_Running: ${RED}❌ $SLAVE1_IO${NC}"
    fi
    
    # SQL Thread 상태
    if [ "$SLAVE1_SQL" = "Yes" ]; then
        echo -e "  - Slave_SQL_Running: ${GREEN}✅ Yes${NC}"
    else
        echo -e "  - Slave_SQL_Running: ${RED}❌ $SLAVE1_SQL${NC}"
    fi
    
    # Replication Lag
    if [ "$SLAVE1_LAG" = "0" ] || [ "$SLAVE1_LAG" = "NULL" ]; then
        echo -e "  - Seconds_Behind_Master: ${GREEN}✅ $SLAVE1_LAG (지연 없음)${NC}"
    else
        echo -e "  - Seconds_Behind_Master: ${YELLOW}⚠️  $SLAVE1_LAG 초 지연${NC}"
    fi
    
    # 전체 상태
    if [ "$SLAVE1_IO" = "Yes" ] && [ "$SLAVE1_SQL" = "Yes" ]; then
        echo -e "\n${GREEN}✅ Slave 1 Replication 정상!${NC}"
    else
        echo -e "\n${RED}❌ Slave 1 Replication 문제 발생!${NC}"
        echo "상세 정보:"
        echo "$SLAVE1_STATUS" | grep -E "Last_IO_Error|Last_SQL_Error"
    fi
else
    echo -e "${RED}❌ Slave 1 상태 확인 실패!${NC}"
fi

echo ""

# ----------------------------------------------------------------
# 4️⃣ Slave 2 상태 확인
# ----------------------------------------------------------------
echo "4️⃣ Slave 2 상태 확인:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SLAVE2_STATUS=$(docker exec chat-mysql-slave-2 mysql -uroot -p"$MYSQL_PASSWORD" -e "SHOW SLAVE STATUS\G" 2>/dev/null)

if [ $? -eq 0 ]; then
    # Slave IO Running 확인
    SLAVE2_IO=$(echo "$SLAVE2_STATUS" | grep "Slave_IO_Running:" | awk '{print $2}')
    SLAVE2_SQL=$(echo "$SLAVE2_STATUS" | grep "Slave_SQL_Running:" | awk '{print $2}')
    SLAVE2_LAG=$(echo "$SLAVE2_STATUS" | grep "Seconds_Behind_Master:" | awk '{print $2}')
    
    echo -e "${BLUE}📊 Slave 2 상태:${NC}"
    
    # IO Thread 상태
    if [ "$SLAVE2_IO" = "Yes" ]; then
        echo -e "  - Slave_IO_Running: ${GREEN}✅ Yes${NC}"
    else
        echo -e "  - Slave_IO_Running: ${RED}❌ $SLAVE2_IO${NC}"
    fi
    
    # SQL Thread 상태
    if [ "$SLAVE2_SQL" = "Yes" ]; then
        echo -e "  - Slave_SQL_Running: ${GREEN}✅ Yes${NC}"
    else
        echo -e "  - Slave_SQL_Running: ${RED}❌ $SLAVE2_SQL${NC}"
    fi
    
    # Replication Lag
    if [ "$SLAVE2_LAG" = "0" ] || [ "$SLAVE2_LAG" = "NULL" ]; then
        echo -e "  - Seconds_Behind_Master: ${GREEN}✅ $SLAVE2_LAG (지연 없음)${NC}"
    else
        echo -e "  - Seconds_Behind_Master: ${YELLOW}⚠️  $SLAVE2_LAG 초 지연${NC}"
    fi
    
    # 전체 상태
    if [ "$SLAVE2_IO" = "Yes" ] && [ "$SLAVE2_SQL" = "Yes" ]; then
        echo -e "\n${GREEN}✅ Slave 2 Replication 정상!${NC}"
    else
        echo -e "\n${RED}❌ Slave 2 Replication 문제 발생!${NC}"
        echo "상세 정보:"
        echo "$SLAVE2_STATUS" | grep -E "Last_IO_Error|Last_SQL_Error"
    fi
else
    echo -e "${RED}❌ Slave 2 상태 확인 실패!${NC}"
fi

echo ""

# ----------------------------------------------------------------
# 5️⃣ Replication 테스트
# ----------------------------------------------------------------
echo "5️⃣ Replication 테스트 (Master에 데이터 INSERT → Slave 확인):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 테스트 데이터베이스 및 테이블 생성
TEST_DB="replication_test_db"
TEST_TABLE="replication_test_table"
TEST_VALUE="test_$(date +%s)"

echo "테스트 시작..."

# Master에 테스트 데이터 INSERT
docker exec chat-mysql-master mysql -uroot -p"$MYSQL_PASSWORD" << EOF 2>/dev/null
CREATE DATABASE IF NOT EXISTS $TEST_DB;
USE $TEST_DB;
CREATE TABLE IF NOT EXISTS $TEST_TABLE (
    id INT AUTO_INCREMENT PRIMARY KEY,
    value VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO $TEST_TABLE (value) VALUES ('$TEST_VALUE');
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Master에 테스트 데이터 INSERT 성공${NC}"
    echo "   값: $TEST_VALUE"
else
    echo -e "${RED}❌ Master INSERT 실패!${NC}"
fi

# 잠시 대기 (Replication 전파 시간)
echo "Replication 전파 대기 중... (2초)"
sleep 2

# Slave 1에서 확인
SLAVE1_VALUE=$(docker exec chat-mysql-slave-1 mysql -uroot -p"$MYSQL_PASSWORD" -D $TEST_DB -N -e "SELECT value FROM $TEST_TABLE WHERE value='$TEST_VALUE' LIMIT 1;" 2>/dev/null)

if [ "$SLAVE1_VALUE" = "$TEST_VALUE" ]; then
    echo -e "${GREEN}✅ Slave 1에서 데이터 확인됨!${NC}"
    echo "   값: $SLAVE1_VALUE"
else
    echo -e "${RED}❌ Slave 1에서 데이터 미확인!${NC}"
fi

# Slave 2에서 확인
SLAVE2_VALUE=$(docker exec chat-mysql-slave-2 mysql -uroot -p"$MYSQL_PASSWORD" -D $TEST_DB -N -e "SELECT value FROM $TEST_TABLE WHERE value='$TEST_VALUE' LIMIT 1;" 2>/dev/null)

if [ "$SLAVE2_VALUE" = "$TEST_VALUE" ]; then
    echo -e "${GREEN}✅ Slave 2에서 데이터 확인됨!${NC}"
    echo "   값: $SLAVE2_VALUE"
else
    echo -e "${RED}❌ Slave 2에서 데이터 미확인!${NC}"
fi

# 테스트 데이터 정리
docker exec chat-mysql-master mysql -uroot -p"$MYSQL_PASSWORD" -e "DROP DATABASE IF EXISTS $TEST_DB;" 2>/dev/null

echo ""

# ----------------------------------------------------------------
# 6️⃣ 결과 요약
# ----------------------------------------------------------------
echo "========================================"
echo "📊 Replication 상태 요약"
echo "========================================"
echo ""

# Master 상태
echo -e "🗄️  ${BLUE}Master (포트 3306):${NC}"
echo "   - Binary Log: $LOG_FILE"
echo "   - Position: $LOG_POS"
echo -e "   - 상태: ${GREEN}✅ 정상${NC}"

echo ""

# Slave 1 상태
echo -e "🗄️  ${BLUE}Slave 1 (포트 3307):${NC}"
if [ "$SLAVE1_IO" = "Yes" ] && [ "$SLAVE1_SQL" = "Yes" ]; then
    echo -e "   - 상태: ${GREEN}✅ Replication 정상${NC}"
    echo "   - Lag: $SLAVE1_LAG"
else
    echo -e "   - 상태: ${RED}❌ Replication 문제${NC}"
fi

echo ""

# Slave 2 상태
echo -e "🗄️  ${BLUE}Slave 2 (포트 3308):${NC}"
if [ "$SLAVE2_IO" = "Yes" ] && [ "$SLAVE2_SQL" = "Yes" ]; then
    echo -e "   - 상태: ${GREEN}✅ Replication 정상${NC}"
    echo "   - Lag: $SLAVE2_LAG"
else
    echo -e "   - 상태: ${RED}❌ Replication 문제${NC}"
fi

echo ""

# 전체 결론
if [ "$SLAVE1_IO" = "Yes" ] && [ "$SLAVE1_SQL" = "Yes" ] && [ "$SLAVE2_IO" = "Yes" ] && [ "$SLAVE2_SQL" = "Yes" ]; then
    echo -e "${GREEN}🎉 MySQL Master-Slave Replication이 정상적으로 작동 중입니다!${NC}"
    echo ""
    echo "💡 사용 방법:"
    echo "   - Write (INSERT/UPDATE/DELETE): Master (localhost:3306)"
    echo "   - Read (SELECT): Slave 1 (localhost:3307) 또는 Slave 2 (localhost:3308)"
else
    echo -e "${RED}⚠️  Replication에 문제가 있습니다!${NC}"
    echo ""
    echo "🔧 문제 해결:"
    echo "   1. 로그 확인: docker-compose logs mysql-master mysql-slave-1 mysql-slave-2"
    echo "   2. Replication 재설정: ./start-cluster.sh (자동 설정)"
    echo "   3. 수동 설정: 가이드 문서 참고"
fi

echo ""
echo "========================================"



