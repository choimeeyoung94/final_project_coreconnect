#!/bin/bash
# AWS k3s 서버 자동 배포 스크립트
# 사용법: ./AWS_배포_자동화.sh <PUBLIC_IP> <KEY_FILE>

set -e

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "================================================"
echo "   🚀 AWS k3s 서버 자동 배포"
echo "================================================"
echo ""

# 인자 확인
if [ $# -lt 2 ]; then
    echo -e "${RED}❌ 사용법: $0 <PUBLIC_IP> <KEY_FILE>${NC}"
    echo ""
    echo "예시:"
    echo "  $0 52.79.123.456 coreconnect-key.pem"
    exit 1
fi

PUBLIC_IP=$1
KEY_FILE=$2

# 키 파일 확인
if [ ! -f "$KEY_FILE" ]; then
    echo -e "${RED}❌ 키 파일을 찾을 수 없습니다: $KEY_FILE${NC}"
    exit 1
fi

# 키 파일 권한
chmod 400 "$KEY_FILE"

echo -e "${GREEN}✅ 설정:${NC}"
echo "  IP: $PUBLIC_IP"
echo "  Key: $KEY_FILE"
echo ""

# SSH 연결 테스트
echo -e "${YELLOW}[1/7] SSH 연결 테스트...${NC}"
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no -o ConnectTimeout=10 ec2-user@$PUBLIC_IP "echo 'Connected'" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ SSH 연결 실패${NC}"
    echo "확인사항:"
    echo "  1. Public IP가 맞는지"
    echo "  2. 보안 그룹에서 22번 포트 열렸는지"
    echo "  3. 인스턴스가 실행 중인지"
    exit 1
fi
echo -e "${GREEN}✅ SSH 연결 성공${NC}"
echo ""

# k3s 설치
echo -e "${YELLOW}[2/7] k3s 설치 중...${NC}"
ssh -i "$KEY_FILE" ec2-user@$PUBLIC_IP << 'ENDSSH'
    # k3s 설치
    if ! command -v k3s &> /dev/null; then
        echo "k3s 설치 중..."
        curl -sfL https://get.k3s.io | sh -
        sleep 30
    else
        echo "k3s 이미 설치됨"
    fi
    
    # 확인
    sudo systemctl status k3s | grep "active (running)"
    if [ $? -eq 0 ]; then
        echo "✅ k3s 실행 중"
    else
        echo "❌ k3s 실행 실패"
        exit 1
    fi
ENDSSH
echo -e "${GREEN}✅ k3s 설치 완료${NC}"
echo ""

# Docker 설치
echo -e "${YELLOW}[3/7] Docker 설치 중...${NC}"
ssh -i "$KEY_FILE" ec2-user@$PUBLIC_IP << 'ENDSSH'
    if ! command -v docker &> /dev/null; then
        echo "Docker 설치 중..."
        sudo yum install -y docker
        sudo systemctl start docker
        sudo systemctl enable docker
        sudo usermod -aG docker ec2-user
    else
        echo "Docker 이미 설치됨"
    fi
ENDSSH
echo -e "${GREEN}✅ Docker 설치 완료${NC}"
echo ""

# Git 설치 & 저장소 클론
echo -e "${YELLOW}[4/7] Git 저장소 클론 중...${NC}"
echo "Git 저장소 URL을 입력하세요 (예: https://github.com/user/repo.git):"
read REPO_URL

if [ -z "$REPO_URL" ]; then
    echo -e "${RED}❌ 저장소 URL이 필요합니다${NC}"
    exit 1
fi

ssh -i "$KEY_FILE" ec2-user@$PUBLIC_IP << ENDSSH
    # Git 설치
    if ! command -v git &> /dev/null; then
        sudo yum install -y git
    fi
    
    # 저장소 클론
    if [ -d "final_project_coreconnect" ]; then
        echo "저장소 업데이트 중..."
        cd final_project_coreconnect
        git pull
    else
        echo "저장소 클론 중..."
        git clone $REPO_URL final_project_coreconnect
    fi
ENDSSH
echo -e "${GREEN}✅ Git 저장소 클론 완료${NC}"
echo ""

# Docker 이미지 빌드
echo -e "${YELLOW}[5/7] Docker 이미지 빌드 중...${NC}"
ssh -i "$KEY_FILE" ec2-user@$PUBLIC_IP << 'ENDSSH'
    cd final_project_coreconnect/backend
    sudo docker build -t chat-server:latest .
    echo "✅ 이미지 빌드 완료"
ENDSSH
echo -e "${GREEN}✅ Docker 이미지 빌드 완료${NC}"
echo ""

# k8s 배포
echo -e "${YELLOW}[6/7] k8s 리소스 배포 중...${NC}"
ssh -i "$KEY_FILE" ec2-user@$PUBLIC_IP << 'ENDSSH'
    cd final_project_coreconnect
    
    # Namespace
    echo "Namespace 생성..."
    sudo kubectl apply -f k8s/00-namespace.yaml
    
    # MySQL
    echo "MySQL 배포..."
    sudo kubectl apply -f k8s/01-mysql.yaml
    echo "MySQL 준비 대기 (60초)..."
    sleep 60
    
    # Redis
    echo "Redis 배포..."
    sudo kubectl apply -f k8s/02-redis.yaml
    echo "Redis 준비 대기 (30초)..."
    sleep 30
    
    # Chat Server
    echo "Chat Server 배포..."
    sudo kubectl apply -f k8s/03-chat-server-dev.yaml
    echo "Chat Server 준비 대기 (30초)..."
    sleep 30
    
    echo "✅ 배포 완료"
ENDSSH
echo -e "${GREEN}✅ k8s 배포 완료${NC}"
echo ""

# 상태 확인
echo -e "${YELLOW}[7/7] 배포 상태 확인 중...${NC}"
ssh -i "$KEY_FILE" ec2-user@$PUBLIC_IP << 'ENDSSH'
    echo "=== Nodes ==="
    sudo kubectl get nodes
    
    echo ""
    echo "=== Pods ==="
    sudo kubectl get pods -n chat-system
    
    echo ""
    echo "=== Services ==="
    sudo kubectl get svc -n chat-system
ENDSSH
echo ""

# 완료
echo "================================================"
echo -e "${GREEN}   ✅ 배포 완료!${NC}"
echo "================================================"
echo ""
echo "접속 정보:"
echo "  서버 IP: $PUBLIC_IP"
echo "  HTTP: http://$PUBLIC_IP"
echo "  SSH: ssh -i $KEY_FILE ec2-user@$PUBLIC_IP"
echo ""
echo "상태 확인:"
echo "  ssh -i $KEY_FILE ec2-user@$PUBLIC_IP"
echo "  sudo kubectl get pods -n chat-system"
echo ""
echo "Health Check:"
echo "  curl http://$PUBLIC_IP/actuator/health"
echo ""
echo "🎉 배포 성공!"
