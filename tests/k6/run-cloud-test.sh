#!/bin/bash

# ============================================
# k6 Cloud 부하 테스트 실행 스크립트
# ============================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "════════════════════════════════════════════════════════════════"
echo "              🚀 k6 Cloud 부하 테스트 실행"
echo "════════════════════════════════════════════════════════════════"
echo -e "${NC}"

# k6 Cloud 토큰 확인
if [ -z "$K6_CLOUD_TOKEN" ]; then
    echo -e "${YELLOW}⚠️  K6_CLOUD_TOKEN 환경 변수가 설정되지 않았습니다.${NC}"
    echo ""
    echo -e "${YELLOW}다음 단계를 따라주세요:${NC}"
    echo ""
    echo "1. k6 Cloud 계정 생성:"
    echo "   https://app.k6.io/account/register"
    echo ""
    echo "2. 로그인 후 토큰 발급:"
    echo "   https://app.k6.io/account/api-token"
    echo ""
    echo "3. 토큰을 환경 변수로 설정:"
    echo "   export K6_CLOUD_TOKEN=your_token_here"
    echo ""
    echo -e "${GREEN}또는 k6 CLI로 로그인:${NC}"
    echo "   k6 login cloud --token YOUR_TOKEN"
    echo ""
    
    # 대화형 로그인 시도
    echo -e "${YELLOW}지금 k6 Cloud 로그인을 시도하시겠습니까? (y/n)${NC}"
    read -p "> " answer
    
    if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
        echo ""
        echo -e "${YELLOW}k6 Cloud 토큰을 입력하세요:${NC}"
        read -s K6_TOKEN
        export K6_CLOUD_TOKEN=$K6_TOKEN
        
        # 토큰 저장
        k6 login cloud --token $K6_TOKEN
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ k6 Cloud 로그인 성공!${NC}"
        else
            echo -e "${RED}❌ k6 Cloud 로그인 실패${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ k6 Cloud 토큰이 필요합니다.${NC}"
        exit 1
    fi
fi

# 설정
BASE_URL="${BASE_URL:-http://3.38.28.172:8080}"
TEST_FILE="${TEST_FILE:-login-test-cloud.js}"

echo ""
echo -e "${YELLOW}📋 테스트 설정:${NC}"
echo "  • API 서버: ${BASE_URL}"
echo "  • 테스트 파일: ${TEST_FILE}"
echo "  • 최대 VUs: 100"
echo "  • 테스트 기간: 4분"
echo ""

# 테스트 파일 확인
if [ ! -f "$TEST_FILE" ]; then
    echo -e "${RED}❌ 테스트 파일을 찾을 수 없습니다: ${TEST_FILE}${NC}"
    exit 1
fi

if [ ! -d "common" ] || [ ! -f "common/test-users.js" ]; then
    echo -e "${RED}❌ common/test-users.js 파일을 찾을 수 없습니다${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 모든 파일 확인 완료${NC}"
echo ""

# k6 Cloud 테스트 실행
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🚀 k6 Cloud 테스트 시작!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}💡 테스트가 시작되면 아래에 Cloud 대시보드 URL이 출력됩니다!${NC}"
echo ""

# k6 cloud 명령어로 실행
BASE_URL="${BASE_URL}" k6 cloud "${TEST_FILE}"

EXIT_CODE=$?

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"

if [ ${EXIT_CODE} -eq 0 ]; then
    echo -e "${GREEN}✅ 테스트 완료!${NC}"
    echo ""
    echo -e "${YELLOW}📊 결과 확인:${NC}"
    echo "   k6 Cloud 대시보드에서 상세 결과를 확인하세요!"
    echo "   https://app.k6.io/runs"
else
    echo -e "${RED}❌ 테스트 실패 (Exit Code: ${EXIT_CODE})${NC}"
fi

echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""

exit ${EXIT_CODE}
