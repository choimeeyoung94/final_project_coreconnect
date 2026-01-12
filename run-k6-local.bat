@echo off
echo ========================================
echo 채팅방 목록 N+1 부하 테스트 (로컬 실행)
echo ========================================
echo.

set BASE_URL=http://15.165.43.131:8080

echo 테스트 대상: %BASE_URL%
echo.
echo 테스트 시작...
echo.

k6 run chatroom-n1-test.js -e BASE_URL=%BASE_URL% --out json=result.json

echo.
echo ========================================
echo 테스트 완료!
echo 결과 파일: result.json
echo ========================================









