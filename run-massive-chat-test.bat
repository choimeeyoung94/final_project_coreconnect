@echo off
REM ============================================================
REM K6 대규모 채팅 부하 테스트 실행 스크립트 (Windows)
REM ============================================================

echo ========================================
echo K6 대규모 채팅 부하 테스트 시작
echo ========================================
echo.

REM 환경 변수 설정
set BASE_URL=http://localhost:8080
set WS_URL=ws://localhost:8080
set TEST_ROOM_ID=1
set TOTAL_USERS=100000
set RAMP_UP_TIME=5m
set STEADY_TIME=10m
set RAMP_DOWN_TIME=2m

REM 사용자 입력 받기
echo 테스트 설정:
echo 1. 기본 설정 (10만명, 5분 램프업)
echo 2. 중간 부하 (1만명, 2분 램프업) - 테스트용
echo 3. 소규모 테스트 (1000명, 1분 램프업) - 로컬 테스트용
echo 4. 사용자 정의
echo.
set /p choice="선택 (1-4): "

if "%choice%"=="1" (
    echo.
    echo [선택] 대규모 부하 테스트 - 10만명 동시 접속
    set TOTAL_USERS=100000
    set RAMP_UP_TIME=5m
    set STEADY_TIME=10m
    set RAMP_DOWN_TIME=2m
) else if "%choice%"=="2" (
    echo.
    echo [선택] 중간 부하 테스트 - 1만명 동시 접속
    set TOTAL_USERS=10000
    set RAMP_UP_TIME=2m
    set STEADY_TIME=5m
    set RAMP_DOWN_TIME=1m
) else if "%choice%"=="3" (
    echo.
    echo [선택] 소규모 테스트 - 1000명 동시 접속
    set TOTAL_USERS=1000
    set RAMP_UP_TIME=1m
    set STEADY_TIME=3m
    set RAMP_DOWN_TIME=30s
) else if "%choice%"=="4" (
    echo.
    set /p TOTAL_USERS="동시 접속 사용자 수: "
    set /p RAMP_UP_TIME="램프업 시간 (예: 5m): "
    set /p STEADY_TIME="유지 시간 (예: 10m): "
    set /p RAMP_DOWN_TIME="램프다운 시간 (예: 2m): "
) else (
    echo 잘못된 선택입니다. 기본 설정을 사용합니다.
)

echo.
echo ========================================
echo 테스트 구성:
echo ----------------------------------------
echo BASE_URL: %BASE_URL%
echo WS_URL: %WS_URL%
echo TEST_ROOM_ID: %TEST_ROOM_ID%
echo TOTAL_USERS: %TOTAL_USERS%
echo RAMP_UP_TIME: %RAMP_UP_TIME%
echo STEADY_TIME: %STEADY_TIME%
echo RAMP_DOWN_TIME: %RAMP_DOWN_TIME%
echo ========================================
echo.

REM 모니터링 환경 확인
echo [1/4] 모니터링 환경 확인 중...
docker ps | findstr "k6-influxdb" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ⚠️  InfluxDB가 실행 중이 아닙니다.
    echo 모니터링 환경을 시작하시겠습니까? (Y/N^)
    set /p start_monitoring=""
    if /i "%start_monitoring%"=="Y" (
        echo.
        echo 모니터링 환경 시작 중...
        docker-compose -f docker-compose.monitoring.yml up -d
        echo.
        echo ⏳ 모니터링 환경 초기화 대기 중 (30초)...
        timeout /t 30 /nobreak >nul
    ) else (
        echo.
        echo ⚠️  모니터링 없이 테스트를 진행합니다.
    )
) else (
    echo ✅ 모니터링 환경이 실행 중입니다.
)

echo.
echo [2/4] 백엔드 서버 상태 확인 중...
curl -s -o nul -w "%%{http_code}" http://localhost:8080/api/health >temp_status.txt 2>nul
set /p STATUS=<temp_status.txt
del temp_status.txt 2>nul

if "%STATUS%"=="200" (
    echo ✅ 백엔드 서버가 정상 실행 중입니다.
) else (
    echo ❌ 백엔드 서버에 연결할 수 없습니다.
    echo 서버를 먼저 시작해주세요.
    pause
    exit /b 1
)

echo.
echo [3/4] 테스트 사용자 준비 확인...
echo ⚠️  테스트를 시작하기 전에 DB에 테스트 사용자가 준비되어 있는지 확인하세요.
echo    - testuser1@test.com ~ testuser%TOTAL_USERS%@test.com
echo    - 비밀번호: Test1234!
echo.
echo 계속하시겠습니까? (Y/N^)
set /p continue=""
if /i not "%continue%"=="Y" (
    echo 테스트를 취소합니다.
    exit /b 0
)

echo.
echo [4/4] K6 부하 테스트 시작...
echo.
echo 📊 Grafana 대시보드: http://localhost:3000
echo    - 대시보드: "K6 - 10만명 동시 접속 채팅 부하 테스트"
echo    - 로그인: admin / admin123
echo.

REM K6 테스트 실행
k6 run ^
  --out influxdb=http://localhost:8086/k6 ^
  -e BASE_URL=%BASE_URL% ^
  -e WS_URL=%WS_URL% ^
  -e TEST_ROOM_ID=%TEST_ROOM_ID% ^
  -e TOTAL_USERS=%TOTAL_USERS% ^
  -e RAMP_UP_TIME=%RAMP_UP_TIME% ^
  -e STEADY_TIME=%STEADY_TIME% ^
  -e RAMP_DOWN_TIME=%RAMP_DOWN_TIME% ^
  performance-tests\massive-chat-load-test.js

echo.
echo ========================================
echo 테스트 완료!
echo ========================================
echo.
echo 📊 결과 확인:
echo 1. Grafana 대시보드: http://localhost:3000
echo 2. 생성된 리포트 파일:
echo    - summary.json
echo    - summary.html
echo.

REM HTML 리포트 열기
if exist summary.html (
    echo HTML 리포트를 여시겠습니까? (Y/N^)
    set /p open_report=""
    if /i "%open_report%"=="Y" (
        start summary.html
    )
)

pause

