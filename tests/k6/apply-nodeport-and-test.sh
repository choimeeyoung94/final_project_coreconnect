#!/bin/bash

# CoreConnect - k6 Cloud 테스트를 위한 NodePort 서비스 설정 및 테스트 스크립트
# 작성일: 2026-01-15

echo "=========================================="
echo "k6 Cloud 테스트를 위한 서비스 설정"
echo "=========================================="

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Kubernetes 서비스를 NodePort로 변경
echo ""
echo -e "${YELLOW}[1/5] Kubernetes 서비스를 NodePort로 변경 중...${NC}"
kubectl apply -f k8s/service.yaml

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 서비스 적용 실패${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 서비스가 NodePort로 변경되었습니다${NC}"

# 2. 서비스 상태 확인
echo ""
echo -e "${YELLOW}[2/5] 서비스 상태 확인 중...${NC}"
kubectl get svc -n chat-system chat-service

# 3. EC2 인스턴스의 Public IP 가져오기
echo ""
echo -e "${YELLOW}[3/5] EC2 Public IP 확인 중...${NC}"
EC2_PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

if [ -z "$EC2_PUBLIC_IP" ]; then
    echo -e "${RED}❌ EC2 Public IP를 가져올 수 없습니다${NC}"
    echo "수동으로 입력해주세요:"
    read -p "EC2 Public IP: " EC2_PUBLIC_IP
fi

echo -e "${GREEN}EC2 Public IP: $EC2_PUBLIC_IP${NC}"

# 4. Security Group 설정 안내
echo ""
echo -e "${YELLOW}[4/5] AWS Security Group 설정이 필요합니다${NC}"
echo "=========================================="
echo "다음 단계를 수행하세요:"
echo ""
echo "1. AWS Console → EC2 → Security Groups"
echo "2. Kubernetes 서버의 Security Group 선택"
echo "3. Inbound Rules → Edit"
echo "4. 다음 규칙 추가:"
echo ""
echo "   Type: Custom TCP"
echo "   Port: 30080"
echo "   Source: 0.0.0.0/0 (또는 k6 Cloud IP 대역)"
echo "   Description: k6 Cloud Load Test"
echo ""
echo "=========================================="
echo ""
read -p "Security Group 설정을 완료했습니까? (y/n): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Security Group 설정 후 다시 실행해주세요${NC}"
    exit 1
fi

# 5. 연결 테스트
echo ""
echo -e "${YELLOW}[5/5] 연결 테스트 중...${NC}"
TEST_URL="http://$EC2_PUBLIC_IP:30080/actuator/health"
echo "테스트 URL: $TEST_URL"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $TEST_URL)

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ 연결 성공!${NC}"
else
    echo -e "${RED}❌ 연결 실패 (HTTP Status: $HTTP_STATUS)${NC}"
    echo "Security Group 설정을 다시 확인해주세요"
    exit 1
fi

# 6. 환경 변수 설정 및 테스트 실행
echo ""
echo "=========================================="
echo -e "${GREEN}k6 Cloud 테스트 준비 완료!${NC}"
echo "=========================================="
echo ""
echo "다음 명령어로 스트레스 테스트를 실행하세요:"
echo ""
echo -e "${YELLOW}export BASE_URL=http://$EC2_PUBLIC_IP:30080${NC}"
echo -e "${YELLOW}export WS_URL=ws://$EC2_PUBLIC_IP:30080${NC}"
echo -e "${YELLOW}k6 cloud tests/k6/chat-stress-test-cloud.js${NC}"
echo ""
echo "또는 자동 실행:"
echo ""
echo -e "${YELLOW}BASE_URL=http://$EC2_PUBLIC_IP:30080 WS_URL=ws://$EC2_PUBLIC_IP:30080 k6 cloud tests/k6/chat-stress-test-cloud.js${NC}"
echo ""
echo "=========================================="
