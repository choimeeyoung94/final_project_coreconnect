#!/bin/bash
# ================================================================
# 10만명 동시접속 채팅방 - 헬스체크 스크립트
# ================================================================

echo "========================================"
echo "🔍 클러스터 헬스체크 시작"
echo "========================================"
echo ""

# 색상 정의
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 통계
TOTAL=0
SUCCESS=0
FAILED=0

# ----------------------------------------------------------------
# 헬스체크 함수
# ----------------------------------------------------------------
check_service() {
    local name=$1
    local command=$2
    
    TOTAL=$((TOTAL + 1))
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✅${NC} $name 정상"
        SUCCESS=$((SUCCESS + 1))
        return 0
    else
        echo -e "  ${RED}❌${NC} $name 비정상"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# ----------------------------------------------------------------
# 1️⃣ Nginx (Load Balancer)
# ----------------------------------------------------------------
echo "1️⃣ Nginx (Load Balancer):"
check_service "Nginx 헬스체크" "curl -sf http://localhost:80/health"
check_service "Nginx 컨테이너" "docker ps | grep chat-nginx"

# ----------------------------------------------------------------
# 2️⃣ Spring Boot Servers (10대)
# ----------------------------------------------------------------
echo ""
echo "2️⃣ Spring Boot Servers (10대):"
for i in {1..10}; do
    port=$((8080 + i))
    check_service "chat-app-$i (포트 $port)" "curl -sf http://localhost:$port/actuator/health | grep -q UP"
done

# ----------------------------------------------------------------
# 3️⃣ Redis
# ----------------------------------------------------------------
echo ""
echo "3️⃣ Redis:"
check_service "Redis Pub/Sub (포트 6379)" "docker exec chat-redis-pubsub redis-cli ping | grep -q PONG"
check_service "Redis Session (포트 6380)" "docker exec chat-redis-session redis-cli -p 6380 ping | grep -q PONG"

# Redis 메모리 사용량 확인
REDIS_PUBSUB_MEMORY=$(docker exec chat-redis-pubsub redis-cli INFO memory | grep used_memory_human | cut -d: -f2 | tr -d '\r')
REDIS_SESSION_MEMORY=$(docker exec chat-redis-session redis-cli -p 6380 INFO memory | grep used_memory_human | cut -d: -f2 | tr -d '\r')
echo "  📊 Redis Pub/Sub 메모리: $REDIS_PUBSUB_MEMORY"
echo "  📊 Redis Session 메모리: $REDIS_SESSION_MEMORY"

# ----------------------------------------------------------------
# 4️⃣ MySQL
# ----------------------------------------------------------------
echo ""
echo "4️⃣ MySQL:"
check_service "MySQL Master (포트 3306)" "docker exec chat-mysql-master mysqladmin ping -h localhost -u root -pChat@2024!Secure --silent"
check_service "MySQL Slave 1 (포트 3307)" "docker exec chat-mysql-slave-1 mysqladmin ping -h localhost -u root -pChat@2024!Secure --silent"
check_service "MySQL Slave 2 (포트 3308)" "docker exec chat-mysql-slave-2 mysqladmin ping -h localhost -u root -pChat@2024!Secure --silent"

# MySQL Replication 상태 확인
echo "  📊 Replication 상태:"
SLAVE1_STATUS=$(docker exec chat-mysql-slave-1 mysql -uroot -pChat@2024!Secure -e "SHOW SLAVE STATUS\G" 2>/dev/null | grep "Slave_IO_Running" | awk '{print $2}')
SLAVE2_STATUS=$(docker exec chat-mysql-slave-2 mysql -uroot -pChat@2024!Secure -e "SHOW SLAVE STATUS\G" 2>/dev/null | grep "Slave_IO_Running" | awk '{print $2}')

if [ "$SLAVE1_STATUS" == "Yes" ]; then
    echo -e "    ${GREEN}✅${NC} Slave 1: Replication 정상"
else
    echo -e "    ${RED}❌${NC} Slave 1: Replication 비정상"
fi

if [ "$SLAVE2_STATUS" == "Yes" ]; then
    echo -e "    ${GREEN}✅${NC} Slave 2: Replication 정상"
else
    echo -e "    ${RED}❌${NC} Slave 2: Replication 비정상"
fi

# ----------------------------------------------------------------
# 5️⃣ Prometheus
# ----------------------------------------------------------------
echo ""
echo "5️⃣ Prometheus (메트릭 수집):"
check_service "Prometheus (포트 9090)" "curl -sf http://localhost:9090/-/healthy"

# Prometheus 타겟 상태
TARGETS_UP=$(curl -s http://localhost:9090/api/v1/targets 2>/dev/null | grep -o '"health":"up"' | wc -l)
TARGETS_DOWN=$(curl -s http://localhost:9090/api/v1/targets 2>/dev/null | grep -o '"health":"down"' | wc -l)
echo "  📊 타겟 상태: UP=$TARGETS_UP, DOWN=$TARGETS_DOWN"

# ----------------------------------------------------------------
# 6️⃣ Grafana
# ----------------------------------------------------------------
echo ""
echo "6️⃣ Grafana (모니터링 대시보드):"
check_service "Grafana (포트 3000)" "curl -sf http://localhost:3000/api/health | grep -q ok"

# ----------------------------------------------------------------
# 7️⃣ Redis Commander (선택 사항)
# ----------------------------------------------------------------
echo ""
echo "7️⃣ Redis Commander (Redis GUI):"
check_service "Redis Commander (포트 8081)" "curl -sf http://localhost:8081"

# ----------------------------------------------------------------
# 8️⃣ 컨테이너 상태
# ----------------------------------------------------------------
echo ""
echo "8️⃣ 컨테이너 상태:"
RUNNING=$(docker-compose ps | grep "Up" | wc -l)
STOPPED=$(docker-compose ps | grep "Exit" | wc -l)
echo "  📊 실행 중: $RUNNING개"
echo "  📊 중지됨: $STOPPED개"

# ----------------------------------------------------------------
# 9️⃣ 리소스 사용량
# ----------------------------------------------------------------
echo ""
echo "9️⃣ 리소스 사용량:"

# CPU 사용량 (상위 5개)
echo "  📊 CPU 사용률 (Top 5):"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}" | grep chat- | sort -k2 -rh | head -5 | awk '{printf "    %s: %s\n", $1, $2}'

# 메모리 사용량 (상위 5개)
echo "  📊 메모리 사용량 (Top 5):"
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}" | grep chat- | sort -k2 -rh | head -5 | awk '{printf "    %s: %s\n", $1, $2}'

# ----------------------------------------------------------------
# 🔟 네트워크 연결
# ----------------------------------------------------------------
echo ""
echo "🔟 네트워크 연결:"

# 각 Spring Boot 서버의 연결 수 확인 (샘플)
echo "  📊 서버별 활성 연결 (샘플):"
for i in 1 2 3; do
    CONNECTIONS=$(docker exec chat-app-$i sh -c "netstat -an 2>/dev/null | grep ESTABLISHED | wc -l" 2>/dev/null || echo "N/A")
    echo "    chat-app-$i: $CONNECTIONS개"
done

# ----------------------------------------------------------------
# 결과 요약
# ----------------------------------------------------------------
echo ""
echo "========================================"
echo "📊 헬스체크 결과 요약"
echo "========================================"
echo ""
echo "  총 체크: $TOTAL개"
echo -e "  성공: ${GREEN}$SUCCESS개${NC}"
echo -e "  실패: ${RED}$FAILED개${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ 모든 서비스가 정상입니다!${NC}"
    SUCCESS_RATE=100
else
    SUCCESS_RATE=$((SUCCESS * 100 / TOTAL))
    echo -e "${YELLOW}⚠️  일부 서비스에 문제가 있습니다.${NC}"
    echo "  성공률: ${SUCCESS_RATE}%"
fi

echo ""
echo "========================================"
echo ""

# 로그 확인 안내
if [ $FAILED -gt 0 ]; then
    echo "📝 문제 해결을 위한 로그 확인:"
    echo "  docker-compose logs -f [service-name]"
    echo ""
    echo "예시:"
    echo "  docker-compose logs -f chat-app-1"
    echo "  docker-compose logs -f mysql-master"
    echo ""
fi

# 모니터링 대시보드 안내
echo "📊 실시간 모니터링:"
echo "  Grafana: http://localhost:3000 (admin/admin123)"
echo "  Prometheus: http://localhost:9090"
echo ""

# 종료 코드
if [ $FAILED -eq 0 ]; then
    exit 0
else
    exit 1
fi



