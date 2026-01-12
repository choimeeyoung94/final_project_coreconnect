@echo off
chcp 65001 >nul
echo ================================================
echo   🚀 k8s 배포 자동화
echo ================================================
echo.

echo 배포 대상을 선택하세요:
echo.
echo 1. 로컬 Docker
echo 2. k3s-server2 (52.78.195.123)
echo 3. 새 k3s 서버
echo.
set /p choice="선택 (1-3): "

if "%choice%"=="1" goto deploy_local
if "%choice%"=="2" goto deploy_k3s_existing
if "%choice%"=="3" goto deploy_k3s_new

:deploy_local
echo.
echo ================================================
echo   🏠 로컬 Docker 배포
echo ================================================
echo.

echo [1/4] 이미지 빌드 중...
cd backend
docker build -t chat-server:latest .
cd ..
if %errorlevel% neq 0 (
    echo ❌ 빌드 실패
    pause
    exit /b 1
)
echo ✅ 이미지 빌드 완료

echo.
echo [2/4] 컨테이너 시작 중...
docker-compose up -d
if %errorlevel% neq 0 (
    echo ❌ 시작 실패
    pause
    exit /b 1
)
echo ✅ 컨테이너 시작됨

echo.
echo [3/4] 상태 확인 중...
docker-compose ps

echo.
echo [4/4] Health Check 대기 (30초)...
timeout /t 30 /nobreak >nul

echo.
echo ✅ 배포 완료!
echo.
echo 접속 정보:
echo   http://localhost
echo.
goto end

:deploy_k3s_existing
echo.
echo ================================================
echo   ☁️  k3s-server2 배포
echo ================================================
echo.

set K3S_IP=52.78.195.123

echo SSH 키 파일을 입력하세요 (예: C:\Users\user\.ssh\your-key.pem):
set /p SSH_KEY="키 파일 경로: "

if not exist "%SSH_KEY%" (
    echo ❌ 키 파일을 찾을 수 없습니다: %SSH_KEY%
    pause
    exit /b 1
)

echo.
echo [1/5] SSH 연결 테스트 중...
ssh -i "%SSH_KEY%" -o StrictHostKeyChecking=no ec2-user@%K3S_IP% "echo OK" >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ SSH 연결 실패
    echo    IP: %K3S_IP%
    echo    키: %SSH_KEY%
    pause
    exit /b 1
)
echo ✅ SSH 연결 성공

echo.
echo [2/5] k3s 상태 확인 중...
ssh -i "%SSH_KEY%" ec2-user@%K3S_IP% "sudo systemctl status k3s"
if %errorlevel% neq 0 (
    echo ⚠️  k3s가 실행 중이 아닙니다. 설치 중...
    ssh -i "%SSH_KEY%" ec2-user@%K3S_IP% "curl -sfL https://get.k3s.io | sh -"
    echo ✅ k3s 설치 완료
)

echo.
echo [3/5] 설정 파일 업로드 중...
scp -i "%SSH_KEY%" -r k8s ec2-user@%K3S_IP%:~/
if %errorlevel% neq 0 (
    echo ❌ 파일 업로드 실패
    pause
    exit /b 1
)
echo ✅ 파일 업로드 완료

echo.
echo [4/5] k8s 리소스 배포 중...
ssh -i "%SSH_KEY%" ec2-user@%K3S_IP% "sudo kubectl apply -f ~/k8s/"
if %errorlevel% neq 0 (
    echo ❌ 배포 실패
    pause
    exit /b 1
)
echo ✅ 배포 완료

echo.
echo [5/5] 상태 확인 중...
ssh -i "%SSH_KEY%" ec2-user@%K3S_IP% "sudo kubectl get pods -A"

echo.
echo ✅ k3s 배포 완료!
echo.
echo 접속 정보:
echo   IP: %K3S_IP%
echo   포트: 80 (LoadBalancer)
echo.
goto end

:deploy_k3s_new
echo.
echo ⚠️  새 k3s 서버 생성은 AWS Console에서 수동으로 진행하세요.
echo.
echo 단계:
echo   1. EC2 → 인스턴스 시작
echo   2. AMI: Amazon Linux 2
echo   3. 타입: t3.small (개발용) 또는 t3.medium
echo   4. 키 페어 선택
echo   5. 보안 그룹: 22, 80, 443, 6443 포트 오픈
echo   6. 시작
echo.
echo   7. SSH 접속:
echo      ssh -i your-key.pem ec2-user@<NEW_IP>
echo.
echo   8. k3s 설치:
echo      curl -sfL https://get.k3s.io ^| sh -
echo.
echo   9. 배포:
echo      git clone your-repo
echo      cd final_project_coreconnect
echo      sudo kubectl apply -f k8s/
echo.
pause
goto end

:end
echo.
echo ================================================
echo   🎉 완료!
echo ================================================
echo.
pause
exit /b 0
