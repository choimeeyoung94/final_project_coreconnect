@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
:: AWS EKS 빠른 설정 스크립트
:: 
:: 사용법: AWS_EKS_빠른_설정.bat
:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

echo ======================================================================
echo    AWS EKS 빠른 설정 스크립트
echo    클러스터: chat-prod
echo    리전: ap-northeast-2
echo ======================================================================
echo.

:: 사전 요구사항 확인
echo [INFO] 사전 요구사항 확인...
echo.

aws --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] AWS CLI가 설치되어 있지 않습니다.
    echo [INFO] 설치: https://aws.amazon.com/cli/
    pause
    exit /b 1
)
echo [SUCCESS] AWS CLI 설치 확인

kubectl version --client >nul 2>&1
if errorlevel 1 (
    echo [ERROR] kubectl이 설치되어 있지 않습니다.
    echo [INFO] 설치: https://kubernetes.io/docs/tasks/tools/
    pause
    exit /b 1
)
echo [SUCCESS] kubectl 설치 확인

echo.
echo ======================================================================
echo Step 1: AWS 자격 증명 확인
echo ======================================================================
echo.

aws sts get-caller-identity
if errorlevel 1 (
    echo [ERROR] AWS 자격 증명이 설정되어 있지 않습니다.
    echo [INFO] 실행: aws configure
    pause
    exit /b 1
)
echo [SUCCESS] AWS 자격 증명 확인 완료
echo.

:: EKS 클러스터 이름과 리전 설정
set CLUSTER_NAME=chat-prod
set AWS_REGION=ap-northeast-2
set NAMESPACE=chat-system

echo ======================================================================
echo Step 2: kubeconfig 설정
echo ======================================================================
echo.
echo EKS 클러스터: %CLUSTER_NAME%
echo 리전: %AWS_REGION%
echo.

aws eks update-kubeconfig --name %CLUSTER_NAME% --region %AWS_REGION%
if errorlevel 1 (
    echo [ERROR] kubeconfig 업데이트 실패
    echo [INFO] EKS 클러스터가 존재하고 접근 권한이 있는지 확인하세요
    pause
    exit /b 1
)
echo [SUCCESS] kubeconfig 업데이트 완료
echo.

:: 클러스터 접속 확인
echo [INFO] 클러스터 접속 확인 중...
kubectl cluster-info
if errorlevel 1 (
    echo [ERROR] 클러스터 접속 실패
    pause
    exit /b 1
)
echo.

kubectl get nodes
echo.
echo [SUCCESS] 클러스터 접속 성공!
echo.

echo ======================================================================
echo Step 3: ECR 리포지토리 생성
echo ======================================================================
echo.

echo [INFO] chat-service 리포지토리 확인/생성 중...
aws ecr describe-repositories --repository-names chat-service --region %AWS_REGION% >nul 2>&1
if errorlevel 1 (
    echo [INFO] chat-service 리포지토리 생성 중...
    aws ecr create-repository --repository-name chat-service --region %AWS_REGION% --image-scanning-configuration scanOnPush=true
    echo [SUCCESS] chat-service 리포지토리 생성 완료
) else (
    echo [INFO] chat-service 리포지토리가 이미 존재합니다
)
echo.

echo [INFO] chat-frontend 리포지토리 확인/생성 중...
aws ecr describe-repositories --repository-names chat-frontend --region %AWS_REGION% >nul 2>&1
if errorlevel 1 (
    echo [INFO] chat-frontend 리포지토리 생성 중...
    aws ecr create-repository --repository-name chat-frontend --region %AWS_REGION% --image-scanning-configuration scanOnPush=true
    echo [SUCCESS] chat-frontend 리포지토리 생성 완료
) else (
    echo [INFO] chat-frontend 리포지토리가 이미 존재합니다
)
echo.

echo ======================================================================
echo Step 4: Namespace 생성
echo ======================================================================
echo.

kubectl get namespace %NAMESPACE% >nul 2>&1
if errorlevel 1 (
    echo [INFO] Namespace 생성 중: %NAMESPACE%
    kubectl create namespace %NAMESPACE%
    echo [SUCCESS] Namespace 생성 완료
) else (
    echo [INFO] Namespace가 이미 존재합니다: %NAMESPACE%
)
echo.

