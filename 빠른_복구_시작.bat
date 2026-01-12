@echo off
chcp 65001 >nul
echo ================================================
echo   🚀 빠른 복구 시작!
echo ================================================
echo.

echo [옵션 1] 로컬 개발 환경 (추천!) ⭐⭐⭐
echo   - 비용: $0
echo   - 시간: 5분
echo   - 무제한 테스트
echo   - 개발/테스트에 완벽!
echo.
echo [옵션 2] 새 AWS k3s 서버 생성
echo   - 비용: 월 $15-30
echo   - 시간: 10분 (수동)
echo   - 배포 검증용
echo.
set /p choice="선택 (1 또는 2): "

if "%choice%"=="1" goto local
if "%choice%"=="2" goto create_new_server

echo ❌ 잘못된 선택입니다.
pause
exit /b 1

:local
echo.
echo ================================================
echo   🏠 로컬 환경 복구 시작
echo ================================================
echo.

echo [1/5] Docker 확인 중...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker가 설치되지 않았습니다!
    echo    Docker Desktop을 설치하세요: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)
echo ✅ Docker 설치됨

echo.
echo [2/5] 기존 컨테이너 정리 중...
docker-compose down 2>nul
echo ✅ 정리 완료

echo.
echo [3/5] Docker 이미지 빌드 중... (2-3분)
docker-compose build
if %errorlevel% neq 0 (
    echo ⚠️  빌드 실패. 기존 이미지 사용 시도...
)

echo.
echo [4/5] 전체 시스템 시작 중...
docker-compose up -d
if %errorlevel% neq 0 (
    echo ❌ 시작 실패
    echo.
    echo 로그 확인:
    docker-compose logs
    pause
    exit /b 1
)

echo ✅ 시스템 시작됨

echo.
echo [5/5] 서버 준비 대기 중 (1분)...
timeout /t 60 /nobreak >nul

echo.
echo ================================================
echo   ✅ 로컬 환경 복구 완료!
echo ================================================
echo.
echo 📊 서비스 상태:
docker-compose ps

echo.
echo 🌐 접속 정보:
echo   - Nginx: http://localhost
echo   - Chat App 1: http://localhost:8081
echo   - MySQL Master: localhost:3306
echo   - Redis Pub/Sub: localhost:6379
echo   - Prometheus: http://localhost:9090
echo   - Grafana: http://localhost:3000
echo.
echo 🧪 테스트 명령어:
echo   k6 run --vus 1000 k6-chatroom-performance-test.js
echo.
echo 💰 비용 절감: 월 40만원 → $0 🎉
echo.
pause
exit /b 0

:create_new_server
echo.
echo AWS CLI 확인 중...
aws --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ AWS CLI가 설치되지 않았습니다!
    echo    설치: https://aws.amazon.com/cli/
    pause
    exit /b 1
)
echo ✅ AWS CLI 설치됨

echo.
echo ⚠️  다음 정보가 필요합니다:
echo   - AWS 키 페어 이름
echo   - VPC 서브넷 ID
echo   - 보안 그룹 ID
echo.
echo 수동으로 AWS Console에서 생성하는 것을 권장합니다.
echo   1. AWS Console → EC2 → 인스턴스 시작
echo   2. AMI: Amazon Linux 2
echo   3. 타입: t3.small
echo   4. 시작 후 SSH 접속
echo   5. curl -sfL https://get.k3s.io ^| sh -
echo.
pause
exit /b 0
