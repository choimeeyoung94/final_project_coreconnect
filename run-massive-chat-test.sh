#!/bin/bash

# ============================================================
# K6 대규모 채팅 부하 테스트 실행 스크립트 (Linux/Mac)
# ============================================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "========================================"
echo "K6 대규모 채팅 부하 테스트 시작"
echo "========================================"
echo ""

# 환경 변수 기본값 설정
export BASE_URL=${BASE_URL:-"http://localhost:8080"}
export WS_URL=${WS_URL:-"ws://localhost:8080"}
export TEST_ROOM_ID=${TEST_ROOM_ID:-"1"}
export TOTAL_USERS=${TOTAL_USERS:-"100000"}
export RAMP_UP_TIME=${RAMP_UP_TIME:-"5m"}
export STEADY_TIME=${STEADY_TIME:-"10m"}
export RAMP_DOWN_TIME=${RAMP_DOWN_TIME:-"2m"}

# 사용자 입력 받기
echo "테스트 설정:"
echo "1. 기본 설정 (10만명, 5분 램프업)"
echo "2. 중간 부하 (1만명, 2분 램프업) - 테스트용"
echo "3. 소규모 테스트 (1000명, 1분 램프업) - 로컬 테스트용"
echo "4. 사용자 정의"
echo ""
read -p "선택 (1-4): " choice

case $choice in
    1)
        echo ""
        echo -e "${GREEN}[선택] 대규모 부하 테스트 - 10만명 동시 접속${NC}"
        export TOTAL_USERS=100000
        export RAMP_UP_TIME="5m"
        export STEADY_TIME="10m"
        export RAMP_DOWN_TIME="2m"
        ;;
    2)
        echo ""
        echo -e "${GREEN}[선택] 중간 부하 테스트 - 1만명 동시 접속${NC}"
        export TOTAL_USERS=10000
        export RAMP_UP_TIME="2m"
        export STEADY_TIME="5m"
        export RAMP_DOWN_TIME="1m"
        ;;
    3)
        echo ""
        echo -e "${GREEN}[선택] 소규모 테스트 - 1000명 동시 접속${NC}"
        export TOTAL_USERS=1000
        export RAMP_UP_TIME="1m"
        export STEADY_TIME="3m"
        export RAMP_DOWN_TIME="30s"
        ;;
    4)
        echo ""
        read -p "동시 접속 사용자 수: " TOTAL_USERS
        read -p "램프업 시간 (예: 5m): " RAMP_UP_TIME
        read -p "유지 시간 (예: 10m): " STEADY_TIME
        read -p "램프다운 시간 (예: 2m): " RAMP_DOWN_TIME
        export TOTAL_USERS
        export RAMP_UP_TIME
        export STEADY_TIME
        export RAMP_DOWN_TIME
        ;;
    *)
        echo -e "${YELLOW}잘못된 선택입니다. 기본 설정을 사용합니다.${NC}"
        ;;
esac

echo ""
echo "========================================"
echo "테스트 구성:"
echo "----------------------------------------"
echo "BASE_URL: $BASE_URL"
echo "WS_URL: $WS_URL"
echo "TEST_ROOM_ID: $TEST_ROOM_ID"
echo "TOTAL_USERS: $TOTAL_USERS"
echo "RAMP_UP_TIME: $RAMP_UP_TIME"
echo "STEADY_TIME: $STEADY_TIME"
echo "RAMP_DOWN_TIME: $RAMP_DOWN_TIME"
echo "========================================"
echo ""

# 모니터링 환경 확인
echo "[1/4] 모니터링 환경 확인 중..."
if ! docker ps | grep -q "k6-influxdb"; then
    echo ""
    echo -e "${YELLOW}⚠️  InfluxDB가 실행 중이 아닙니다.${NC}"
    read -p "모니터링 환경을 시작하시겠습니까? (y/N): " start_monitoring
    if [[ "$start_monitoring" =~ ^[Yy]$ ]]; then
        echo ""
        echo "모니터링 환경 시작 중..."
        docker-compose -f docker-compose.monitoring.yml up -d
        echo ""
        echo "⏳ 모니터링 환경 초기화 대기 중 (30초)..."
        sleep 30
    else
        echo ""
        echo -e "${YELLOW}⚠️  모니터링 없이 테스트를 진행합니다.${NC}"
    fi
