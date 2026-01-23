#!/bin/bash

# ============================================
# k6 완전 자동화 실행 스크립트
# InfluxDB 자동 설정 및 Grafana 연동
# ============================================

set -e  # 에러 발생 시 중단

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "════════════════════════════════════════════════════════════════════════════════"
echo "              🚀 k6 부하 테스트 - 완전 자동화 실행 스크립트"
echo "════════════════════════════════════════════════════════════════════════════════"
echo -e "${NC}"

# 설정
BASE_URL="${BASE_URL:-http://3.38.28.172:8080}"
GRAFANA_URL="${GRAFANA_URL:-http://3.38.28.172:3000}"
INFLUXDB_URL="${INFLUXDB_URL:-http://localhost:8086}"
INFLUXDB_DB="${INFLUXDB_DB:-k6}"
TEST_FILE="${1:-simple-login-test-with-grafana.js}"
VUS="${VUS:-100}"
DURATION="${DURATION:-2m}"

echo -e "${YELLOW}📋 테스트 설정:${NC}"
echo "  • API 서버: ${BASE_URL}"
echo "  • InfluxDB: ${INFLUXDB_URL}/${INFLUXDB_DB}"
echo "  • Grafana: ${GRAFANA_URL}"
echo "  • 가상 사용자: ${VUS}"
echo "  • 테스트 기간: ${DURATION}"
echo "  • 테스트 파일: ${TEST_FILE}"
echo ""

