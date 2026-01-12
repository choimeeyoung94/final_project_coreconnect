@echo off
REM ========================================
REM 채팅방 목록 조회 N+1 문제 성능 측정 스크립트 (Windows)
REM ========================================

echo ==========================================
echo 📊 채팅방 목록 조회 N+1 문제 성능 측정
echo ==========================================
echo.

REM 환경 변수 설정
if "%BASE_URL%"=="" set BASE_URL=http://54.116.26.182:8080
if "%WS_URL%"=="" set WS_URL=ws://54.116.26.182:8080

REM 테스트 타입 선택
set TEST_TYPE=%1
if "%TEST_TYPE%"=="" set TEST_TYPE=cloud

if "%TEST_TYPE%"=="cloud" (
  echo 🌩️  K6 Cloud로 테스트 실행
  echo    - Grafana 대시보드 자동 생성
  echo    - 실시간 성능 모니터링
  echo    - 테스트 결과 URL 자동 출력
  echo.
  
  REM K6 Cloud 토큰 확인
  if "%K6_CLOUD_TOKEN%"=="" (
    echo ⚠️  K6_CLOUD_TOKEN 환경 변수가 설정되지 않았습니다.
    echo    다음 명령어로 설정하세요:
    echo    set K6_CLOUD_TOKEN=your-token-here
    echo.
    exit /b 1
  )
  
  echo ✅ K6 Cloud 토큰 확인 완료
  echo.
  echo 🚀 테스트 시작...
  echo.
  
  k6 cloud chatroom-list-n-plus-1-test.js -e BASE_URL=%BASE_URL% -e WS_URL=%WS_URL%
  
) else if "%TEST_TYPE%"=="local" (
  echo 💻 로컬에서 테스트 실행
  echo    - 로컬 머신에서 부하 생성
  echo    - JSON 결과 파일 생성
  echo.
  
  k6 run chatroom-list-n-plus-1-test.js -e BASE_URL=%BASE_URL% -e WS_URL=%WS_URL% --out json=chatroom-list-test-result.json
  
  echo.
  echo ✅ 테스트 완료!
  echo    결과 파일: chatroom-list-test-result.json
  echo.
  
) else if "%TEST_TYPE%"=="html" (
  echo 📄 HTML 리포트 생성 모드
  echo    - 로컬에서 테스트 실행
  echo    - HTML 리포트 자동 생성
  echo.
  
  k6 run chatroom-list-n-plus-1-test.js -e BASE_URL=%BASE_URL% -e WS_URL=%WS_URL% --out json=chatroom-list-test-result.json
  
  echo.
  echo ⚠️  HTML 리포트 자동 생성은 Linux/Mac에서만 지원됩니다.
  echo    chatroom-list-test-result.json 파일을 수동으로 변환하세요.
  echo.
  
) else (
  echo ❌ 잘못된 테스트 타입: %TEST_TYPE%
  echo.
  echo 사용법:
  echo   run-chatroom-list-test.bat [cloud^|local^|html]
  echo.
  echo 예시:
  echo   run-chatroom-list-test.bat cloud   # K6 Cloud로 실행
  echo   run-chatroom-list-test.bat local   # 로컬에서 실행
  echo   run-chatroom-list-test.bat html    # HTML 리포트 생성
  exit /b 1
)

echo.
echo ==========================================
echo ✅ 완료!
echo ==========================================










