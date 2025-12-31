@echo off
echo ====================================
echo Security Config 배포 스크립트
echo ====================================

echo.
echo [1/3] Git Add...
git add backend/src/main/java/com/goodee/coreconnect/security/config/SecurityConfig.java

echo.
echo [2/3] Git Commit...
git commit -m "fix: SecurityConfig에 정적 리소스 경로 추가 (401 에러 해결)

- /, /login, /*.html, /*.js, /*.css 등 정적 리소스 경로를 permitAll()에 추가
- 프론트엔드 정적 파일 접근 시 401 Unauthorized 에러 해결
- /static/**, /assets/** 경로 추가로 React 빌드 파일 서빙 가능"

echo.
echo [3/3] Git Push...
git push origin feature_scale-out-10-servers

echo.
echo ====================================
echo ✅ 배포 완료!
echo ====================================
echo.
echo 이제 EC2에서 다음 명령을 실행하세요:
echo.
echo cd /home/ubuntu/final_project_coreconnect
echo git pull origin feature_scale-out-10-servers
echo docker-compose build --no-cache chat-app-1
echo docker-compose up -d
echo.
pause