# ============================================
# Step 1: InfluxDB 상태 확인 및 시작
# ============================================
echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🔍 [1/6] InfluxDB 상태 확인...${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"

if systemctl is-active --quiet influxdb; then
    echo -e "${GREEN}✅ InfluxDB가 실행 중입니다${NC}"
else
    echo -e "${YELLOW}⚠️  InfluxDB가 중지되어 있습니다. 시작 중...${NC}"
    sudo systemctl start influxdb
    sleep 3
    if systemctl is-active --quiet influxdb; then
        echo -e "${GREEN}✅ InfluxDB 시작 완료${NC}"
    else
        echo -e "${RED}❌ InfluxDB 시작 실패!${NC}"
        exit 1
    fi
fi

# InfluxDB 연결 대기
echo -e "${YELLOW}⏳ InfluxDB 연결 대기 중...${NC}"
for i in {1..10}; do
    if curl -s "${INFLUXDB_URL}/ping" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ InfluxDB 연결 성공${NC}"
        break
    fi
    if [ $i -eq 10 ]; then
        echo -e "${RED}❌ InfluxDB 연결 시간 초과!${NC}"
        exit 1
    fi
    sleep 1
done

# ============================================
# Step 2: k6 데이터베이스 확인 및 생성
# ============================================
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🔍 [2/6] k6 데이터베이스 확인...${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"

if influx -execute "SHOW DATABASES" 2>/dev/null | grep -q "^${INFLUXDB_DB}$"; then
    echo -e "${GREEN}✅ k6 데이터베이스 존재${NC}"
else
    echo -e "${YELLOW}⚠️  k6 데이터베이스 없음. 생성 중...${NC}"
    influx -execute "CREATE DATABASE ${INFLUXDB_DB}"
    echo -e "${GREEN}✅ k6 데이터베이스 생성 완료${NC}"
fi

# 기존 데이터 확인
EXISTING_DATA=$(influx -execute "SELECT COUNT(*) FROM http_req_duration" -database="${INFLUXDB_DB}" 2>/dev/null | tail -1 | awk '{print $2}')
if [ ! -z "$EXISTING_DATA" ] && [ "$EXISTING_DATA" -gt 0 ]; then
    echo -e "${YELLOW}📊 기존 데이터: ${EXISTING_DATA}개 레코드${NC}"
else
    echo -e "${YELLOW}📊 기존 데이터 없음 (새로운 테스트)${NC}"
fi

# ============================================
# Step 3: 이전 데이터 정리 (선택사항)
# ============================================
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🔍 [3/6] 데이터 정리 확인...${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"

if [ "$CLEAN_DATA" = "true" ]; then
    echo -e "${YELLOW}🗑️  이전 데이터 정리 중...${NC}"
    influx -execute "DROP DATABASE ${INFLUXDB_DB}"
    influx -execute "CREATE DATABASE ${INFLUXDB_DB}"
    echo -e "${GREEN}✅ 데이터 정리 완료${NC}"
else
    echo -e "${YELLOW}ℹ️  이전 데이터 유지 (정리하려면 CLEAN_DATA=true 설정)${NC}"
fi

# ============================================
# Step 4: 테스트 파일 존재 확인
# ============================================
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🔍 [4/6] 테스트 파일 확인...${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"

if [ ! -f "$TEST_FILE" ]; then
    echo -e "${RED}❌ 테스트 파일을 찾을 수 없습니다: ${TEST_FILE}${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 테스트 파일 존재: ${TEST_FILE}${NC}"

if [ ! -d "common" ]; then
    echo -e "${RED}❌ common 폴더를 찾을 수 없습니다${NC}"
    exit 1
fi
echo -e "${GREEN}✅ common 폴더 존재${NC}"

# ============================================
# Step 5: k6 테스트 실행
# ============================================
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🚀 [5/6] k6 테스트 시작...${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📊 실시간 모니터링:${NC}"
echo "   ${GRAFANA_URL}/d/k6-load-test"
echo ""
echo -e "${YELLOW}💡 팁: 테스트 시작 후 5초 뒤에 Grafana에서 데이터 확인 가능${NC}"
echo ""

# 테스트 시작 시간 기록
TEST_START_TIME=$(date +%s)

# k6 실행
BASE_URL="${BASE_URL}" \
GRAFANA_URL="${GRAFANA_URL}" \
k6 run \
  --out "influxdb=${INFLUXDB_URL}/${INFLUXDB_DB}" \
  --vus "${VUS}" \
  --duration "${DURATION}" \
  "${TEST_FILE}"

# 종료 코드 저장
EXIT_CODE=$?

# 테스트 종료 시간 기록
TEST_END_TIME=$(date +%s)
TEST_DURATION=$((TEST_END_TIME - TEST_START_TIME))

# ============================================
# Step 6: 데이터 검증
# ============================================
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🔍 [6/6] 데이터 검증 중...${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"

sleep 2  # InfluxDB에 데이터가 완전히 쓰일 때까지 대기

# 데이터 개수 확인
echo -e "${YELLOW}📊 InfluxDB 데이터 확인:${NC}"
influx -execute "SHOW MEASUREMENTS" -database="${INFLUXDB_DB}" | head -10
echo ""

DATA_COUNT=$(influx -execute "SELECT COUNT(*) FROM http_req_duration" -database="${INFLUXDB_DB}" 2>/dev/null | tail -1 | awk '{print $2}')
if [ ! -z "$DATA_COUNT" ] && [ "$DATA_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ InfluxDB에 ${DATA_COUNT}개의 http_req_duration 레코드 저장됨${NC}"
else
    echo -e "${RED}❌ InfluxDB에 데이터가 없습니다!${NC}"
    echo -e "${YELLOW}디버깅 정보:${NC}"
    influx -execute "SHOW DATABASES"
fi

# ============================================
# 최종 결과 출력
# ============================================
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"

if [ ${EXIT_CODE} -eq 0 ]; then
    echo -e "${GREEN}✅ 테스트 완료! (실행 시간: ${TEST_DURATION}초)${NC}"
    echo ""
    echo -e "${YELLOW}📊 결과 확인:${NC}"
    
    # Grafana 링크 (시간 범위 자동 계산)
    TIME_RANGE_MINUTES=$((TEST_DURATION / 60 + 5))  # 테스트 시간 + 5분 여유
    echo "   🎯 Grafana 대시보드:"
    echo "      ${GRAFANA_URL}/d/k6-load-test?from=now-${TIME_RANGE_MINUTES}m&to=now"
    echo ""
    echo "   📈 Grafana Explore:"
    echo "      ${GRAFANA_URL}/explore"
    echo ""
    echo -e "${GREEN}💡 위 링크를 브라우저에 붙여넣으세요!${NC}"
    echo -e "${GREEN}💡 Grafana에서 시간 범위를 'Last ${TIME_RANGE_MINUTES} minutes'로 설정하세요!${NC}"
else
    echo -e "${RED}❌ 테스트 실패 (Exit Code: ${EXIT_CODE})${NC}"
fi

echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"
echo ""

exit ${EXIT_CODE}
