#!/bin/bash

# AWS 비용 최적화 스크립트
# 필요할 때만 인스턴스를 시작하고, 테스트 후 자동 종료

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# AWS 설정 (여기에 실제 값을 입력하세요)
INSTANCE_ID="${INSTANCE_ID:-i-xxxxx}"  # EC2 인스턴스 ID
REGION="${AWS_REGION:-ap-northeast-2}"  # 서울 리전

# 함수: 인스턴스 상태 확인
check_instance_status() {
    echo -e "${YELLOW}인스턴스 상태 확인 중...${NC}"
    aws ec2 describe-instances \
        --instance-ids $INSTANCE_ID \
        --region $REGION \
        --query 'Reservations[0].Instances[0].State.Name' \
        --output text
}

# 함수: 인스턴스 시작
start_instance() {
    echo -e "${GREEN}인스턴스 시작 중...${NC}"
    aws ec2 start-instances \
        --instance-ids $INSTANCE_ID \
        --region $REGION
    
    echo -e "${YELLOW}인스턴스가 실행될 때까지 대기 중...${NC}"
    aws ec2 wait instance-running \
        --instance-ids $INSTANCE_ID \
        --region $REGION
    
    echo -e "${GREEN}✅ 인스턴스가 실행 중입니다!${NC}"
    
    # Public IP 가져오기
    PUBLIC_IP=$(aws ec2 describe-instances \
        --instance-ids $INSTANCE_ID \
        --region $REGION \
        --query 'Reservations[0].Instances[0].PublicIpAddress' \
        --output text)
    
    echo -e "${GREEN}Public IP: $PUBLIC_IP${NC}"
}

# 함수: 인스턴스 중지
stop_instance() {
    echo -e "${YELLOW}인스턴스 중지 중...${NC}"
    aws ec2 stop-instances \
        --instance-ids $INSTANCE_ID \
        --region $REGION
    
    echo -e "${YELLOW}인스턴스가 중지될 때까지 대기 중...${NC}"
    aws ec2 wait instance-stopped \
        --instance-ids $INSTANCE_ID \
        --region $REGION
    
    echo -e "${GREEN}✅ 인스턴스가 중지되었습니다!${NC}"
}

# 함수: 부하 테스트 실행
run_load_test() {
    echo -e "${GREEN}부하 테스트 실행 중...${NC}"
    
    # 서버가 완전히 준비될 때까지 대기
    echo -e "${YELLOW}서버 준비 대기 중 (2분)...${NC}"
    sleep 120
    
    # k6 테스트 실행
    echo -e "${GREEN}k6 테스트 시작${NC}"
    k6 run --vus 10000 --duration 5m k6-chatroom-performance-test.js
    
    echo -e "${GREEN}✅ 테스트 완료!${NC}"
}

# 함수: 비용 계산
calculate_cost() {
    local hours=$1
    local instance_type="${2:-t3.large}"
    
    # 시간당 비용 (ap-northeast-2 기준)
    declare -A prices=(
        ["t3.small"]="0.0208"
        ["t3.medium"]="0.0416"
        ["t3.large"]="0.0832"
        ["t3.xlarge"]="0.1664"
    )
    
    local hourly_rate=${prices[$instance_type]}
    local total_cost=$(echo "$hours * $hourly_rate" | bc)
    
    echo -e "${YELLOW}예상 비용: \$${total_cost} (${hours}시간 @ \$${hourly_rate}/시간)${NC}"
}

# 메인 메뉴
show_menu() {
    echo ""
    echo "======================================"
    echo "   AWS 비용 최적화 도구"
    echo "======================================"
    echo "1) 인스턴스 상태 확인"
    echo "2) 인스턴스 시작"
    echo "3) 인스턴스 중지"
    echo "4) 부하 테스트 실행 (자동 시작/종료)"
    echo "5) 비용 계산기"
    echo "6) 종료"
    echo "======================================"
    echo -n "선택: "
}

# 자동 테스트 (시작 → 테스트 → 종료)
auto_test() {
    echo -e "${GREEN}자동 테스트 모드${NC}"
    
    # 1. 인스턴스 시작
    STATUS=$(check_instance_status)
    if [ "$STATUS" != "running" ]; then
        start_instance
    else
        echo -e "${GREEN}✅ 인스턴스가 이미 실행 중입니다${NC}"
    fi
    
    # 2. 부하 테스트
    run_load_test
    
    # 3. 인스턴스 중지
    echo -e "${YELLOW}테스트가 완료되었습니다. 인스턴스를 중지하시겠습니까? (y/n)${NC}"
    read -r response
    if [ "$response" = "y" ]; then
        stop_instance
    else
        echo -e "${YELLOW}⚠️  인스턴스가 계속 실행 중입니다. 수동으로 중지하세요!${NC}"
    fi
    
    # 4. 비용 안내
    echo -e "${YELLOW}💰 오늘 테스트 비용: 약 \$0.17 (t3.large 2시간 기준)${NC}"
}

# 비용 계산기
cost_calculator() {
    echo -e "${YELLOW}비용 계산기${NC}"
    echo -n "테스트 시간 (시간): "
    read hours
    echo -n "인스턴스 타입 (t3.small/t3.medium/t3.large/t3.xlarge): "
    read instance_type
    
    calculate_cost $hours $instance_type
}

# 메인 루프
main() {
    # 환경 변수 확인
    if [ "$INSTANCE_ID" = "i-xxxxx" ]; then
        echo -e "${RED}⚠️  INSTANCE_ID를 설정하세요!${NC}"
        echo "사용법: export INSTANCE_ID=i-your-instance-id"
        echo "또는 스크립트 내부에서 직접 수정하세요"
        exit 1
    fi
    
    while true; do
        show_menu
        read choice
        
        case $choice in
            1)
                STATUS=$(check_instance_status)
                echo -e "${GREEN}현재 상태: $STATUS${NC}"
                ;;
            2)
                start_instance
                ;;
            3)
                stop_instance
                ;;
            4)
                auto_test
                ;;
            5)
                cost_calculator
                ;;
            6)
                echo -e "${GREEN}종료합니다.${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}잘못된 선택입니다.${NC}"
                ;;
        esac
    done
}

# 스크립트 실행
main


