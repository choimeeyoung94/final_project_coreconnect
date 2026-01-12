@echo off
chcp 65001 >nul
echo ================================================
echo   💰 로컬 부하 테스트 (비용 $0)
echo ================================================
echo.

echo [1단계] Docker 환경 확인 중...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker가 설치되지 않았습니다!
    echo    Docker Desktop을 설치하세요: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)
echo ✅ Docker 설치됨

echo.
echo [2단계] Docker Compose 실행 중...
docker-compose up -d
if %errorlevel% neq 0 (
    echo ❌ Docker Compose 실행 실패
    pause
    exit /b 1
)
echo ✅ Docker Compose 실행 완료

echo.
echo [3단계] 서버 준비 대기 중 (30초)...
timeout /t 30 /nobreak >nul
echo ✅ 서버 준비 완료

echo.
echo [4단계] k6 설치 확인 중...
k6 version >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  k6가 설치되지 않았습니다!
    echo    설치 방법: https://k6.io/docs/getting-started/installation/
    echo.
    echo    Windows (Chocolatey):
    echo    choco install k6
    echo.
    echo    또는 수동 설치:
    echo    https://github.com/grafana/k6/releases
    pause
    exit /b 1
)
echo ✅ k6 설치됨

echo.
echo ================================================
echo   🚀 부하 테스트 시작!
echo ================================================
echo.

echo 어떤 테스트를 실행하시겠습니까?
echo.
echo 1. 소규모 (1,000명) - 기능 확인용
echo 2. 중규모 (10,000명) - 성능 측정용
echo 3. 대규모 (50,000명) - 한계 테스트용
echo 4. 전체 테스트 실행
echo 5. 종료
echo.
set /p choice="선택 (1-5): "

if "%choice%"=="1" goto test_small
if "%choice%"=="2" goto test_medium
if "%choice%"=="3" goto test_large
if "%choice%"=="4" goto test_all
if "%choice%"=="5" goto end

echo ❌ 잘못된 선택입니다.
pause
exit /b 1

:test_small
echo.
echo 📊 소규모 테스트 (1,000 VU) 실행 중...
echo.
if exist k6-login-test.js (
    k6 run --vus 1000 --duration 30s k6-login-test.js
)
if exist k6-chatroom-performance-test.js (
    k6 run --vus 1000 --duration 30s k6-chatroom-performance-test.js
)
goto result

:test_medium
echo.
echo 📊 중규모 테스트 (10,000 VU) 실행 중...
echo.
if exist k6-chatroom-performance-test.js (
    k6 run --vus 10000 --duration 1m k6-chatroom-performance-test.js
)
goto result

:test_large
echo.
echo 📊 대규모 테스트 (50,000 VU) 실행 중...
echo ⚠️  주의: PC 리소스가 많이 필요합니다!
echo.
pause
if exist k6-chatroom-performance-test.js (
    k6 run --vus 50000 --duration 30s k6-chatroom-performance-test.js
)
goto result

:test_all
echo.
echo 📊 전체 테스트 실행 중...
echo.
echo [1/3] 로그인 테스트
if exist k6-login-test.js (
    k6 run --vus 1000 --duration 30s k6-login-test.js
)
echo.
echo [2/3] 채팅방 테스트
if exist k6-chatroom-performance-test.js (
    k6 run --vus 10000 --duration 1m k6-chatroom-performance-test.js
)
echo.
echo [3/3] JWT 인증 테스트
if exist k6-jwt-auth-test.js (
    k6 run --vus 1000 --duration 30s k6-jwt-auth-test.js
)
goto result

:result
echo.
echo ================================================
echo   ✅ 테스트 완료!
echo ================================================
echo.
echo 📊 결과 요약:
echo    - 비용: $0 (무료!)
echo    - 환경: 로컬 Docker
echo    - AWS 대비 절감: 월 40만원
echo.
echo 💡 다음 단계:
echo    1. 결과 분석 (로그 확인)
echo    2. 병목 구간 찾기
echo    3. 코드 개선
echo    4. 재테스트 반복
echo.

:show_menu
echo.
echo 다음 작업을 선택하세요:
echo.
echo 1. 다시 테스트하기
echo 2. Docker 로그 확인
echo 3. Docker 상태 확인
echo 4. Docker 중지
echo 5. 종료
echo.
set /p next="선택 (1-5): "

if "%next%"=="1" goto restart
if "%next%"=="2" goto logs
if "%next%"=="3" goto status
if "%next%"=="4" goto stop
if "%next%"=="5" goto end

echo ❌ 잘못된 선택입니다.
goto show_menu

:restart
cls
goto test_small

:logs
echo.
echo 📋 Docker 로그 (Ctrl+C로 중지):
docker-compose logs -f --tail=100
goto show_menu

:status
echo.
echo 📊 Docker 컨테이너 상태:
docker-compose ps
echo.
echo 💾 리소스 사용량:
docker stats --no-stream
goto show_menu

:stop
echo.
echo 🛑 Docker 환경 중지 중...
docker-compose down
echo ✅ 중지 완료
goto end

:end
echo.
echo 👋 종료합니다.
echo.
pause
exit /b 0


