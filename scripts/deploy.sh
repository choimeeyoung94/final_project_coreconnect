#!/bin/bash

# Rolling Update 무중단 배포 스크립트 (자동 롤백 지원)
# 사용법: ./scripts/deploy.sh

set -e  # 오류 발생 시 스크립트 중단

echo "=========================================="
echo "🚀 Rolling Update 무중단 배포 시작"
echo "=========================================="

# 현재 디렉토리 확인
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$PROJECT_ROOT"
echo "📁 프로젝트 디렉토리: $PROJECT_ROOT"

# 1. Git Pull
echo ""
echo "📥 최신 코드 가져오기..."
git pull origin main

# 2. 현재 실행 중인 컨테이너 확인
echo ""
echo "🔍 현재 실행 중인 컨테이너 확인..."
docker ps --filter "name=boot-container" --format "{{.Names}}: {{.Status}}"
docker ps --filter "name=nginx-container" --format "{{.Names}}: {{.Status}}"

# 3. 백업: 현재 이미지 정보 저장
echo ""
echo "💾 현재 버전 백업 중..."
BACKUP_BACKEND_IMAGE=$(docker inspect boot-container --format='{{.Image}}' 2>/dev/null || echo "")
BACKUP_FRONTEND_IMAGE=$(docker inspect nginx-container --format='{{.Image}}' 2>/dev/null || echo "")

if [ -n "$BACKUP_BACKEND_IMAGE" ]; then
  echo "   Backend 백업 이미지: ${BACKUP_BACKEND_IMAGE:0:12}..."
fi
if [ -n "$BACKUP_FRONTEND_IMAGE" ]; then
  echo "   Frontend 백업 이미지: ${BACKUP_FRONTEND_IMAGE:0:12}..."
fi

# 4. 새 이미지 빌드 (기존 컨테이너는 계속 실행 중)
echo ""
echo "📦 새 Docker 이미지 빌드 중..."
echo "   (기존 서비스는 계속 실행됩니다)"
docker-compose build --no-cache

# 5. Backend 업데이트 (Rolling Update)
echo ""
echo "=========================================="
echo "🔄 Backend 컨테이너 업데이트 중..."
echo "=========================================="

# 현재 컨테이너를 백업 이름으로 변경
if docker ps -a --filter "name=boot-container" --format "{{.Names}}" | grep -q "boot-container"; then
  echo "📦 기존 컨테이너를 백업으로 보관 중..."
  docker rename boot-container boot-container-backup 2>/dev/null || true
fi

# 새 컨테이너 시작
echo "🚀 새 Backend 컨테이너 시작 중..."
docker-compose up -d --no-deps backend

# Backend Health Check (최대 90초 대기)
echo ""
echo "⏳ Backend Health Check 진행 중..."
BACKEND_HEALTHY=false
for i in {1..90}; do
  if docker exec boot-container curl -f http://localhost:8080/actuator/health > /dev/null 2>&1; then
    echo "✅ Backend 정상 동작 확인 ($i초 소요)"
    BACKEND_HEALTHY=true
    break
  fi
  
  # 10초마다 진행 상황 출력
  if [ $((i % 10)) -eq 0 ]; then
    echo "   대기 중... ($i/90초)"
  fi
  sleep 1
done

# Health Check 실패 시 자동 롤백
if [ "$BACKEND_HEALTHY" = false ]; then
  echo ""
  echo "=========================================="
  echo "❌ Backend Health Check 실패!"
  echo "🔄 이전 버전으로 자동 롤백 시작..."
  echo "=========================================="
  
  # 새 컨테이너 중지 및 제거
  echo "🗑️  실패한 컨테이너 제거 중..."
  docker stop boot-container 2>/dev/null || true
  docker rm boot-container 2>/dev/null || true
  
  # 백업 컨테이너 복구
  if docker ps -a --filter "name=boot-container-backup" --format "{{.Names}}" | grep -q "boot-container-backup"; then
    echo "♻️  이전 버전 복구 중..."
    docker rename boot-container-backup boot-container
    docker start boot-container
    
    # 복구 확인
    sleep 5
    if docker exec boot-container curl -f http://localhost:8080/actuator/health > /dev/null 2>&1; then
      echo "✅ 이전 버전으로 롤백 완료!"
      echo "   서비스가 정상 운영 중입니다."
    else
      echo "⚠️  롤백 후 Health Check 실패"
      echo "   수동 확인이 필요합니다."
    fi
  else
    echo "⚠️  백업 컨테이너를 찾을 수 없습니다."
    echo "   docker-compose up -d 명령으로 수동 복구가 필요합니다."
  fi
  
  echo ""
  echo "📋 배포 실패 로그:"
  docker logs boot-container --tail 50 2>/dev/null || echo "   로그를 가져올 수 없습니다."
  
  exit 1
fi

