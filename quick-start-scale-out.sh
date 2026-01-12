#!/bin/bash
# ================================================================
# 10만명 동시접속 채팅방 - 서버 스케일 아웃 Quick Start
# ================================================================

set -e

echo "========================================"
echo "🚀 10만명 동시접속 채팅 서버 스케일 아웃"
echo "========================================"
echo ""

# ----------------------------------------------------------------
# 1️⃣ 사전 확인
# ----------------------------------------------------------------
echo "1️⃣ 사전 확인 중..."
echo ""

# Docker 확인
if ! command -v docker &> /dev/null; then
    echo "❌ Docker가 설치되어 있지 않습니다!"
    echo "   설치: https://docs.docker.com/get-docker/"
    exit 1
fi
echo "✅ Docker 설치됨"

# Docker Compose 확인
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose가 설치되어 있지 않습니다!"
    echo "   설치: https://docs.docker.com/compose/install/"
    exit 1
fi
echo "✅ Docker Compose 설치됨"

# 메모리 확인 (최소 16GB 권장)
TOTAL_MEM=$(free -g | awk '/^Mem:/{print $2}')
if [ "$TOTAL_MEM" -lt 16 ]; then
    echo "⚠️  메모리가 ${TOTAL_MEM}GB입니다. 최소 16GB 권장합니다."
    read -p "계속 진행하시겠습니까? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ 메모리: ${TOTAL_MEM}GB"
fi

# ----------------------------------------------------------------
# 2️⃣ 프로젝트 구조 생성
# ----------------------------------------------------------------
echo ""
echo "2️⃣ 프로젝트 구조 생성 중..."
echo ""

mkdir -p nginx/ssl
mkdir -p monitoring
mkdir -p scripts
mkdir -p backend

echo "✅ 디렉토리 생성 완료"

# ----------------------------------------------------------------
# 3️⃣ 환경 변수 설정
# ----------------------------------------------------------------
echo ""
echo "3️⃣ 환경 변수 설정 중..."
echo ""

cat > .env << 'ENV_EOF'
# ================================================================
# 환경 변수
# ================================================================

# MySQL
MYSQL_ROOT_PASSWORD=Chat@2024!Secure
MYSQL_DATABASE=db_coreconnect
MYSQL_REPLICATION_USER=repl_user
MYSQL_REPLICATION_PASSWORD=Repl@2024!Pass

# Redis
REDIS_MAXMEMORY=2gb
REDIS_SESSION_MAXMEMORY=4gb

# Grafana
GF_SECURITY_ADMIN_PASSWORD=Admin@2024!Grafana
ENV_EOF

echo "✅ .env 파일 생성 완료"

# ----------------------------------------------------------------
# 4️⃣ 간단한 Docker Compose 생성 (테스트용 3대 서버)
# ----------------------------------------------------------------
echo ""
echo "4️⃣ Docker Compose 파일 생성 중 (테스트용 3대 서버)..."
echo ""

cat > docker-compose-test.yml << 'COMPOSE_EOF'
version: '3.8'

networks:
  chat-network:
    driver: bridge

services:
  # ================================================================
  # Nginx Load Balancer
  # ================================================================
  nginx:
    image: nginx:1.25-alpine
    container_name: chat-nginx
    ports:
      - "80:80"
    networks:
      - chat-network
    command: >
      /bin/sh -c "
      echo '
      events {
          worker_connections 1024;
      }
      http {
          upstream chat_servers {
              least_conn;
              server chat-app-1:8080;
              server chat-app-2:8080;
              server chat-app-3:8080;
          }
          server {
              listen 80;
              location /health {
                  return 200 \"healthy\n\";
                  add_header Content-Type text/plain;
              }
              location / {
                  proxy_pass http://chat_servers;
                  proxy_set_header Host \$$host;
                  proxy_set_header X-Real-IP \$$remote_addr;
              }
              location /ws {
                  proxy_pass http://chat_servers;
                  proxy_http_version 1.1;
                  proxy_set_header Upgrade \$$http_upgrade;
                  proxy_set_header Connection \"upgrade\";
                  proxy_set_header Host \$$host;
              }
          }
      }
      ' > /etc/nginx/nginx.conf &&
      nginx -g 'daemon off;'
      "

  # ================================================================
  # Spring Boot Servers (3대 - 테스트용)
  # ================================================================
  chat-app-1:
    image: openjdk:17-slim
    container_name: chat-app-1
    ports:
      - "8081:8080"
    networks:
      - chat-network
    environment:
      - SERVER_ID=1
    command: >
      /bin/sh -c "
      echo 'Spring Boot #1 Mock Server' &&
      while true; do
        echo -e 'HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\n{\"status\":\"UP\",\"server\":\"chat-app-1\"}' | nc -l -p 8080 -q 1;
      done
      "

  chat-app-2:
    image: openjdk:17-slim
    container_name: chat-app-2
    ports:
      - "8082:8080"
    networks:
      - chat-network
    environment:
      - SERVER_ID=2
    command: >
      /bin/sh -c "
      echo 'Spring Boot #2 Mock Server' &&
      while true; do
        echo -e 'HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\n{\"status\":\"UP\",\"server\":\"chat-app-2\"}' | nc -l -p 8080 -q 1;
      done
      "

  chat-app-3:
    image: openjdk:17-slim
    container_name: chat-app-3
    ports:
      - "8083:8080"
    networks:
      - chat-network
    environment:
      - SERVER_ID=3
    command: >
      /bin/sh -c "
      echo 'Spring Boot #3 Mock Server' &&
      while true; do
        echo -e 'HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\n{\"status\":\"UP\",\"server\":\"chat-app-3\"}' | nc -l -p 8080 -q 1;
      done
      "

  # ================================================================
  # Redis Pub/Sub
  # ================================================================
  redis-pubsub:
    image: redis:7.2-alpine
    container_name: chat-redis-pubsub
    ports:
      - "6379:6379"
    networks:
      - chat-network
    command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru

  # ================================================================
  # MySQL Master
  # ================================================================
  mysql-master:
    image: mysql:8.0
    container_name: chat-mysql-master
    ports:
      - "3306:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=Chat@2024!Secure
      - MYSQL_DATABASE=db_coreconnect
    networks:
      - chat-network
    command: >
      --server-id=1
      --log-bin=mysql-bin
      --max-connections=500
      --character-set-server=utf8mb4
      --collation-server=utf8mb4_unicode_ci

  # ================================================================
  # Grafana
  # ================================================================
  grafana:
    image: grafana/grafana:latest
    container_name: chat-grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin123
    networks:
      - chat-network
