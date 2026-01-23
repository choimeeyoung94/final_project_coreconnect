#!/bin/bash

# ============================================
# 작동하는 k6 대시보드를 강제로 생성
# ============================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🔧 작동하는 k6 대시보드 강제 생성${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"

GRAFANA_URL="http://localhost:3000"
GRAFANA_USER="admin"
GRAFANA_PASS="admin"

# InfluxDB 데이터 확인
echo -e "\n${YELLOW}[1/4] InfluxDB 데이터 확인...${NC}"
DATA_COUNT=$(influx -execute "SELECT COUNT(*) FROM http_req_duration" -database="k6" 2>/dev/null | tail -1 | awk '{print $2}')

if [ ! -z "$DATA_COUNT" ] && [ "$DATA_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ InfluxDB: ${DATA_COUNT}개 레코드${NC}"
else
    echo -e "${RED}❌ InfluxDB에 데이터 없음!${NC}"
    exit 1
fi

# 측정값 목록 확인
echo -e "\n${YELLOW}사용 가능한 측정값:${NC}"
influx -execute "SHOW MEASUREMENTS" -database="k6" | tail -10

# Grafana 데이터 소스 확인 및 생성
echo -e "\n${YELLOW}[2/4] Grafana 데이터 소스 설정...${NC}"

# 기존 InfluxDB 데이터 소스 삭제
curl -s -u "${GRAFANA_USER}:${GRAFANA_PASS}" "${GRAFANA_URL}/api/datasources" | \
    grep -o '"id":[0-9]*' | grep -o '[0-9]*' | while read DS_ID; do
    curl -s -X DELETE -u "${GRAFANA_USER}:${GRAFANA_PASS}" \
        "${GRAFANA_URL}/api/datasources/${DS_ID}" > /dev/null 2>&1
done

# 새 데이터 소스 생성
curl -s -X POST -u "${GRAFANA_USER}:${GRAFANA_PASS}" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "InfluxDB-K6",
        "type": "influxdb",
        "access": "proxy",
        "url": "http://localhost:8086",
        "database": "k6",
        "isDefault": true,
        "jsonData": {
            "httpMode": "GET"
        }
    }' \
    "${GRAFANA_URL}/api/datasources" > /dev/null 2>&1

echo -e "${GREEN}✅ 데이터 소스 재생성 완료${NC}"

# 커스텀 대시보드 생성
echo -e "\n${YELLOW}[3/4] 커스텀 k6 대시보드 생성...${NC}"

DASHBOARD_JSON='{
  "dashboard": {
    "title": "k6 Load Test Results (Working)",
    "tags": ["k6", "load-test"],
    "timezone": "browser",
    "schemaVersion": 16,
    "version": 0,
    "refresh": "5s",
    "panels": [
      {
        "id": 1,
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0},
        "type": "graph",
        "title": "HTTP Request Duration (ms)",
        "targets": [
          {
            "refId": "A",
            "datasource": {"type": "influxdb", "uid": "InfluxDB-K6"},
            "query": "SELECT mean(\"value\") FROM \"http_req_duration\" WHERE $timeFilter GROUP BY time(5s) fill(null)"
          }
        ],
        "yaxes": [
          {"format": "ms", "label": null, "logBase": 1, "show": true},
          {"format": "short", "label": null, "logBase": 1, "show": true}
        ]
      },
      {
        "id": 2,
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0},
        "type": "graph",
        "title": "Virtual Users",
        "targets": [
          {
            "refId": "A",
            "datasource": {"type": "influxdb", "uid": "InfluxDB-K6"},
            "query": "SELECT mean(\"value\") FROM \"vus\" WHERE $timeFilter GROUP BY time(5s) fill(null)"
          }
        ]
      },
      {
        "id": 3,
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 8},
        "type": "graph",
        "title": "HTTP Requests per Second",
        "targets": [
          {
            "refId": "A",
            "datasource": {"type": "influxdb", "uid": "InfluxDB-K6"},
            "query": "SELECT sum(\"value\") FROM \"http_reqs\" WHERE $timeFilter GROUP BY time(1s) fill(0)"
          }
        ]
      },
      {
        "id": 4,
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 8},
        "type": "stat",
        "title": "Total HTTP Requests",
        "targets": [
          {
            "refId": "A",
            "datasource": {"type": "influxdb", "uid": "InfluxDB-K6"},
            "query": "SELECT sum(\"value\") FROM \"http_reqs\" WHERE $timeFilter"
          }
        ],
        "options": {
          "graphMode": "none",
          "colorMode": "value"
        }
      },
      {
        "id": 5,
        "gridPos": {"h": 8, "w": 24, "x": 0, "y": 16},
        "type": "table",
        "title": "Recent HTTP Requests (Raw Data)",
        "targets": [
          {
            "refId": "A",
            "datasource": {"type": "influxdb", "uid": "InfluxDB-K6"},
            "query": "SELECT * FROM \"http_req_duration\" WHERE $timeFilter LIMIT 50"
          }
        ]
      }
    ]
  },
  "overwrite": true
}'

RESPONSE=$(curl -s -X POST -u "${GRAFANA_USER}:${GRAFANA_PASS}" \
    -H "Content-Type: application/json" \
    -d "$DASHBOARD_JSON" \
    "${GRAFANA_URL}/api/dashboards/db")

if echo "$RESPONSE" | grep -q '"uid"'; then
    DASHBOARD_UID=$(echo "$RESPONSE" | grep -o '"uid":"[^"]*"' | cut -d'"' -f4)
    echo -e "${GREEN}✅ 대시보드 생성 완료 (UID: ${DASHBOARD_UID})${NC}"
    DASHBOARD_URL="http://3.38.28.172:3000/d/${DASHBOARD_UID}/k6-load-test-results-working?from=now-30m&to=now&refresh=5s"
else
    echo -e "${RED}❌ 대시보드 생성 실패${NC}"
    echo "$RESPONSE"
fi

# Explore 직접 쿼리 테스트
echo -e "\n${YELLOW}[4/4] Explore에서 직접 쿼리 테스트...${NC}"
echo -e "${YELLOW}다음 쿼리로 수동 확인 가능:${NC}"
echo "  SELECT * FROM \"http_req_duration\" LIMIT 10"
echo ""

# 최근 데이터 샘플 출력
echo -e "${YELLOW}InfluxDB 최근 데이터 샘플:${NC}"
influx -execute "SELECT * FROM http_req_duration ORDER BY time DESC LIMIT 5" -database="k6" -format=column

echo -e "\n${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ 설정 완료!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"

echo -e "\n${YELLOW}📊 다음 단계:${NC}"
echo "1. Grafana 접속: http://3.38.28.172:3000"
echo "2. 좌측 메뉴 → Dashboards"
echo "3. 'k6 Load Test Results (Working)' 클릭"
echo "4. 시간 범위: 'Last 30 minutes' 설정"
echo "5. Refresh (자동 5초마다)"

if [ ! -z "$DASHBOARD_URL" ]; then
    echo -e "\n${GREEN}🎯 직접 접속 링크:${NC}"
    echo "   ${DASHBOARD_URL}"
fi

echo -e "\n${YELLOW}🔍 문제 해결:${NC}"
echo "   Explore → InfluxDB-K6 → Query:"
echo "   SELECT * FROM \"http_req_duration\" LIMIT 10"

echo -e "\n${GREEN}💡 데이터가 안 보이면 시간 범위를 'Last 1 hour'로 확장!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}\n"