# Health Check 성공 시 백업 컨테이너 제거
echo ""
echo "✅ Backend 업데이트 성공!"
if docker ps -a --filter "name=boot-container-backup" --format "{{.Names}}" | grep -q "boot-container-backup"; then
  echo "🗑️  백업 컨테이너 제거 중..."
  docker stop boot-container-backup 2>/dev/null || true
  docker rm boot-container-backup 2>/dev/null || true
fi

# 6. Frontend 업데이트 (Rolling Update)
echo ""
echo "=========================================="
echo "🔄 Frontend 컨테이너 업데이트 중..."
echo "=========================================="

# 현재 컨테이너를 백업 이름으로 변경
if docker ps -a --filter "name=nginx-container" --format "{{.Names}}" | grep -q "nginx-container"; then
  echo "📦 기존 컨테이너를 백업으로 보관 중..."
  docker rename nginx-container nginx-container-backup 2>/dev/null || true
fi

# 새 컨테이너 시작
echo "🚀 새 Frontend 컨테이너 시작 중..."
docker-compose up -d --no-deps frontend

# Frontend Health Check (최대 30초 대기)
echo ""
echo "⏳ Frontend Health Check 진행 중..."
FRONTEND_HEALTHY=false
for i in {1..30}; do
  if docker exec nginx-container curl -f http://localhost:80 > /dev/null 2>&1; then
    echo "✅ Frontend 정상 동작 확인 ($i초 소요)"
    FRONTEND_HEALTHY=true
    break
  fi
  
  # 10초마다 진행 상황 출력
  if [ $((i % 10)) -eq 0 ]; then
    echo "   대기 중... ($i/30초)"
  fi
  sleep 1
done

# Health Check 실패 시 자동 롤백
if [ "$FRONTEND_HEALTHY" = false ]; then
  echo ""
  echo "=========================================="
  echo "❌ Frontend Health Check 실패!"
  echo "🔄 이전 버전으로 자동 롤백 시작..."
  echo "=========================================="
  
  # 새 컨테이너 중지 및 제거
  echo "🗑️  실패한 컨테이너 제거 중..."
  docker stop nginx-container 2>/dev/null || true
  docker rm nginx-container 2>/dev/null || true
  
  # 백업 컨테이너 복구
  if docker ps -a --filter "name=nginx-container-backup" --format "{{.Names}}" | grep -q "nginx-container-backup"; then
    echo "♻️  이전 버전 복구 중..."
    docker rename nginx-container-backup nginx-container
    docker start nginx-container
    
    # 복구 확인
    sleep 3
    if docker exec nginx-container curl -f http://localhost:80 > /dev/null 2>&1; then
      echo "✅ 이전 버전으로 롤백 완료!"
      echo "   서비스가 정상 운영 중입니다."
    else
      echo "⚠️  롤백 후 Health Check 실패"
      echo "   수동 확인이 필요합니다."
    fi
  else
    echo "⚠️  백업 컨테이너를 찾을 수 없습니다."
    echo "   docker-compose up -d 명령으로 수동 복구가 필요합니다."
  fi
  
  echo ""
  echo "📋 배포 실패 로그:"
  docker logs nginx-container --tail 50 2>/dev/null || echo "   로그를 가져올 수 없습니다."
  
  # Frontend 실패는 경고만 하고 계속 진행
  echo "⚠️  Frontend 배포 실패이지만 Backend는 정상이므로 서비스는 계속 운영됩니다."
fi

# Health Check 성공 시 백업 컨테이너 제거
if [ "$FRONTEND_HEALTHY" = true ]; then
  echo ""
  echo "✅ Frontend 업데이트 성공!"
  if docker ps -a --filter "name=nginx-container-backup" --format "{{.Names}}" | grep -q "nginx-container-backup"; then
    echo "🗑️  백업 컨테이너 제거 중..."
    docker stop nginx-container-backup 2>/dev/null || true
    docker rm nginx-container-backup 2>/dev/null || true
  fi
fi

# 7. 최종 상태 확인
echo ""
echo "=========================================="
echo "📊 배포 후 컨테이너 상태"
echo "=========================================="
docker ps --filter "name=boot-container" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
docker ps --filter "name=nginx-container" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 8. 사용하지 않는 이미지 정리
echo ""
echo "🧹 사용하지 않는 Docker 이미지 정리 중..."
docker image prune -f

# 9. 디스크 사용량 확인
echo ""
echo "💾 Docker 디스크 사용량:"
docker system df

# 완료
echo ""
echo "=========================================="
echo "🎉 Rolling Update 배포 완료!"
echo "=========================================="
echo ""
echo "✅ Backend:  http://coreconnect.io.kr (Port 8080)"
echo "✅ Frontend: http://coreconnect.io.kr (Port 80)"
echo ""
echo "📝 배포 로그 확인:"
echo "   docker logs boot-container --tail 100 -f"
echo "   docker logs nginx-container --tail 100 -f"
echo ""
echo "💡 Tip: 배포 실패 시 자동으로 이전 버전으로 롤백됩니다."
echo ""

