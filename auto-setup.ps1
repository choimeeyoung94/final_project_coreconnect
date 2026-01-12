# ======================================================================
# Kubernetes CI/CD Auto Setup Script
# ======================================================================

$ErrorActionPreference = "Continue"

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "   Kubernetes CI/CD 자동 설정 시작" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""

# 변수 설정
$CLUSTER_NAME = "chat-prod"
$AWS_REGION = "ap-northeast-2"
$NAMESPACE = "chat-system"
$REPO_OWNER = "choimeyoung94"
$REPO_NAME = "final_project_coreconnect"

# ======================================================================
# Step 1: EKS kubeconfig 설정
# ======================================================================
Write-Host "[1/5] EKS kubeconfig 설정 중..." -ForegroundColor Yellow
Write-Host ""

try {
    $result = aws eks update-kubeconfig --name $CLUSTER_NAME --region $AWS_REGION 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "SUCCESS: kubeconfig 설정 완료" -ForegroundColor Green
    } else {
        Write-Host "WARN: kubeconfig 설정 실패 (권한 문제일 수 있음)" -ForegroundColor Yellow
        Write-Host "INFO: 이후 단계는 계속 진행됩니다..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "ERROR: kubeconfig 설정 실패" -ForegroundColor Red
}

Write-Host ""

# ======================================================================
# Step 2: 클러스터 연결 확인
# ======================================================================
Write-Host "[2/5] Kubernetes 클러스터 연결 확인 중..." -ForegroundColor Yellow
Write-Host ""

try {
    $clusterInfo = kubectl cluster-info 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "SUCCESS: 클러스터 연결 성공" -ForegroundColor Green
        kubectl get nodes 2>&1
    } else {
        Write-Host "WARN: 클러스터 연결 실패" -ForegroundColor Yellow
        Write-Host "INFO: GitHub Actions는 별도 자격 증명을 사용하므로 계속 진행합니다..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "ERROR: kubectl 명령 실패" -ForegroundColor Red
}

Write-Host ""

# ======================================================================
# Step 3: Namespace 생성
# ======================================================================
Write-Host "[3/5] Namespace 생성 중..." -ForegroundColor Yellow
Write-Host ""

try {
    $namespaceCheck = kubectl get namespace $NAMESPACE 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "INFO: Namespace '$NAMESPACE'가 이미 존재합니다" -ForegroundColor Green
    } else {
        kubectl create namespace $NAMESPACE 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "SUCCESS: Namespace '$NAMESPACE' 생성 완료" -ForegroundColor Green
        } else {
            Write-Host "WARN: Namespace 생성 실패" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "ERROR: Namespace 작업 실패" -ForegroundColor Red
}

Write-Host ""

# ======================================================================
# Step 4: ECR 리포지토리 확인
# ======================================================================
Write-Host "[4/5] ECR 리포지토리 확인 중..." -ForegroundColor Yellow
Write-Host ""

$repositories = @("chat-service", "chat-frontend")
foreach ($repo in $repositories) {
    try {
        $ecrCheck = aws ecr describe-repositories --repository-names $repo --region $AWS_REGION 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "SUCCESS: ECR 리포지토리 '$repo' 존재 확인" -ForegroundColor Green
        } else {
            Write-Host "WARN: ECR 리포지토리 '$repo' 확인 실패 (권한 문제 또는 미생성)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "ERROR: ECR 확인 실패: $repo" -ForegroundColor Red
    }
}

Write-Host ""

# ======================================================================
# Step 5: GitHub Secrets 설정 안내
# ======================================================================
Write-Host "[5/5] GitHub Secrets 설정 필요" -ForegroundColor Yellow
Write-Host ""

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "   다음 GitHub Secrets를 수동으로 추가해야 합니다:" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. GitHub 저장소 접속:" -ForegroundColor White
Write-Host "   https://github.com/$REPO_OWNER/$REPO_NAME/settings/secrets/actions" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. 'New repository secret' 버튼 클릭" -ForegroundColor White
Write-Host ""
Write-Host "3. 다음 Secrets 추가:" -ForegroundColor White
Write-Host ""
Write-Host "   Secret 1:" -ForegroundColor Yellow
Write-Host "   Name:   EKS_CLUSTER_NAME" -ForegroundColor White
Write-Host "   Value:  $CLUSTER_NAME" -ForegroundColor Green
Write-Host ""
Write-Host "   Secret 2:" -ForegroundColor Yellow
Write-Host "   Name:   K8S_CLUSTER_TYPE" -ForegroundColor White
Write-Host "   Value:  EKS" -ForegroundColor Green
Write-Host ""

# ======================================================================
# 완료 및 다음 단계
# ======================================================================
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "   설정 완료!" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "다음 단계:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. 위의 GitHub Secrets 2개 추가 (가장 중요!)" -ForegroundColor White
Write-Host ""
Write-Host "2. 재배포 실행:" -ForegroundColor White
Write-Host "   git add ." -ForegroundColor Cyan
Write-Host "   git commit -m `"chore: Kubernetes CI/CD 설정 완료`"" -ForegroundColor Cyan
Write-Host "   git push origin main" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. GitHub Actions 확인:" -ForegroundColor White
Write-Host "   https://github.com/$REPO_OWNER/$REPO_NAME/actions" -ForegroundColor Cyan
Write-Host ""

# GitHub Secrets 설정 파일 생성
$secretsContent = @"
GitHub Secrets 설정값
=====================

추가할 Secrets:

Secret 1:
---------
Name: EKS_CLUSTER_NAME
Value: $CLUSTER_NAME

Secret 2:
---------
Name: K8S_CLUSTER_TYPE
Value: EKS

설정 위치:
---------
https://github.com/$REPO_OWNER/$REPO_NAME/settings/secrets/actions

설정 후 실행할 명령어:
--------------------
git add .
git commit -m "chore: Kubernetes CI/CD 설정 완료"
git push origin main
"@

$secretsContent | Out-File -FilePath "GITHUB_SECRETS_SETUP.txt" -Encoding UTF8

Write-Host "SUCCESS: 설정 정보가 'GITHUB_SECRETS_SETUP.txt' 파일에 저장되었습니다" -ForegroundColor Green
Write-Host ""

# 브라우저로 GitHub Secrets 페이지 열기
Write-Host "GitHub Secrets 페이지를 브라우저로 엽니다..." -ForegroundColor Yellow
Start-Process "https://github.com/$REPO_OWNER/$REPO_NAME/settings/secrets/actions"
Write-Host "SUCCESS: 브라우저에서 GitHub Secrets 페이지를 열었습니다" -ForegroundColor Green

Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "   완료! 위의 안내에 따라 GitHub Secrets를 추가해주세요" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Cyan
