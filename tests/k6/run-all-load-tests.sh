#!/bin/bash

# ============================================================================
# CoreConnect 포괄적 부하 테스트 실행 스크립트 (Linux/macOS)
# ============================================================================

echo ""
echo "========================================"
echo "CoreConnect Load Test Suite"
echo "========================================"
echo ""
echo "이 스크립트는 다음 테스트를 순차적으로 실행합니다:"
echo "  1. Email System Stress Test"
echo "  2. Notification System Burst Test"
echo "  3. Chat Enhanced Stress Test"
echo "  4. Integrated System Production Test"
echo ""
echo "총 예상 소요 시간: 약 72분"
echo ""
read -p "계속하려면 Enter를 누르세요..."

# 현재 디렉토리로 이동
cd "$(dirname "$0")"

# 환경 변수 설정 (필요시 수정)
export BASE_URL=${BASE_URL:-"http://3.38.28.172:8080"}
export WS_URL=${WS_URL:-"ws://3.38.28.172:8080"}

echo ""
echo "[환경 설정]"
echo "BASE_URL=$BASE_URL"
echo "WS_URL=$WS_URL"
echo ""

# 색상 정의
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Email Stress Test
echo "========================================"
echo "[1/4] Email System Stress Test 실행"
echo "========================================"
echo "예상 시간: 20분"
echo ""
k6 cloud email-stress-test-cloud.js
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] Email 테스트 실패!${NC}"
    exit 1
fi
echo ""
echo -e "${GREEN}✓ Email 테스트 완료${NC}"
echo ""
sleep 10

# 2. Notification Burst Test
echo "========================================"
echo "[2/4] Notification System Burst Test 실행"
echo "========================================"
echo "예상 시간: 12분"
echo ""
k6 cloud notification-stress-test-cloud.js
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] Notification 테스트 실패!${NC}"
    exit 1
fi
echo ""
echo -e "${GREEN}✓ Notification 테스트 완료${NC}"
echo ""
sleep 10

# 3. Chat Enhanced Stress Test
echo "========================================"
echo "[3/4] Chat Enhanced Stress Test 실행"
echo "========================================"
echo "예상 시간: 20분"
echo ""
k6 cloud chat-enhanced-stress-test-cloud.js
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] Chat 테스트 실패!${NC}"
    exit 1
fi
echo ""
echo -e "${GREEN}✓ Chat 테스트 완료${NC}"
echo ""
sleep 10

# 4. Integrated Production Test
echo "========================================"
echo "[4/4] Integrated System Production Test 실행"
echo "========================================"
echo "예상 시간: 20분"
echo ""
k6 cloud integrated-stress-test-cloud.js
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] Integrated 테스트 실패!${NC}"
    exit 1
fi
echo ""
echo -e "${GREEN}✓ Integrated 테스트 완료${NC}"
echo ""

# 완료 메시지
echo ""
echo "========================================"
echo -e "${GREEN}모든 부하 테스트 완료!${NC}"
echo "========================================"
echo ""
echo "결과 확인:"
echo "  - k6 Cloud Dashboard에서 상세 결과 확인"
echo "  - https://app.k6.io/"
echo ""
echo "다음 단계:"
echo "  1. 각 테스트의 병목 지점 분석"
echo "  2. 처리량과 지연시간 메트릭 검토"
echo "  3. 최적화 계획 수립"
echo ""
echo "가이드 문서: COMPREHENSIVE_LOAD_TEST_GUIDE.md"
echo ""
