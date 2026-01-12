#!/bin/bash
# ================================================================
# 10만명 동시접속 채팅방 - 클러스터 시작 스크립트
# ================================================================

set -e

echo "========================================"
echo "🚀 10만명 동시접속 채팅 클러스터 시작"
echo "========================================"
echo ""

# ----------------------------------------------------------------
# 1️⃣ 환경 확인
# ----------------------------------------------------------------
echo "1️⃣ 환경 확인 중..."
echo ""

# Docker 확인
if ! command -v docker &> /dev/null; then
    echo "❌ Docker가 설치되어 있지 않습니다!"
    echo "   설치: https://docs.docker.com/get-docker/"
    exit 1
fi
echo "✅ Docker 설치됨: $(docker --version)"

# Docker Compose 확인
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose가 설치되어 있지 않습니다!"
    echo "   설치: https://docs.docker.com/compose/install/"
    exit 1
fi
echo "✅ Docker Compose 설치됨: $(docker-compose --version)"

# .env 파일 확인
if [ ! -f .env ]; then
    echo "⚠️  .env 파일이 없습니다. 환경변수_설정.txt를 복사합니다..."
    if [ -f "환경변수_설정.txt" ]; then
        cp "환경변수_설정.txt" .env
        echo "✅ .env 파일 생성 완료"
    else
        echo "❌ 환경변수_설정.txt 파일이 없습니다!"
        exit 1
    fi
else
    echo "✅ .env 파일 존재"
fi

# 필수 디렉토리 확인
echo ""
echo "필수 디렉토리 확인 중..."
mkdir -p nginx/ssl
mkdir -p monitoring/grafana/datasources
mkdir -p monitoring/grafana/dashboards
mkdir -p mysql/init
mkdir -p backend
echo "✅ 디렉토리 생성 완료"

# ----------------------------------------------------------------
# 2️⃣ 기존 컨테이너 정리 (선택 사항)
# ----------------------------------------------------------------
echo ""
read -p "기존 컨테이너를 정리하시겠습니까? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "2️⃣ 기존 컨테이너 정리 중..."
    docker-compose down -v
    echo "✅ 정리 완료"
fi

# ----------------------------------------------------------------
# 3️⃣ Docker Compose 시작
# ----------------------------------------------------------------
echo ""
echo "3️⃣ Docker Compose 시작 중..."
echo ""

# 빌드 날짜와 Git 커밋 해시 설정
export BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
export VCS_REF=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Docker Compose 시작
docker-compose up -d

echo ""
echo "✅ Docker Compose 시작 완료"

# ----------------------------------------------------------------
# 4️⃣ 컨테이너 시작 대기
# ----------------------------------------------------------------
echo ""
echo "4️⃣ 컨테이너 시작 대기 중..."
echo ""

echo "⏳ 인프라 서비스 시작 대기 (30초)..."
sleep 30

echo "⏳ Spring Boot 애플리케이션 시작 대기 (60초)..."
sleep 60

# ----------------------------------------------------------------
# 5️⃣ MySQL Replication 초기화
# ----------------------------------------------------------------
echo ""
echo "5️⃣ MySQL Replication 설정 중..."
echo ""

# Master 상태 확인
echo "Master 상태 확인 중..."
MASTER_STATUS=$(docker exec chat-mysql-master mysql -uroot -pChat@2024!Secure -e "SHOW MASTER STATUS\G" 2>/dev/null)

if [ -n "$MASTER_STATUS" ]; then
    LOG_FILE=$(echo "$MASTER_STATUS" | grep "File:" | awk '{print $2}')
    LOG_POS=$(echo "$MASTER_STATUS" | grep "Position:" | awk '{print $2}')
    
    echo "Master Log File: $LOG_FILE"
    echo "Master Log Position: $LOG_POS"
    
    # Replication 사용자 생성 (이미 존재하면 무시)
    docker exec chat-mysql-master mysql -uroot -pChat@2024!Secure << EOF 2>/dev/null
CREATE USER IF NOT EXISTS 'repl_user'@'%' IDENTIFIED BY 'Repl@2024!Pass';
GRANT REPLICATION SLAVE ON *.* TO 'repl_user'@'%';
FLUSH PRIVILEGES;
EOF
    
    # Slave 1 설정
    echo "Slave 1 설정 중..."
    docker exec chat-mysql-slave-1 mysql -uroot -pChat@2024!Secure << EOF 2>/dev/null
