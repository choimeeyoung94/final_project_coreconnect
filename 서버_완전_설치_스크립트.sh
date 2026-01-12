#!/bin/bash
# coreconnect-k6-server2 완전 설치 & 배포 스크립트
# 사용법: bash 서버_완전_설치_스크립트.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "================================================"
echo "   🚀 coreconnect 서버 완전 설치 & 배포"
echo "================================================"
echo ""

# Git 저장소 URL 입력
echo "Git 저장소 URL을 입력하세요:"
read -p "URL: " REPO_URL

if [ -z "$REPO_URL" ]; then
    echo "❌ Git URL이 필요합니다!"
    exit 1
fi

echo ""
echo "설정:"
echo "  Git URL: $REPO_URL"
echo ""
echo "계속하시겠습니까? (y/n)"
read -p "> " confirm

if [ "$confirm" != "y" ]; then
    echo "취소됨"
    exit 0
fi

echo ""
echo -e "${YELLOW}[1/6] k3s 설치 중...${NC}"
if command -v kubectl &> /dev/null; then
    echo "✅ k3s 이미 설치됨"
else
    curl -sfL https://get.k3s.io | sh -
    echo "⏳ k3s 시작 대기 (30초)..."
    sleep 30
    sudo systemctl status k3s
fi
echo -e "${GREEN}✅ k3s 준비 완료${NC}"
echo ""

echo -e "${YELLOW}[2/6] Git & Docker 설치 중...${NC}"
if ! command -v git &> /dev/null; then
    sudo yum install -y git
fi

if ! command -v docker &> /dev/null; then
    sudo yum install -y docker
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker $USER
fi
echo -e "${GREEN}✅ Git & Docker 설치 완료${NC}"
echo ""

echo -e "${YELLOW}[3/6] 프로젝트 클론 중...${NC}"
if [ -d "final_project_coreconnect" ]; then
    echo "⏳ 기존 프로젝트 업데이트..."
    cd final_project_coreconnect
    git pull
    cd ..
else
    git clone $REPO_URL final_project_coreconnect
fi
echo -e "${GREEN}✅ 프로젝트 준비 완료${NC}"
echo ""

echo -e "${YELLOW}[4/6] Docker 이미지 빌드 중... (2-3분)${NC}"
cd final_project_coreconnect/backend
sudo docker build -t chat-server:latest .
cd ../..
echo -e "${GREEN}✅ 이미지 빌드 완료${NC}"
echo ""

echo -e "${YELLOW}[5/6] k8s 리소스 배포 중...${NC}"
cd final_project_coreconnect

echo "  Namespace 생성..."
sudo kubectl apply -f k8s/00-namespace.yaml

echo "  MySQL 배포..."
sudo kubectl apply -f k8s/01-mysql.yaml
echo "  ⏳ MySQL 준비 대기 (60초)..."
sleep 60

echo "  Redis 배포..."
sudo kubectl apply -f k8s/02-redis.yaml
echo "  ⏳ Redis 준비 대기 (30초)..."
sleep 30

echo "  Chat Server 배포..."
sudo kubectl apply -f k8s/03-chat-server-dev.yaml
echo "  ⏳ Chat Server 준비 대기 (30초)..."
sleep 30

cd ..
echo -e "${GREEN}✅ 배포 완료${NC}"
echo ""

echo -e "${YELLOW}[6/6] 배포 상태 확인...${NC}"
echo ""
echo "=== Nodes ==="
sudo kubectl get nodes
echo ""
echo "=== Pods ==="
sudo kubectl get pods -n chat-system
echo ""
echo "=== Services ==="
sudo kubectl get svc -n chat-system
echo ""

echo "================================================"
echo -e "${GREEN}   ✅ 설치 & 배포 완료!${NC}"
echo "================================================"
echo ""
echo "접속 정보:"
echo "  HTTP: http://3.38.28.172"
echo "  Health: http://3.38.28.172/actuator/health"
echo ""
echo "확인 명령어:"
echo "  sudo kubectl get pods -n chat-system"
echo "  sudo kubectl logs -f <pod-name> -n chat-system"
echo ""
echo "🎉 배포 성공!"
