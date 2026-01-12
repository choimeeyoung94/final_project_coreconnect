@echo off
REM MySQL 설정 수정사항 Git 배포

echo ========================================
echo Git에 변경사항 추가 및 커밋
echo ========================================

cd C:\dev\final_project_coreconnect

git add backend/src/main/resources/application.properties
git commit -m "Fix: MySQL connection settings (mysql-container -> mysql-master, admin -> root)"
git push origin feature_scale-out-10-servers

echo.
echo ========================================
echo ✅ Git push 완료!
echo ========================================
echo.
echo 이제 EC2에서 다음 명령어를 실행하세요:
echo.
echo cd /home/ubuntu/final_project_coreconnect
echo git pull origin feature_scale-out-10-servers
echo docker-compose down
echo docker rmi -f chat-server:latest
echo docker-compose build --no-cache
echo docker-compose up -d --scale prometheus=0 --scale chat-prometheus=0
echo.
pause



























