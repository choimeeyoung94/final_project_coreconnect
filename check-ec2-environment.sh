#!/bin/bash
# ================================================================
# EC2 환경 확인 스크립트
# Redis 설치 필요 여부 자동 판단
# ================================================================

echo "========================================"
echo "🔍 EC2 환경 확인"
echo "========================================"
echo ""

# 색상 정의
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ----------------------------------------------------------------
# 1️⃣ Docker 확인
# ----------------------------------------------------------------
echo "1️⃣ Docker 설치 확인:"
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo -e "${GREEN}✅ Docker 설치됨: $DOCKER_VERSION${NC}"
    DOCKER_INSTALLED=true
else
    echo -e "${RED}❌ Docker 설치되지 않음${NC}"
    DOCKER_INSTALLED=false
fi

# ----------------------------------------------------------------
# 2️⃣ Docker Compose 확인
# ----------------------------------------------------------------
echo ""
echo "2️⃣ Docker Compose 설치 확인:"
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    echo -e "${GREEN}✅ Docker Compose 설치됨: $COMPOSE_VERSION${NC}"
    COMPOSE_INSTALLED=true
else
    echo -e "${RED}❌ Docker Compose 설치되지 않음${NC}"
    COMPOSE_INSTALLED=false
fi

# ----------------------------------------------------------------
# 3️⃣ Redis 확인
# ----------------------------------------------------------------
echo ""
echo "3️⃣ Redis 설치 확인:"
if command -v redis-cli &> /dev/null; then
    REDIS_VERSION=$(redis-cli --version)
    echo -e "${GREEN}✅ Redis CLI 설치됨: $REDIS_VERSION${NC}"
    
    # Redis 서비스 확인
    if systemctl is-active --quiet redis; then
        echo -e "${GREEN}✅ Redis 서비스 실행 중${NC}"
        REDIS_INSTALLED=true
    elif systemctl is-active --quiet redis-server; then
        echo -e "${GREEN}✅ Redis 서비스 실행 중${NC}"
        REDIS_INSTALLED=true
    else
        echo -e "${YELLOW}⚠️  Redis CLI 설치됨, 하지만 서비스 미실행${NC}"
        REDIS_INSTALLED=false
    fi
else
    echo -e "${RED}❌ Redis 설치되지 않음${NC}"
    REDIS_INSTALLED=false
fi

# ----------------------------------------------------------------
# 4️⃣ 현재 배포 방식 확인
# ----------------------------------------------------------------
echo ""
echo "4️⃣ 현재 배포 방식 확인:"

# Docker 컨테이너 확인
if [ "$DOCKER_INSTALLED" = true ]; then
    CONTAINERS=$(docker ps 2>/dev/null | grep -E "redis|mysql|spring" | wc -l)
    if [ $CONTAINERS -gt 0 ]; then
        echo -e "${GREEN}✅ Docker 컨테이너로 실행 중 ($CONTAINERS개)${NC}"
        docker ps --format "table {{.Names}}\t{{.Status}}"
        DEPLOYMENT_METHOD="docker"
    else
        echo -e "${YELLOW}⚠️  Docker는 설치되어 있지만 컨테이너 실행 안 됨${NC}"
        DEPLOYMENT_METHOD="unknown"
    fi
else
    DEPLOYMENT_METHOD="direct"
fi

# Java 프로세스 확인
JAVA_PROCESSES=$(ps aux | grep -E "java.*jar|java.*spring" | grep -v grep | wc -l)
if [ $JAVA_PROCESSES -gt 0 ]; then
    echo -e "${GREEN}✅ Java 프로세스로 실행 중 ($JAVA_PROCESSES개)${NC}"
    ps aux | grep -E "java.*jar|java.*spring" | grep -v grep
    if [ "$DEPLOYMENT_METHOD" = "unknown" ]; then
        DEPLOYMENT_METHOD="direct"
    fi
fi

# ----------------------------------------------------------------
# 5️⃣ 판단 및 권장사항
# ----------------------------------------------------------------
echo ""
echo "========================================"
echo "📊 판단 결과"
echo "========================================"
echo ""

if [ "$DOCKER_INSTALLED" = true ] && [ "$COMPOSE_INSTALLED" = true ]; then
    echo -e "${GREEN}✅ Docker Compose 사용 가능!${NC}"
    echo ""
    echo "🎯 권장사항:"
    echo "  - Redis 직접 설치 불필요"
    echo "  - Docker Compose로 전체 인프라 구성"
    echo ""
    echo "📝 다음 단계:"
    echo "  1. 프로젝트 클론:"
    echo "     git clone https://github.com/your-repo/final_project_coreconnect.git"
    echo "     cd final_project_coreconnect"
    echo ""
    echo "  2. 환경 변수 설정:"
    echo "     cp 환경변수_설정.txt .env"
    echo "     nano .env"
    echo ""
    echo "  3. 클러스터 시작:"
    echo "     chmod +x start-cluster.sh"
    echo "     ./start-cluster.sh"
    echo ""
    
elif [ "$DOCKER_INSTALLED" = false ] && [ "$REDIS_INSTALLED" = false ]; then
    echo -e "${YELLOW}⚠️  Docker와 Redis 모두 설치되지 않음${NC}"
    echo ""
    echo "🎯 권장사항:"
    echo "  - 옵션 1 (추천): Docker & Docker Compose 설치"
    echo "  - 옵션 2: Redis, MySQL 직접 설치"
    echo ""
    echo "📝 옵션 1: Docker 설치 (추천)"
    echo "  curl -fsSL https://get.docker.com -o get-docker.sh"
    echo "  sudo sh get-docker.sh"
    echo "  sudo usermod -aG docker \$USER"
    echo "  sudo curl -L \"https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose"
    echo "  sudo chmod +x /usr/local/bin/docker-compose"
    echo "  exit  # 재접속"
    echo ""
    echo "📝 옵션 2: Redis 직접 설치"
    echo "  sudo apt update"
    echo "  sudo apt install -y redis-server"
    echo "  sudo systemctl start redis-server"
    echo "  sudo systemctl enable redis-server"
    echo ""
    
elif [ "$DOCKER_INSTALLED" = true ] && [ "$REDIS_INSTALLED" = false ]; then
    echo -e "${GREEN}✅ Docker 설치됨 - Redis 직접 설치 불필요!${NC}"
    echo ""
    echo "🎯 권장사항:"
    echo "  - Docker Compose 사용"
    echo "  - Redis는 컨테이너로 자동 실행됨"
    echo ""
    
elif [ "$REDIS_INSTALLED" = true ]; then
    echo -e "${GREEN}✅ Redis 설치됨 - 직접 배포 방식 사용 중${NC}"
    echo ""
    echo "🎯 현재 상태:"
    echo "  - Redis 직접 설치됨"
    echo "  - Spring Boot JAR 직접 실행 방식"
    echo ""
    echo "⚠️  권장사항:"
    echo "  - Docker Compose로 전환 고려"
    echo "  - 더 쉬운 관리 및 확장"
    echo ""
fi

echo "========================================"
echo ""

# ----------------------------------------------------------------
# 6️⃣ 추가 정보
# ----------------------------------------------------------------
echo "📚 추가 정보:"
echo "  - 상세 가이드: EC2_배포_가이드.md"
echo "  - Docker Compose 가이드: README_DOCKER_COMPOSE.md"
echo "  - Quick Start: QUICK_START.md"
echo ""



