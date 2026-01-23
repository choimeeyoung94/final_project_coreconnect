#!/bin/bash

# ============================================
# Grafana + InfluxDB 자동 수정 스크립트
# ============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🔧 Grafana + InfluxDB 자동 수정 시작${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"

GRAFANA_URL="http://localhost:3000"
GRAFANA_USER="admin"
GRAFANA_PASS="admin"

# ============================================
# Step 1: InfluxDB 데이터 확인
# ============================================
echo -e "\n${YELLOW}[1/6] InfluxDB 데이터 확인...${NC}"

DATA_COUNT=$(influx -execute "SELECT COUNT(*) FROM http_req_duration" -database="k6" 2>/dev/null | tail -1 | awk '{print $2}')

if [ ! -z "$DATA_COUNT" ] && [ "$DATA_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ InfluxDB에 ${DATA_COUNT}개 레코드 존재${NC}"
else
    echo -e "${RED}❌ InfluxDB에 데이터 없음!${NC}"
    exit 1
fi

# ============================================
# Step 2: Grafana 서비스 확인
# ============================================
echo -e "\n${YELLOW}[2/6] Grafana 서비스 확인...${NC}"

if ! systemctl is-active --quiet grafana-server; then
    echo -e "${YELLOW}Grafana 시작 중...${NC}"
    sudo systemctl start grafana-server
    sleep 5
fi

if systemctl is-active --quiet grafana-server; then
    echo -e "${GREEN}✅ Grafana 실행 중${NC}"
else
    echo -e "${RED}❌ Grafana 시작 실패${NC}"
    exit 1
fi

# Grafana 연결 대기
for i in {1..10}; do
    if curl -s "${GRAFANA_URL}/api/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Grafana 연결 성공${NC}"
        break
    fi
    if [ $i -eq 10 ]; then
        echo -e "${RED}❌ Grafana 연결 실패${NC}"
        exit 1
    fi
    sleep 1
done

# ============================================
# Step 3: 기존 InfluxDB 데이터 소스 확인
# ============================================
echo -e "\n${YELLOW}[3/6] 기존 데이터 소스 확인...${NC}"

DATASOURCE_ID=$(curl -s -u "${GRAFANA_USER}:${GRAFANA_PASS}" \
    "${GRAFANA_URL}/api/datasources" | \
    grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')

if [ ! -z "$DATASOURCE_ID" ]; then
    echo -e "${YELLOW}기존 데이터 소스 발견 (ID: ${DATASOURCE_ID}), 삭제 중...${NC}"
    curl -s -X DELETE -u "${GRAFANA_USER}:${GRAFANA_PASS}" \
        "${GRAFANA_URL}/api/datasources/${DATASOURCE_ID}" > /dev/null
    echo -e "${GREEN}✅ 기존 데이터 소스 삭제 완료${NC}"
else
    echo -e "${YELLOW}기존 데이터 소스 없음${NC}"
fi

# ============================================
# Step 4: 새 InfluxDB 데이터 소스 생성
# ============================================
echo -e "\n${YELLOW}[4/6] 새 InfluxDB 데이터 소스 생성...${NC}"

RESPONSE=$(curl -s -X POST -u "${GRAFANA_USER}:${GRAFANA_PASS}" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "InfluxDB",
        "type": "influxdb",
        "access": "proxy",
        "url": "http://localhost:8086",
        "database": "k6",
        "isDefault": true,
        "jsonData": {
            "httpMode": "GET",
            "keepCookies": []
        },
        "secureJsonFields": {}
    }' \
    "${GRAFANA_URL}/api/datasources")

if echo "$RESPONSE" | grep -q '"id"'; then
    echo -e "${GREEN}✅ InfluxDB 데이터 소스 생성 완료${NC}"
    NEW_DATASOURCE_ID=$(echo "$RESPONSE" | grep -o '"id":[0-9]*' | grep -o '[0-9]*')
    echo -e "${GREEN}   새 데이터 소스 ID: ${NEW_DATASOURCE_ID}${NC}"
else
    echo -e "${RED}❌ 데이터 소스 생성 실패${NC}"
    echo "$RESPONSE"
    exit 1
fi

# ============================================
# Step 5: 데이터 소스 테스트
# ============================================
echo -e "\n${YELLOW}[5/6] 데이터 소스 연결 테스트...${NC}"

TEST_RESPONSE=$(curl -s -X POST -u "${GRAFANA_USER}:${GRAFANA_PASS}" \
    -H "Content-Type: application/json" \
    "${GRAFANA_URL}/api/datasources/${NEW_DATASOURCE_ID}/health")

if echo "$TEST_RESPONSE" | grep -q '"status":"OK"'; then
    echo -e "${GREEN}✅ 데이터 소스 연결 테스트 성공${NC}"
else
    echo -e "${YELLOW}⚠️  테스트 응답: ${TEST_RESPONSE}${NC}"
fi

# ============================================
# Step 6: k6 대시보드 import
# ============================================
echo -e "\n${YELLOW}[6/6] k6 대시보드 import...${NC}"

# k6 대시보드 JSON 다운로드
DASHBOARD_JSON=$(curl -s https://grafana.com/api/dashboards/2587/revisions/5/download)

if [ -z "$DASHBOARD_JSON" ]; then
    echo -e "${RED}❌ 대시보드 다운로드 실패${NC}"
    exit 1
fi

# 대시보드 import
IMPORT_RESPONSE=$(curl -s -X POST -u "${GRAFANA_USER}:${GRAFANA_PASS}" \
    -H "Content-Type: application/json" \
    -d "{
        \"dashboard\": ${DASHBOARD_JSON},
        \"overwrite\": true,
        \"inputs\": [{
            \"name\": \"DS_INFLUXDB\",
            \"type\": \"datasource\",
            \"pluginId\": \"influxdb\",
            \"value\": \"${NEW_DATASOURCE_ID}\"
        }],
        \"folderId\": 0
    }" \
    "${GRAFANA_URL}/api/dashboards/import")

if echo "$IMPORT_RESPONSE" | grep -q '"uid"'; then
    DASHBOARD_UID=$(echo "$IMPORT_RESPONSE" | grep -o '"uid":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo -e "${GREEN}✅ k6 대시보드 import 완료${NC}"
    echo -e "${GREEN}   대시보드 UID: ${DASHBOARD_UID}${NC}"
else
    echo -e "${YELLOW}⚠️  대시보드 import 응답:${NC}"
    echo "$IMPORT_RESPONSE" | head -5
fi

# ============================================
# 완료
# ============================================
echo -e "\n${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ 모든 설정 완료!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"

echo -e "\n${YELLOW}📊 Grafana 접속 정보:${NC}"
echo "   URL: http://3.38.28.172:3000"
echo "   User: admin"
echo "   Pass: admin"

if [ ! -z "$DASHBOARD_UID" ]; then
    echo -e "\n${YELLOW}🎯 k6 대시보드 링크:${NC}"
    echo "   http://3.38.28.172:3000/d/${DASHBOARD_UID}/k6-load-testing-results?from=now-15m&to=now"
else
    echo -e "\n${YELLOW}🎯 대시보드 확인:${NC}"
    echo "   http://3.38.28.172:3000/dashboards"
fi

echo -e "\n${GREEN}💡 Grafana에서 시간 범위를 'Last 15 minutes'로 설정하세요!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}\n"
