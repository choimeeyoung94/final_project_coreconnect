@echo off
REM ============================================
REM k6 로그인 부하 테스트 실행 스크립트 (Windows)
REM InfluxDB 출력 및 Grafana 연동 포함
REM ============================================

setlocal

REM 설정
if "%BASE_URL%"=="" set BASE_URL=http://3.38.28.172:8080
if "%GRAFANA_URL%"=="" set GRAFANA_URL=http://3.38.28.172:3000
if "%INFLUXDB_URL%"=="" set INFLUXDB_URL=http://localhost:8086
if "%INFLUXDB_DB%"=="" set INFLUXDB_DB=k6
if "%TEST_FILE%"=="" set TEST_FILE=simple-login-test-with-grafana.js
if "%VUS%"=="" set VUS=100
if "%DURATION%"=="" set DURATION=2m

echo ================================================================================
echo                      k6 부하 테스트 실행 스크립트
echo ================================================================================
echo.
echo 테스트 설정:
echo   - API 서버: %BASE_URL%
echo   - InfluxDB: %INFLUXDB_URL%/%INFLUXDB_DB%
echo   - Grafana: %GRAFANA_URL%
echo   - 가상 사용자: %VUS%
echo   - 테스트 기간: %DURATION%
echo   - 테스트 파일: %TEST_FILE%
echo.
echo ================================================================================
echo k6 테스트 시작...
echo ================================================================================
echo.
echo 실시간 모니터링:
echo   %GRAFANA_URL%/dashboards
echo.

REM k6 테스트 실행
k6 run ^
  --out influxdb=%INFLUXDB_URL%/%INFLUXDB_DB% ^
  --vus %VUS% ^
  --duration %DURATION% ^
  %TEST_FILE%

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================================================
    echo 테스트 완료!
    echo ================================================================================
    echo.
    echo 결과 확인:
    echo   Grafana 대시보드: %GRAFANA_URL%/dashboards
    echo   ^(대시보드에서 시간 범위를 'Last 15 minutes'로 설정하세요^)
    echo.
    echo ================================================================================
) else (
    echo.
    echo ================================================================================
    echo 테스트 실패!
    echo ================================================================================
    echo.
)

endlocal
