@echo off
chcp 65001 >nul
echo ================================================
echo    🚀 기존 coreconnect 서버에 배포
echo ================================================
echo.

echo 사용할 서버를 선택하세요:
echo.
echo 1. coreconnect-k6-server (15.165.50.43) - t3.xlarge
echo 2. coreconnect-k6-server2 (3.38.28.172) - t3.2xlarge ⭐ 추천!
echo.
set /p choice="선택 (1 또는 2): "

if "%choice%"=="1" (
    set SERVER_IP=15.165.50.43
    set SERVER_NAME=coreconnect-k6-server
) else if "%choice%"=="2" (
    set SERVER_IP=3.38.28.172
    set SERVER_NAME=coreconnect-k6-server2
) else (
    echo ❌ 잘못된 선택입니다.
    pause
    exit /b 1
)

echo.
echo ✅ 선택된 서버: %SERVER_NAME% (%SERVER_IP%)
echo.

echo SSH 키 파일 경로를 입력하세요:
echo (예: C:\Users\user\Downloads\your-key.pem)
set /p KEY_FILE="키 파일: "

if not exist "%KEY_FILE%" (
    echo ❌ 키 파일을 찾을 수 없습니다: %KEY_FILE%
    pause
    exit /b 1
)

echo.
echo ================================================
echo    배포 시작!
echo ================================================
echo.

echo [1/6] SSH 연결 테스트...
ssh -i "%KEY_FILE%" -o StrictHostKeyChecking=no -o ConnectTimeout=10 ec2-user@%SERVER_IP% "echo Connected" >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ SSH 연결 실패
    echo.
    echo 확인사항:
    echo   1. 키 파일이 맞는지
    echo   2. 보안 그룹에서 내 IP의 22번 포트가 열렸는지
    echo.
    pause
    exit /b 1
)
echo ✅ SSH 연결 성공
echo.

echo [2/6] k3s 상태 확인...
ssh -i "%KEY_FILE%" ec2-user@%SERVER_IP% "sudo systemctl status k3s" >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  k3s가 설치되지 않았습니다.
    echo k3s를 설치하시겠습니까? (y/n)
    set /p install_k3s="선택: "
    if /i "%install_k3s%"=="y" (
        echo k3s 설치 중...
        ssh -i "%KEY_FILE%" ec2-user@%SERVER_IP% "curl -sfL https://get.k3s.io | sh -"
        timeout /t 30 /nobreak >nul
        echo ✅ k3s 설치 완료
    ) else (
        echo 배포 취소
        pause
        exit /b 1
    )
) else (
    echo ✅ k3s 실행 중
)
echo.

echo [3/6] 저장소 업데이트 확인...
ssh -i "%KEY_FILE%" ec2-user@%SERVER_IP% "test -d final_project_coreconnect" >nul 2>&1
if %errorlevel% neq 0 (
    echo 저장소가 없습니다. Git URL을 입력하세요:
    set /p REPO_URL="Git URL: "
    ssh -i "%KEY_FILE%" ec2-user@%SERVER_IP% "git clone !REPO_URL! final_project_coreconnect"
) else (
    echo 기존 저장소 업데이트 중...
    ssh -i "%KEY_FILE%" ec2-user@%SERVER_IP% "cd final_project_coreconnect && git pull"
)
echo ✅ 저장소 준비 완료
echo.

echo [4/6] Docker 이미지 빌드 중... (2-3분)
ssh -i "%KEY_FILE%" ec2-user@%SERVER_IP% "cd final_project_coreconnect/backend && sudo docker build -t chat-server:latest ."
if %errorlevel% neq 0 (
    echo ❌ 이미지 빌드 실패
    pause
    exit /b 1
)
echo ✅ 이미지 빌드 완료
echo.

echo [5/6] k8s 리소스 배포 중...
echo.

echo Namespace 생성...
ssh -i "%KEY_FILE%" ec2-user@%SERVER_IP% "cd final_project_coreconnect && sudo kubectl apply -f k8s/00-namespace.yaml"

echo MySQL 배포...
ssh -i "%KEY_FILE%" ec2-user@%SERVER_IP% "cd final_project_coreconnect && sudo kubectl apply -f k8s/01-mysql.yaml"
echo ⏳ 준비 대기 (60초)...
timeout /t 60 /nobreak >nul

echo Redis 배포...
ssh -i "%KEY_FILE%" ec2-user@%SERVER_IP% "cd final_project_coreconnect && sudo kubectl apply -f k8s/02-redis.yaml"
echo ⏳ 준비 대기 (30초)...
timeout /t 30 /nobreak >nul

echo Chat Server 배포...
ssh -i "%KEY_FILE%" ec2-user@%SERVER_IP% "cd final_project_coreconnect && sudo kubectl apply -f k8s/03-chat-server-dev.yaml"
echo ⏳ 준비 대기 (30초)...
timeout /t 30 /nobreak >nul

echo ✅ 배포 완료
echo.

echo [6/6] 상태 확인...
echo.
echo === Pods ===
ssh -i "%KEY_FILE%" ec2-user@%SERVER_IP% "sudo kubectl get pods -n chat-system"
echo.
echo === Services ===
ssh -i "%KEY_FILE%" ec2-user@%SERVER_IP% "sudo kubectl get svc -n chat-system"
echo.

echo ================================================
echo    ✅ 배포 완료!
echo ================================================
echo.
echo 접속 정보:
echo   서버: %SERVER_NAME%
echo   IP: %SERVER_IP%
echo   HTTP: http://%SERVER_IP%
echo.
echo Health Check:
echo   curl http://%SERVER_IP%/actuator/health
echo.
echo SSH 접속:
echo   ssh -i "%KEY_FILE%" ec2-user@%SERVER_IP%
echo.
echo Pod 확인:
echo   sudo kubectl get pods -n chat-system
echo.
echo 로그 확인:
echo   sudo kubectl logs -f <pod-name> -n chat-system
echo.
echo 🎉 배포 성공!
echo.
pause
