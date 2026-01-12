@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
:: Kubernetes CI/CD 자동 설정 스크립트 (Windows)
:: 
:: 이 스크립트는 Docker+EC2 기반 CI/CD를 Kubernetes로 전환하는 과정을 안내합니다.
::
:: 사용법: scripts\setup-k8s-cicd.bat
:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

echo ======================================================================
echo    Kubernetes CI/CD 자동 설정 스크립트
echo ======================================================================
echo.

:: Step 1: 사전 요구사항 확인
echo [INFO] Step 1: 사전 요구사항 확인...

kubectl version --client >nul 2>&1
if errorlevel 1 (
    echo [ERROR] kubectl이 설치되어 있지 않습니다.
    echo [INFO] 설치 방법: https://kubernetes.io/docs/tasks/tools/
    pause
    exit /b 1
)
echo [SUCCESS] kubectl 설치 확인

aws --version >nul 2>&1
if errorlevel 1 (
    echo [WARNING] AWS CLI가 설치되어 있지 않습니다.
    echo [INFO] ECR 사용 시 AWS CLI가 필요합니다.
) else (
    echo [SUCCESS] AWS CLI 설치 확인
)

:: Step 2: 컨테이너 레지스트리 선택
echo.
echo [INFO] Step 2: 컨테이너 레지스트리 선택
echo 1) AWS ECR (추천 - 프로덕션)
echo 2) Docker Hub (추천 - 간단함)
set /p registry_choice="선택 (1 또는 2): "

if "%registry_choice%"=="1" (
    set REGISTRY_TYPE=ECR
    set /p aws_region="AWS Region (기본: ap-northeast-2): "
    if "!aws_region!"=="" set aws_region=ap-northeast-2
    
    set /p ecr_repo="ECR Repository 이름 (기본: chat-service): "
    if "!ecr_repo!"=="" set ecr_repo=chat-service
    
    echo [INFO] ECR 리포지토리 확인 중...
    aws ecr describe-repositories --repository-names !ecr_repo! --region !aws_region! >nul 2>&1
    if errorlevel 1 (
        echo [INFO] ECR 리포지토리 생성 중...
        aws ecr create-repository --repository-name !ecr_repo! --region !aws_region! --image-scanning-configuration scanOnPush=true
        echo [SUCCESS] ECR 리포지토리 생성 완료
    ) else (
        echo [WARNING] ECR 리포지토리가 이미 존재합니다
    )
    
) else if "%registry_choice%"=="2" (
    set REGISTRY_TYPE=DOCKERHUB
    set /p dockerhub_username="Docker Hub 사용자 이름: "
    echo [WARNING] Docker Hub Token이 필요합니다.
    echo [INFO] 생성 방법: https://hub.docker.com/ → Account Settings → Security
) else (
    echo [ERROR] 잘못된 선택입니다.
    pause
    exit /b 1
)

:: Step 3: Kubernetes 클러스터 타입 선택
echo.
echo [INFO] Step 3: Kubernetes 클러스터 타입 선택
echo 1) AWS EKS (관리형)
echo 2) k3s on EC2 (경량, 저렴)
set /p cluster_choice="선택 (1 또는 2): "

if "%cluster_choice%"=="1" (
    set CLUSTER_TYPE=EKS
    set /p eks_cluster_name="EKS 클러스터 이름: "
    set /p aws_region="AWS Region (기본: ap-northeast-2): "
    if "!aws_region!"=="" set aws_region=ap-northeast-2
    
    echo [INFO] EKS kubeconfig 업데이트 중...
    aws eks update-kubeconfig --name !eks_cluster_name! --region !aws_region!
    
) else if "%cluster_choice%"=="2" (
    set CLUSTER_TYPE=k3s
    echo [INFO] k3s 서버의 kubeconfig가 필요합니다.
    echo [INFO] PowerShell이나 WSL에서 다음 명령어를 실행하세요:
    echo.
    echo     ssh -i your-key.pem ec2-user@YOUR_IP "sudo cat /etc/rancher/k3s/k3s.yaml" ^> k3s-config.yaml
    echo.
    echo     그리고 k3s-config.yaml 파일에서 127.0.0.1을 서버의 Public IP로 변경하세요
    echo.
    set /p kubeconfig_path="kubeconfig 파일 경로 (예: k3s-config.yaml): "
    
    if exist "!kubeconfig_path!" (
        set KUBECONFIG=!kubeconfig_path!
        echo [SUCCESS] kubeconfig 설정 완료
    ) else (
        echo [ERROR] 파일을 찾을 수 없습니다: !kubeconfig_path!
        pause
        exit /b 1
    )
) else (
    echo [ERROR] 잘못된 선택입니다.
    pause
    exit /b 1
)

:: kubectl 연결 확인
echo [INFO] Kubernetes 클러스터 연결 확인 중...
kubectl cluster-info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Kubernetes 클러스터에 연결할 수 없습니다.
    pause
    exit /b 1
)
echo [SUCCESS] Kubernetes 클러스터 연결 성공
kubectl get nodes

:: Step 4: Namespace 생성
echo.
echo [INFO] Step 4: Namespace 생성
set NAMESPACE=chat-system

kubectl get namespace %NAMESPACE% >nul 2>&1
if errorlevel 1 (
    kubectl create namespace %NAMESPACE%
    echo [SUCCESS] Namespace 생성 완료: %NAMESPACE%
) else (
    echo [WARNING] Namespace가 이미 존재합니다: %NAMESPACE%
)