else
    echo -e "${GREEN}✅ 모니터링 환경이 실행 중입니다.${NC}"
fi

echo ""
echo "[2/4] 백엔드 서버 상태 확인 중..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/health 2>/dev/null || echo "000")

if [ "$STATUS" == "200" ]; then
    echo -e "${GREEN}✅ 백엔드 서버가 정상 실행 중입니다.${NC}"
else
    echo -e "${RED}❌ 백엔드 서버에 연결할 수 없습니다.${NC}"
    echo "서버를 먼저 시작해주세요."
    exit 1
fi

echo ""
echo "[3/4] 테스트 사용자 준비 확인..."
echo -e "${YELLOW}⚠️  테스트를 시작하기 전에 DB에 테스트 사용자가 준비되어 있는지 확인하세요.${NC}"
echo "   - testuser1@test.com ~ testuser${TOTAL_USERS}@test.com"
echo "   - 비밀번호: Test1234!"
echo ""
read -p "계속하시겠습니까? (y/N): " continue
if [[ ! "$continue" =~ ^[Yy]$ ]]; then
    echo "테스트를 취소합니다."
    exit 0
fi

echo ""
echo "[4/4] K6 부하 테스트 시작..."
echo ""
echo -e "${BLUE}📊 Grafana 대시보드: http://localhost:3000${NC}"
echo "   - 대시보드: \"K6 - 10만명 동시 접속 채팅 부하 테스트\""
echo "   - 로그인: admin / admin123"
echo ""

# K6 설치 확인
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}❌ K6가 설치되어 있지 않습니다.${NC}"
    echo ""
    echo "K6 설치 방법:"
    echo "  macOS: brew install k6"
    echo "  Linux: sudo apt-get install k6"
    echo "  또는 Docker 사용: docker run --rm -i grafana/k6 run - <script.js"
    echo ""
    read -p "Docker로 실행하시겠습니까? (y/N): " use_docker
    
    if [[ "$use_docker" =~ ^[Yy]$ ]]; then
        echo ""
        echo "Docker K6로 테스트 실행 중..."
        docker run --rm -i \
          --network host \
          -e K6_OUT=influxdb=http://localhost:8086/k6 \
          -e BASE_URL=$BASE_URL \
          -e WS_URL=$WS_URL \
          -e TEST_ROOM_ID=$TEST_ROOM_ID \
          -e TOTAL_USERS=$TOTAL_USERS \
          -e RAMP_UP_TIME=$RAMP_UP_TIME \
          -e STEADY_TIME=$STEADY_TIME \
          -e RAMP_DOWN_TIME=$RAMP_DOWN_TIME \
          -v "$(pwd)/performance-tests:/scripts" \
          grafana/k6:latest run /scripts/massive-chat-load-test.js
    else
        echo "테스트를 취소합니다."
        exit 1
    fi
else
    # K6 직접 실행
    k6 run \
      --out influxdb=http://localhost:8086/k6 \
      -e BASE_URL=$BASE_URL \
      -e WS_URL=$WS_URL \
      -e TEST_ROOM_ID=$TEST_ROOM_ID \
      -e TOTAL_USERS=$TOTAL_USERS \
      -e RAMP_UP_TIME=$RAMP_UP_TIME \
      -e STEADY_TIME=$STEADY_TIME \
      -e RAMP_DOWN_TIME=$RAMP_DOWN_TIME \
      performance-tests/massive-chat-load-test.js
fi

echo ""
echo "========================================"
echo "테스트 완료!"
echo "========================================"
echo ""
echo -e "${BLUE}📊 결과 확인:${NC}"
echo "1. Grafana 대시보드: http://localhost:3000"
echo "2. 생성된 리포트 파일:"
echo "   - summary.json"
echo "   - summary.html"
echo ""

# HTML 리포트 열기
if [ -f "summary.html" ]; then
    read -p "HTML 리포트를 여시겠습니까? (y/N): " open_report
    if [[ "$open_report" =~ ^[Yy]$ ]]; then
        if command -v xdg-open &> /dev/null; then
            xdg-open summary.html
        elif command -v open &> /dev/null; then
            open summary.html
        else
            echo "브라우저에서 summary.html 파일을 직접 열어주세요."
        fi
    fi
fi

echo ""
echo -e "${GREEN}✅ 모든 작업이 완료되었습니다.${NC}"

