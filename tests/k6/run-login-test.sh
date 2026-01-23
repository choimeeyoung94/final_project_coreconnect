#!/bin/bash

# ============================================
# k6 로그인 부하 테스트 실행 스크립트
# InfluxDB 출력 및 Grafana 연동 포함
# ============================================

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 설정
BASE_URL="${BASE_URL:-http://3.38.28.172:8080}"
GRAFANA_URL="${GRAFANA_URL:-http://3.38.28.172:3000}"
INFLUXDB_URL="${INFLUXDB_URL:-http://localhost:8086}"
INFLUXDB_DB="${INFLUXDB_DB:-k6}"
TEST_FILE="${TEST_FILE:-simple-login-test-with-grafana.js}"
VUS="${VUS:-100}"
DURATION="${DURATION:-2m}"

# 배너 출력
echo -e "${BLUE}"
echo "════════════════════════════════════════════════════════════════════════════════"
echo "                     🚀 k6 부하 테스트 실행 스크립트"
echo "════════════════════════════════════════════════════════════════════════════════"
echo -e "${NC}"

# 설정 출력
echo -e "${YELLOW}📋 테스트 설정:${NC}"
echo "  • API 서버: ${BASE_URL}"
echo "  • InfluxDB: ${INFLUXDB_URL}/${INFLUXDB_DB}"
echo "  • Grafana: ${GRAFANA_URL}"
echo "  • 가상 사용자: ${VUS}"
echo "  • 테스트 기간: ${DURATION}"
echo "  • 테스트 파일: ${TEST_FILE}"
echo ""

# InfluxDB 연결 확인
echo -e "${YELLOW}🔍 InfluxDB 연결 확인...${NC}"
if curl -s "${INFLUXDB_URL}/ping" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ InfluxDB 연결 성공${NC}"
else
    echo -e "${RED}❌ InfluxDB 연결 실패!${NC}"
    echo "   InfluxDB가 실행 중인지 확인하세요: sudo systemctl status influxdb"
    exit 1
fi

# k6 데이터베이스 존재 확인
echo -e "${YELLOW}🔍 k6 데이터베이스 확인...${NC}"
if influx -execute "SHOW DATABASES" 2>/dev/null | grep -q "^${INFLUXDB_DB}$"; then
    echo -e "${GREEN}✅ k6 데이터베이스 존재${NC}"
else
    echo -e "${YELLOW}⚠️  k6 데이터베이스 없음. 생성 중...${NC}"
    influx -execute "CREATE DATABASE ${INFLUXDB_DB}"
    echo -e "${GREEN}✅ k6 데이터베이스 생성 완료${NC}"
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🚀 k6 테스트 시작...${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Grafana 대시보드 링크 출력
echo -e "${YELLOW}📊 실시간 모니터링:${NC}"
echo "   ${GRAFANA_URL}/dashboards"
echo ""

# k6 테스트 실행
BASE_URL="${BASE_URL}" \
GRAFANA_URL="${GRAFANA_URL}" \
k6 run \
  --out "influxdb=${INFLUXDB_URL}/${INFLUXDB_DB}" \
  --vus "${VUS}" \
  --duration "${DURATION}" \
  "${TEST_FILE}"

# 종료 코드 확인
EXIT_CODE=$?

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"

if [ ${EXIT_CODE} -eq 0 ]; then
    echo -e "${GREEN}✅ 테스트 완료!${NC}"
    echo ""
    echo -e "${YELLOW}📊 결과 확인:${NC}"
    echo "   Grafana 대시보드: ${GRAFANA_URL}/dashboards"
    echo "   (대시보드에서 시간 범위를 'Last 15 minutes'로 설정하세요)"
else
    echo -e "${RED}❌ 테스트 실패 (Exit Code: ${EXIT_CODE})${NC}"
fi

echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"
echo ""

exit ${EXIT_CODE}
