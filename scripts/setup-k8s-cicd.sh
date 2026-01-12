#!/bin/bash

###############################################################################
# Kubernetes CI/CD 자동 설정 스크립트
# 
# 이 스크립트는 Docker+EC2 기반 CI/CD를 Kubernetes로 전환하는 과정을 자동화합니다.
#
# 사용법: ./scripts/setup-k8s-cicd.sh
###############################################################################

set -e  # 에러 발생 시 즉시 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 헤더
echo "======================================================================"
echo "   Kubernetes CI/CD 자동 설정 스크립트"
echo "======================================================================"
echo ""

# Step 1: 사전 요구사항 확인
log_info "Step 1: 사전 요구사항 확인..."

if ! command -v kubectl &> /dev/null; then
    log_error "kubectl이 설치되어 있지 않습니다."
    log_info "설치 방법: https://kubernetes.io/docs/tasks/tools/"
    exit 1
fi
log_success "kubectl 설치 확인"

if ! command -v aws &> /dev/null; then
    log_warning "AWS CLI가 설치되어 있지 않습니다."
    log_info "ECR 사용 시 AWS CLI가 필요합니다."
else
    log_success "AWS CLI 설치 확인"
fi

# Step 2: 컨테이너 레지스트리 선택
echo ""
log_info "Step 2: 컨테이너 레지스트리 선택"
echo "1) AWS ECR (추천 - 프로덕션)"
echo "2) Docker Hub (추천 - 간단함)"
read -p "선택 (1 또는 2): " registry_choice

if [ "$registry_choice" = "1" ]; then
    REGISTRY_TYPE="ECR"
    read -p "AWS Region (기본: ap-northeast-2): " aws_region
    aws_region=${aws_region:-ap-northeast-2}
    
    read -p "ECR Repository 이름 (기본: chat-service): " ecr_repo
    ecr_repo=${ecr_repo:-chat-service}
    
    log_info "ECR 리포지토리 생성 중..."
    if aws ecr describe-repositories --repository-names "$ecr_repo" --region "$aws_region" &>/dev/null; then
        log_warning "ECR 리포지토리가 이미 존재합니다: $ecr_repo"
    else
        aws ecr create-repository \
            --repository-name "$ecr_repo" \
            --region "$aws_region" \
            --image-scanning-configuration scanOnPush=true
        log_success "ECR 리포지토리 생성 완료: $ecr_repo"
    fi
    
    # ECR URI 가져오기
    ECR_URI=$(aws ecr describe-repositories \
        --repository-names "$ecr_repo" \
        --region "$aws_region" \
        --query 'repositories[0].repositoryUri' \
        --output text)
    
    log_success "ECR URI: $ECR_URI"
    
elif [ "$registry_choice" = "2" ]; then
    REGISTRY_TYPE="DOCKERHUB"
    read -p "Docker Hub 사용자 이름: " dockerhub_username
    log_warning "Docker Hub Token이 필요합니다."
    log_info "생성 방법: https://hub.docker.com/ → Account Settings → Security"
else
    log_error "잘못된 선택입니다."
    exit 1
fi

# Step 3: Kubernetes 클러스터 타입 선택
echo ""
log_info "Step 3: Kubernetes 클러스터 타입 선택"
echo "1) AWS EKS (관리형)"
echo "2) k3s on EC2 (경량, 저렴)"
read -p "선택 (1 또는 2): " cluster_choice

if [ "$cluster_choice" = "1" ]; then
    CLUSTER_TYPE="EKS"
    read -p "EKS 클러스터 이름: " eks_cluster_name
    read -p "AWS Region (기본: ap-northeast-2): " aws_region
    aws_region=${aws_region:-ap-northeast-2}
    
    log_info "EKS kubeconfig 업데이트 중..."
    aws eks update-kubeconfig \
        --name "$eks_cluster_name" \
        --region "$aws_region"
    
elif [ "$cluster_choice" = "2" ]; then
    CLUSTER_TYPE="k3s"
    log_info "k3s 서버의 kubeconfig가 필요합니다."
    read -p "k3s 서버 Public IP: " k3s_ip
    read -p "SSH 키 파일 경로 (예: ~/.ssh/your-key.pem): " ssh_key_path
    
    log_info "k3s 서버에서 kubeconfig 가져오는 중..."
    ssh -i "$ssh_key_path" ec2-user@"$k3s_ip" "sudo cat /etc/rancher/k3s/k3s.yaml" > /tmp/k3s-config.yaml
    
    # server 주소를 Public IP로 변경
    sed -i.bak "s/127.0.0.1/$k3s_ip/g" /tmp/k3s-config.yaml
    
    # kubeconfig 설정
    export KUBECONFIG=/tmp/k3s-config.yaml
    log_success "kubeconfig 설정 완료"
    
else
    log_error "잘못된 선택입니다."
    exit 1
fi

# kubectl 연결 확인
log_info "Kubernetes 클러스터 연결 확인 중..."
if kubectl cluster-info &>/dev/null; then
    log_success "Kubernetes 클러스터 연결 성공"
    kubectl get nodes
else
    log_error "Kubernetes 클러스터에 연결할 수 없습니다."
    exit 1
fi

# Step 4: Namespace 생성
echo ""
log_info "Step 4: Namespace 생성"
NAMESPACE="chat-system"

if kubectl get namespace "$NAMESPACE" &>/dev/null; then
    log_warning "Namespace가 이미 존재합니다: $NAMESPACE"
else
    kubectl create namespace "$NAMESPACE"
    log_success "Namespace 생성 완료: $NAMESPACE"
