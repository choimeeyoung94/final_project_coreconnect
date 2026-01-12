@echo off
echo Docker Desktop 시작 중...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
echo.
echo ⏳ Docker가 시작될 때까지 30초 대기 중...
timeout /t 30 /nobreak
echo.
echo ✅ 준비 완료!
pause
