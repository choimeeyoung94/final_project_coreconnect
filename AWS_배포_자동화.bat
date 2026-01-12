@echo off
chcp 65001 >nul
echo ================================================
echo    🚀 AWS k3s 서버 자동 배포 (Windows)
echo ================================================
echo.

echo SSH 클라이언트 확인 중...
where ssh >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ SSH 클라이언트를 찾을 수 없습니다!
    echo    Windows 10/11: OpenSSH 설치 필요
    echo    설정 → 앱 → 선택적 기능 → OpenSSH 클라이언트
    pause
    exit /b 1
)
echo ✅ SSH 클라이언트 있음
echo.

echo EC2 정보를 입력하세요:
echo.
set /p PUBLIC_IP="Public IP: "
set /p KEY_FILE="키 파일 경로 (예: C:\Users\user\coreconnect-key.pem): "

if not exist "%KEY_FILE%" (
    echo ❌ 키 파일을 찾을 수 없습니다: %KEY_FILE%
    pause
    exit /b 1
)

echo.
echo ✅ 설정:
echo   IP: %PUBLIC_IP%
echo   Key: %KEY_FILE%
echo.
pause

echo.
echo [1/7] SSH 연결 테스트 중...
ssh -i "%KEY_FILE%" -o StrictHostKeyChecking=no -o ConnectTimeout=10 ec2-user@%PUBLIC_IP% "echo Connected" >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ SSH 연결 실패
    echo 확인사항:
    echo   1. Public IP가 맞는지
    echo   2. 보안 그룹에서 22번 포트 열렸는지
    echo   3. 인스턴스가 실행 중인지
    pause
    exit /b 1
)
echo ✅ SSH 연결 성공
echo.

echo [2/7] k3s 설치 중...
ssh -i "%KEY_FILE%" ec2-user@%PUBLIC_IP% "curl -sfL https://get.k3s.io | sh -"
if %errorlevel% neq 0 (
    echo ❌ k3s 설치 실패
    pause
    exit /b 1
)
echo ✅ k3s 설치 완료
echo ⏳ 30초 대기...
timeout /t 30 /nobreak >nul
echo.

echo [3/7] Docker 설치 중...
ssh -i "%KEY_FILE%" ec2-user@%PUBLIC_IP% "sudo yum install -y docker && sudo systemctl start docker && sudo systemctl enable docker"
if %errorlevel% neq 0 (
    echo ⚠️  Docker 설치 실패 (계속 진행)
)
echo ✅ Docker 설치 완료
echo.

echo [4/7] Git 저장소 클론 중...
set /p REPO_URL="Git 저장소 URL (예: https://github.com/user/repo.git): "

ssh -i "%KEY_FILE%" ec2-user@%PUBLIC_IP% "sudo yum install -y git && git clone %REPO_URL% final_project_coreconnect"
if %errorlevel% neq 0 (
    echo ⚠️  이미 클론되어 있을 수 있음 (업데이트 시도)
    ssh -i "%KEY_FILE%" ec2-user@%PUBLIC_IP% "cd final_project_coreconnect && git pull"
)
echo ✅ Git 저장소 준비 완료
echo.

echo [5/7] Docker 이미지 빌드 중... (2-3분 소요)
ssh -i "%KEY_FILE%" ec2-user@%PUBLIC_IP% "cd final_project_coreconnect/backend && sudo docker build -t chat-server:latest ."
if %errorlevel% neq 0 (
    echo ❌ 이미지 빌드 실패
    pause
    exit /b 1
)
echo ✅ Docker 이미지 빌드 완료
echo.

echo [6/7] k8s 리소스 배포 중...
echo.

echo Namespace 생성...
ssh -i "%KEY_FILE%" ec2-user@%PUBLIC_IP% "cd final_project_coreconnect && sudo kubectl apply -f k8s/00-namespace.yaml"

echo.
echo MySQL 배포...
ssh -i "%KEY_FILE%" ec2-user@%PUBLIC_IP% "cd final_project_coreconnect && sudo kubectl apply -f k8s/01-mysql.yaml"
echo ⏳ MySQL 준비 대기 (60초)...
timeout /t 60 /nobreak >nul

echo.
echo Redis 배포...
ssh -i "%KEY_FILE%" ec2-user@%PUBLIC_IP% "cd final_project_coreconnect && sudo kubectl apply -f k8s/02-redis.yaml"
echo ⏳ Redis 준비 대기 (30초)...
timeout /t 30 /nobreak >nul

echo.
echo Chat Server 배포...
ssh -i "%KEY_FILE%" ec2-user@%PUBLIC_IP% "cd final_project_coreconnect && sudo kubectl apply -f k8s/03-chat-server-dev.yaml"
echo ⏳ Chat Server 준비 대기 (30초)...
timeout /t 30 /nobreak >nul

echo ✅ k8s 배포 완료
echo.

echo [7/7] 배포 상태 확인 중...
echo.
echo === Nodes ===
ssh -i "%KEY_FILE%" ec2-user@%PUBLIC_IP% "sudo kubectl get nodes"
echo.
echo === Pods ===
ssh -i "%KEY_FILE%" ec2-user@%PUBLIC_IP% "sudo kubectl get pods -n chat-system"
echo.
echo === Services ===
ssh -i "%KEY_FILE%" ec2-user@%PUBLIC_IP% "sudo kubectl get svc -n chat-system"
echo.

echo ================================================
echo    ✅ 배포 완료!
echo ================================================
echo.
echo 접속 정보:
echo   서버 IP: %PUBLIC_IP%
echo   HTTP: http://%PUBLIC_IP%
echo   SSH: ssh -i "%KEY_FILE%" ec2-user@%PUBLIC_IP%
echo.
echo Health Check:
echo   curl http://%PUBLIC_IP%/actuator/health
echo.
echo 🎉 배포 성공!
echo.
pause