fi

# Step 5: GitHub Secrets 가이드
echo ""
log_info "Step 5: GitHub Secrets 설정 가이드"
echo "======================================================================"
echo "다음 Secrets을 GitHub 저장소에 추가해야 합니다:"
echo ""
echo "기본 Secrets (유지):"
echo "  - AWS_ACCESS_KEY_ID"
echo "  - AWS_SECRET_ACCESS_KEY"
echo "  - MYSQL_HOST"
echo "  - MYSQL_PORT"
echo "  - MYSQL_DATABASE"
echo "  - MYSQL_USER"
echo "  - MYSQL_PASSWORD"
echo "  - JWT_SECRET_KEY"
echo "  - SENDGRID_API_KEY"
echo ""

if [ "$CLUSTER_TYPE" = "EKS" ]; then
    echo "Kubernetes Secrets (EKS):"
    echo "  - EKS_CLUSTER_NAME: $eks_cluster_name"
    echo "  - K8S_CLUSTER_TYPE: EKS"
elif [ "$CLUSTER_TYPE" = "k3s" ]; then
    echo "Kubernetes Secrets (k3s):"
    KUBECONFIG_BASE64=$(cat /tmp/k3s-config.yaml | base64 -w 0 2>/dev/null || cat /tmp/k3s-config.yaml | base64)
    echo "  - KUBECONFIG: $KUBECONFIG_BASE64"
    echo "  - K8S_CLUSTER_TYPE: k3s"
    
    # kubeconfig 파일로 저장
    echo "$KUBECONFIG_BASE64" > kubeconfig-base64.txt
    log_success "kubeconfig (base64) 저장됨: kubeconfig-base64.txt"
fi

if [ "$REGISTRY_TYPE" = "DOCKERHUB" ]; then
    echo ""
    echo "Docker Hub Secrets:"
    echo "  - DOCKERHUB_USERNAME: $dockerhub_username"
    echo "  - DOCKERHUB_TOKEN: (Docker Hub에서 생성한 Token)"
fi

echo ""
echo "GitHub 저장소 → Settings → Secrets and variables → Actions"
echo "======================================================================"

# Step 6: ConfigMap & Secret 생성
echo ""
read -p "ConfigMap과 Secret을 생성하시겠습니까? (y/n): " create_resources

if [ "$create_resources" = "y" ]; then
    log_info "Step 6: ConfigMap 및 Secret 생성"
    
    # ConfigMap 값 입력
    read -p "MySQL Host (예: rds-endpoint.amazonaws.com): " mysql_host
    read -p "MySQL Port (기본: 3306): " mysql_port
    mysql_port=${mysql_port:-3306}
    read -p "MySQL Database (기본: coreconnect): " mysql_db
    mysql_db=${mysql_db:-coreconnect}
    
    # ConfigMap 생성
    kubectl create configmap chat-config \
        --from-literal=DB_HOST="$mysql_host" \
        --from-literal=DB_PORT="$mysql_port" \
        --from-literal=DB_NAME="$mysql_db" \
        --from-literal=REDIS_HOST="redis-service.$NAMESPACE.svc.cluster.local" \
        --from-literal=REDIS_PORT="6379" \
        --from-literal=AWS_REGION="ap-northeast-2" \
        --from-literal=WEBSOCKET_ORIGINS="*" \
        --from-literal=JWT_EXPIRATION="86400000" \
        --namespace="$NAMESPACE" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    log_success "ConfigMap 생성 완료"
    
    # Secret 생성
    read -sp "MySQL Password: " mysql_password
    echo ""
    read -sp "JWT Secret Key: " jwt_secret
    echo ""
    
    kubectl create secret generic chat-secret \
        --from-literal=DB_USERNAME="admin" \
        --from-literal=DB_PASSWORD="$mysql_password" \
        --from-literal=JWT_SECRET="$jwt_secret" \
        --namespace="$NAMESPACE" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    log_success "Secret 생성 완료"
fi

# Step 7: 워크플로우 파일 안내
echo ""
log_info "Step 7: GitHub Actions 워크플로우 설정"
echo "======================================================================"
echo "새로운 워크플로우 파일이 생성되었습니다:"
echo "  .github/workflows/k8s-deploy.yml"
echo ""
echo "기존 워크플로우 파일 처리:"
echo "  옵션 1) 완전 교체: rm .github/workflows/cicd.yml"
echo "  옵션 2) 병행 운영: 둘 다 유지하고 branch 조건으로 분리"
echo "======================================================================"

# Step 8: 완료
echo ""
log_success "======================================================================"
log_success "설정 완료!"
log_success "======================================================================"
echo ""
echo "다음 단계:"
echo "  1. GitHub Secrets 설정 (위의 가이드 참고)"
echo "  2. MySQL/Redis 배포:"
echo "     kubectl apply -f k8s/01-mysql.yaml"
echo "     kubectl apply -f k8s/02-redis.yaml"
echo "  3. 애플리케이션 배포:"
echo "     kubectl apply -f k8s/deployment.yaml"
echo "     kubectl apply -f k8s/service.yaml"
echo "  4. GitHub에 코드 푸시하여 자동 배포 테스트"
echo ""
echo "배포 확인:"
echo "  kubectl get pods -n $NAMESPACE"
echo "  kubectl logs -f deployment/chat-service -n $NAMESPACE"
echo ""
echo "상세 가이드:"
echo "  - docs/KUBERNETES_CICD_MIGRATION_GUIDE.md"
echo "  - docs/CICD_변경사항_요약.md"
echo ""

log_success "완료!"
