@echo off
REM CoreConnect 전체 성능 테스트 실행 스크립트 (Windows)

echo ==========================================
echo   CoreConnect 성능 테스트 시작
echo ==========================================
echo.

REM 환경 변수 설정 (필요시 수정)
if "%BASE_URL%"=="" set BASE_URL=http://localhost:8080
if "%WS_URL%"=="" set WS_URL=ws://localhost:8080

echo 테스트 대상: %BASE_URL%
echo.

REM 결과 디렉토리 생성
set TIMESTAMP=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set RESULTS_DIR=results\%TIMESTAMP%
mkdir "%RESULTS_DIR%" 2>nul

echo 결과 저장 경로: %RESULTS_DIR%
echo.

REM 1. 채팅 기능 테스트
echo ==========================================
echo   1/3 채팅 기능 테스트 시작...
echo ==========================================
k6 run --out json="%RESULTS_DIR%\chat-results.json" chat-test.js
echo.

REM 2. 알림 기능 테스트
echo ==========================================
echo   2/3 알림 기능 테스트 시작...
echo ==========================================
k6 run --out json="%RESULTS_DIR%\notification-results.json" notification-test.js
echo.

REM 3. 이메일 기능 테스트
echo ==========================================
echo   3/3 이메일 기능 테스트 시작...
echo ==========================================
k6 run --out json="%RESULTS_DIR%\email-results.json" email-test.js
echo.

REM 요약 결과 복사
copy chat-test-summary.json "%RESULTS_DIR%\" >nul 2>&1
copy notification-test-summary.json "%RESULTS_DIR%\" >nul 2>&1
copy email-test-summary.json "%RESULTS_DIR%\" >nul 2>&1

echo ==========================================
echo   모든 테스트 완료!
echo ==========================================
echo.
echo 결과 파일:
dir /b "%RESULTS_DIR%"
echo.
echo 테스트 결과를 확인하려면 다음 파일들을 열어보세요:
echo   - %RESULTS_DIR%\chat-results.json
echo   - %RESULTS_DIR%\notification-results.json
echo   - %RESULTS_DIR%\email-results.json
echo.

pause