echo ======================================================================
echo Step 5: ConfigMap 및 Secret 설정
echo ======================================================================
echo.
echo 이제 ConfigMap과 Secret을 생성해야 합니다.
echo.
set /p create_config="ConfigMap과 Secret을 지금 생성하시겠습니까? (y/n): "

if /i "%create_config%"=="y" (
    echo.
    echo [INFO] ConfigMap 생성 중...
    echo.
    
    set /p mysql_host="MySQL Host (RDS 엔드포인트): "
    set /p mysql_port="MySQL Port (기본: 3306): "
    if "!mysql_port!"=="" set mysql_port=3306
    set /p mysql_db="MySQL Database (기본: coreconnect): "
    if "!mysql_db!"=="" set mysql_db=coreconnect
    
    kubectl create configmap chat-config ^
        --from-literal=DB_HOST=!mysql_host! ^
        --from-literal=DB_PORT=!mysql_port! ^
        --from-literal=DB_NAME=!mysql_db! ^
        --from-literal=REDIS_HOST=redis-service.%NAMESPACE%.svc.cluster.local ^
        --from-literal=REDIS_PORT=6379 ^
        --from-literal=AWS_REGION=%AWS_REGION% ^
        --from-literal=WEBSOCKET_ORIGINS=* ^
        --from-literal=JWT_EXPIRATION=86400000 ^
        --from-literal=SECURITY_MODE=secure ^
        --from-literal=SPRING_JPA_HIBERNATE_DDL_AUTO=update ^
        --from-literal=CORS_ALLOWED_ORIGINS=http://localhost:3000 ^
        --namespace=%NAMESPACE% ^
        --dry-run=client -o yaml | kubectl apply -f -
    
    echo [SUCCESS] ConfigMap 생성 완료
    echo.
    
    echo [INFO] Secret 생성 중...
    echo.
    set /p mysql_user="MySQL Username: "
    set /p mysql_password="MySQL Password: "
    set /p jwt_secret="JWT Secret Key: "
    
    kubectl create secret generic chat-secret ^
        --from-literal=DB_USERNAME=!mysql_user! ^
        --from-literal=DB_PASSWORD=!mysql_password! ^
        --from-literal=JWT_SECRET=!jwt_secret! ^
        --from-literal=REDIS_PASSWORD= ^
        --namespace=%NAMESPACE% ^
        --dry-run=client -o yaml | kubectl apply -f -
    
    echo [SUCCESS] Secret 생성 완료
    echo.
)

echo ======================================================================
echo Step 6: 배포 상태 확인
echo ======================================================================
echo.

echo [INFO] 현재 리소스 확인:
echo.
echo --- Namespaces ---
kubectl get namespace
echo.
echo --- ConfigMaps (chat-system) ---
kubectl get configmap -n %NAMESPACE%
echo.
echo --- Secrets (chat-system) ---
kubectl get secret -n %NAMESPACE%
echo.
echo --- Pods (chat-system) ---
kubectl get pods -n %NAMESPACE%
echo.
echo --- Services (chat-system) ---
kubectl get svc -n %NAMESPACE%
echo.

echo ======================================================================
echo 설정 완료!
echo ======================================================================
echo.
echo 다음 단계:
echo.
echo 1. GitHub Secrets 설정:
echo    - GitHub → Settings → Secrets and variables → Actions
echo    - EKS_CLUSTER_NAME: %CLUSTER_NAME%
echo    - K8S_CLUSTER_TYPE: EKS
echo    - AWS_REGION: %AWS_REGION%
echo.
echo 2. MySQL/Redis 배포 (필요시):
echo    kubectl apply -f k8s\01-mysql.yaml
echo    kubectl apply -f k8s\02-redis.yaml
echo.
echo 3. 애플리케이션 배포 (최초 1회):
echo    kubectl apply -f k8s\deployment.yaml
echo    kubectl apply -f k8s\service.yaml
echo.
echo 4. GitHub에 코드 푸시:
echo    git add .
echo    git commit -m "feat: EKS CI/CD 설정 완료"
echo    git push origin main
echo.
echo 5. 배포 확인:
echo    kubectl get pods -n %NAMESPACE%
echo    kubectl logs -f deployment/chat-service -n %NAMESPACE%
echo.
echo ======================================================================
echo.
pause