STOP SLAVE;
CHANGE MASTER TO
  MASTER_HOST='mysql-master',
  MASTER_PORT=3306,
  MASTER_USER='repl_user',
  MASTER_PASSWORD='Repl@2024!Pass',
  MASTER_LOG_FILE='$LOG_FILE',
  MASTER_LOG_POS=$LOG_POS,
  GET_MASTER_PUBLIC_KEY=1;
START SLAVE;
EOF
    
    # Slave 2 설정
    echo "Slave 2 설정 중..."
    docker exec chat-mysql-slave-2 mysql -uroot -pChat@2024!Secure << EOF 2>/dev/null
STOP SLAVE;
CHANGE MASTER TO
  MASTER_HOST='mysql-master',
  MASTER_PORT=3306,
  MASTER_USER='repl_user',
  MASTER_PASSWORD='Repl@2024!Pass',
  MASTER_LOG_FILE='$LOG_FILE',
  MASTER_LOG_POS=$LOG_POS,
  GET_MASTER_PUBLIC_KEY=1;
START SLAVE;
EOF
    
    echo "✅ MySQL Replication 설정 완료"
else
    echo "⚠️  MySQL Master가 아직 준비되지 않았습니다. 수동으로 Replication을 설정하세요."
fi

# ----------------------------------------------------------------
# 6️⃣ 헬스체크
# ----------------------------------------------------------------
echo ""
echo "6️⃣ 헬스체크 실행 중..."
echo ""

# 헬스체크 스크립트 실행
if [ -f "./health-check.sh" ]; then
    chmod +x ./health-check.sh
    ./health-check.sh
else
    echo "⚠️  health-check.sh 파일이 없습니다."
    
    # 간단한 헬스체크
    echo "기본 헬스체크 실행 중..."
    
    echo "1️⃣ Nginx:"
    curl -sf http://localhost:80/health > /dev/null 2>&1 && echo "  ✅ Nginx 정상" || echo "  ❌ Nginx 비정상"
    
    echo ""
    echo "2️⃣ Redis:"
    docker exec chat-redis-pubsub redis-cli ping > /dev/null 2>&1 && echo "  ✅ Redis Pub/Sub 정상" || echo "  ❌ Redis Pub/Sub 비정상"
    docker exec chat-redis-session redis-cli -p 6380 ping > /dev/null 2>&1 && echo "  ✅ Redis Session 정상" || echo "  ❌ Redis Session 비정상"
    
    echo ""
    echo "3️⃣ MySQL:"
    docker exec chat-mysql-master mysqladmin ping -h localhost -u root -pChat@2024!Secure --silent > /dev/null 2>&1 && echo "  ✅ MySQL Master 정상" || echo "  ❌ MySQL Master 비정상"
    
    echo ""
    echo "4️⃣ Spring Boot (샘플 체크):"
    for i in 1 2 3; do
        port=$((8080 + i))
        curl -sf http://localhost:$port/actuator/health > /dev/null 2>&1 && echo "  ✅ chat-app-$i 정상 (포트 $port)" || echo "  ❌ chat-app-$i 비정상 (포트 $port)"
    done
fi

# ----------------------------------------------------------------
# 7️⃣ 완료
# ----------------------------------------------------------------
echo ""
echo "========================================"
echo "✅ 클러스터 시작 완료!"
echo "========================================"
echo ""
echo "📊 접속 정보:"
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🌐 Nginx (Load Balancer):"
echo "     http://localhost:80"
echo ""
echo "  💬 Spring Boot Servers (10대):"
echo "     http://localhost:8081 ~ 8090"
echo ""
echo "  📊 Grafana (모니터링):"
echo "     http://localhost:3000"
echo "     계정: admin / admin123"
echo ""
echo "  📈 Prometheus:"
echo "     http://localhost:9090"
echo ""
echo "  🗄️ Redis Commander:"
echo "     http://localhost:8081"
echo "     계정: admin / admin123"
echo ""
echo "  🗄️ MySQL:"
echo "     Master:  localhost:3306"
echo "     Slave 1: localhost:3307"
echo "     Slave 2: localhost:3308"
echo "     계정: root / Chat@2024!Secure"
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 유용한 명령어:"
echo "  - 상태 확인:   docker-compose ps"
echo "  - 로그 확인:   docker-compose logs -f [service-name]"
echo "  - 중지:       ./stop-cluster.sh"
echo "  - 재시작:     docker-compose restart"
echo "  - 헬스체크:   ./health-check.sh"
echo ""
echo "📚 다음 단계:"
echo "  1. Grafana 대시보드 설정"
echo "  2. K6 부하 테스트 실행"
echo "  3. 성능 모니터링"
echo ""
echo "🎉 Happy Scaling! 🚀"
echo ""