:: Step 5: GitHub Secrets 가이드
echo.
echo [INFO] Step 5: GitHub Secrets 설정 가이드
echo ======================================================================
echo 다음 Secrets을 GitHub 저장소에 추가해야 합니다:
echo.
echo 기본 Secrets (유지):
echo   - AWS_ACCESS_KEY_ID
echo   - AWS_SECRET_ACCESS_KEY
echo   - MYSQL_HOST
echo   - MYSQL_PORT
echo   - MYSQL_DATABASE
echo   - MYSQL_USER
echo   - MYSQL_PASSWORD
echo   - JWT_SECRET_KEY
echo   - SENDGRID_API_KEY
echo.

if "%CLUSTER_TYPE%"=="EKS" (
    echo Kubernetes Secrets (EKS):
    echo   - EKS_CLUSTER_NAME: %eks_cluster_name%
    echo   - K8S_CLUSTER_TYPE: EKS
) else if "%CLUSTER_TYPE%"=="k3s" (
    echo Kubernetes Secrets (k3s):
    echo.
    echo KUBECONFIG Secret을 생성하려면 PowerShell에서:
    echo     [Convert]::ToBase64String([IO.File]::ReadAllBytes("k3s-config.yaml"))
    echo.
    echo   - KUBECONFIG: (위 명령어의 출력 결과)
    echo   - K8S_CLUSTER_TYPE: k3s
)

if "%REGISTRY_TYPE%"=="DOCKERHUB" (
    echo.
    echo Docker Hub Secrets:
    echo   - DOCKERHUB_USERNAME: %dockerhub_username%
    echo   - DOCKERHUB_TOKEN: (Docker Hub에서 생성한 Token)
)

echo.
echo GitHub 저장소 → Settings → Secrets and variables → Actions
echo ======================================================================

:: Step 6: ConfigMap & Secret 생성
echo.
set /p create_resources="ConfigMap과 Secret을 생성하시겠습니까? (y/n): "

if /i "%create_resources%"=="y" (
    echo [INFO] Step 6: ConfigMap 및 Secret 생성
    
    set /p mysql_host="MySQL Host (예: rds-endpoint.amazonaws.com): "
    set /p mysql_port="MySQL Port (기본: 3306): "
    if "!mysql_port!"=="" set mysql_port=3306
    set /p mysql_db="MySQL Database (기본: coreconnect): "
    if "!mysql_db!"=="" set mysql_db=coreconnect
    
    echo [INFO] ConfigMap 생성 중...
    kubectl create configmap chat-config ^
        --from-literal=DB_HOST=!mysql_host! ^
        --from-literal=DB_PORT=!mysql_port! ^
        --from-literal=DB_NAME=!mysql_db! ^
        --from-literal=REDIS_HOST=redis-service.%NAMESPACE%.svc.cluster.local ^
        --from-literal=REDIS_PORT=6379 ^
        --from-literal=AWS_REGION=ap-northeast-2 ^
        --from-literal=WEBSOCKET_ORIGINS=* ^
        --from-literal=JWT_EXPIRATION=86400000 ^
        --namespace=%NAMESPACE% ^
        --dry-run=client -o yaml | kubectl apply -f -
    
    echo [SUCCESS] ConfigMap 생성 완료
    
    set /p mysql_password="MySQL Password: "
    set /p jwt_secret="JWT Secret Key: "
    
    echo [INFO] Secret 생성 중...
    kubectl create secret generic chat-secret ^
        --from-literal=DB_USERNAME=admin ^
        --from-literal=DB_PASSWORD=!mysql_password! ^
        --from-literal=JWT_SECRET=!jwt_secret! ^
        --namespace=%NAMESPACE% ^
        --dry-run=client -o yaml | kubectl apply -f -
    
    echo [SUCCESS] Secret 생성 완료
)

:: Step 7: 워크플로우 파일 안내
echo.
echo [INFO] Step 7: GitHub Actions 워크플로우 설정
echo ======================================================================
echo 새로운 워크플로우 파일이 생성되었습니다:
echo   .github\workflows\k8s-deploy.yml
echo.
echo 기존 워크플로우 파일 처리:
echo   옵션 1) 완전 교체: del .github\workflows\cicd.yml
echo   옵션 2) 병행 운영: 둘 다 유지하고 branch 조건으로 분리
echo ======================================================================

:: Step 8: 완료
echo.
echo ======================================================================
echo [SUCCESS] 설정 완료!
echo ======================================================================
echo.
echo 다음 단계:
echo   1. GitHub Secrets 설정 (위의 가이드 참고)
echo   2. MySQL/Redis 배포:
echo      kubectl apply -f k8s\01-mysql.yaml
echo      kubectl apply -f k8s\02-redis.yaml
echo   3. 애플리케이션 배포:
echo      kubectl apply -f k8s\deployment.yaml
echo      kubectl apply -f k8s\service.yaml
echo   4. GitHub에 코드 푸시하여 자동 배포 테스트
echo.
echo 배포 확인:
echo   kubectl get pods -n %NAMESPACE%
echo   kubectl logs -f deployment/chat-service -n %NAMESPACE%
echo.
echo 상세 가이드:
echo   - docs\KUBERNETES_CICD_MIGRATION_GUIDE.md
echo   - docs\CICD_변경사항_요약.md
echo.
echo [SUCCESS] 완료!
echo.
pause