COMPOSE_EOF

echo "✅ docker-compose-test.yml 생성 완료"

# ----------------------------------------------------------------
# 5️⃣ Docker Compose 시작
# ----------------------------------------------------------------
echo ""
echo "5️⃣ Docker Compose 시작 중..."
echo ""

docker-compose -f docker-compose-test.yml up -d

echo ""
echo "⏳ 컨테이너 시작 대기 중... (20초)"
sleep 20

# ----------------------------------------------------------------
# 6️⃣ 헬스체크
# ----------------------------------------------------------------
echo ""
echo "6️⃣ 헬스체크 실행 중..."
echo ""

echo "1️⃣ Nginx:"
if curl -sf http://localhost:80/health > /dev/null 2>&1; then
    echo "  ✅ Nginx 정상 (포트 80)"
else
    echo "  ❌ Nginx 비정상"
fi

echo ""
echo "2️⃣ Spring Boot 서버 (3대):"
for i in {1..3}; do
    port=$((8080 + i))
    if curl -sf http://localhost:$port > /dev/null 2>&1; then
        echo "  ✅ chat-app-$i 정상 (포트 $port)"
    else
        echo "  ❌ chat-app-$i 비정상 (포트 $port)"
    fi
done

echo ""
echo "3️⃣ Redis:"
if docker exec chat-redis-pubsub redis-cli ping > /dev/null 2>&1; then
    echo "  ✅ Redis Pub/Sub 정상 (포트 6379)"
else
    echo "  ❌ Redis Pub/Sub 비정상"
fi

echo ""
echo "4️⃣ MySQL:"
if docker exec chat-mysql-master mysqladmin ping -h localhost -u root -pChat@2024!Secure --silent > /dev/null 2>&1; then
    echo "  ✅ MySQL Master 정상 (포트 3306)"
else
    echo "  ❌ MySQL Master 비정상"
fi

echo ""
echo "5️⃣ Grafana:"
if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "  ✅ Grafana 정상 (포트 3000)"
else
    echo "  ❌ Grafana 비정상"
fi

# ----------------------------------------------------------------
# 7️⃣ 로드 밸런싱 테스트
# ----------------------------------------------------------------
echo ""
echo "7️⃣ 로드 밸런싱 테스트 (10회 요청)..."
echo ""

echo "Nginx를 통한 요청 분산 확인:"
for i in {1..10}; do
    response=$(curl -s http://localhost/)
    echo "  요청 $i: $response"
    sleep 0.5
done

# ----------------------------------------------------------------
# 8️⃣ 완료
# ----------------------------------------------------------------
echo ""
echo "========================================"
echo "✅ 스케일 아웃 클러스터 시작 완료!"
echo "========================================"
echo ""
echo "📊 접속 정보:"
echo "  - Nginx (Load Balancer): http://localhost:80"
echo "  - Chat App #1: http://localhost:8081"
echo "  - Chat App #2: http://localhost:8082"
echo "  - Chat App #3: http://localhost:8083"
echo "  - Redis: redis://localhost:6379"
echo "  - MySQL: mysql://root:Chat@2024!Secure@localhost:3306/db_coreconnect"
echo "  - Grafana: http://localhost:3000 (admin/admin123)"
echo ""
echo "📝 유용한 명령어:"
echo "  - 로그 확인: docker-compose -f docker-compose-test.yml logs -f [service]"
echo "  - 상태 확인: docker-compose -f docker-compose-test.yml ps"
echo "  - 중지: docker-compose -f docker-compose-test.yml down"
echo "  - 완전 삭제: docker-compose -f docker-compose-test.yml down -v"
echo ""
echo "📚 다음 단계:"
echo "  1. 서버_스케일_아웃_10대_구축_가이드.md 읽기"
echo "  2. 실제 Spring Boot 애플리케이션 배포"
echo "  3. K6 부하 테스트 실행"
echo ""
echo "🎉 Happy Scaling! 🚀"
echo ""



