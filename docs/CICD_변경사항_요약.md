# 🔄 CI/CD 변경사항 요약 (Docker+EC2 → Kubernetes)

## 📌 핵심 변경 사항 한눈에 보기

### 1. GitHub Actions 워크플로우 파일

| 항목 | 기존 (Docker+EC2) | 신규 (Kubernetes) |
|-----|------------------|------------------|
| 파일 경로 | `.github/workflows/cicd.yml` | `.github/workflows/k8s-deploy.yml` |
| 이미지 저장소 | Docker Compose (로컬 빌드) | ECR / Docker Hub |
| 배포 방식 | SCP + SSH | kubectl |
| 배포 시간 | 5-10분 | 2-3분 |
| 무중단 배포 | ❌ | ✅ |

---

## 🔧 수정해야 할 파일

### 변경 1: GitHub Actions 워크플로우

**기존 파일:**
```
.github/workflows/cicd.yml
```

**처리 방법:**
```bash
# 옵션 A: 완전히 교체
rm .github/workflows/cicd.yml
mv .github/workflows/k8s-deploy.yml .github/workflows/cicd.yml

# 옵션 B: 병행 운영 (기존 유지 + 새로운 파일 추가)
# 둘 다 유지하고 branch 조건으로 분리
```

### 변경 2: 워크플로우 내부 주요 차이점

#### 기존 (cicd.yml) - EC2 배포:
```yaml
deploy:
  steps:
    # EC2로 파일 전송
    - name: Copy file to EC2
      uses: appleboy/scp-action@v1
      
    # SSH로 Docker Compose 실행
    - name: Deploy with Docker Compose
      uses: appleboy/ssh-action@v1
      script: |
        docker compose down
        docker compose up --build -d
```

#### 신규 (k8s-deploy.yml) - Kubernetes 배포:
```yaml
build-and-push:
  steps:
    # Docker 이미지 빌드 및 ECR 푸시
    - name: Build and push
      run: |
        docker build -t $ECR_REGISTRY/chat-service:$TAG .
        docker push $ECR_REGISTRY/chat-service:$TAG

deploy-to-k8s:
  steps:
    # kubectl로 배포
    - name: Update Deployment
      run: |
        kubectl set image deployment/chat-service \
          chat-service=$IMAGE -n chat-system
```

---

## 🔐 GitHub Secrets 변경사항

### 기존 Secrets (유지)
```
✅ AWS_ACCESS_KEY_ID
✅ AWS_SECRET_ACCESS_KEY
✅ MYSQL_HOST
✅ MYSQL_PORT
✅ MYSQL_DATABASE
✅ MYSQL_USER
✅ MYSQL_PASSWORD
✅ JWT_SECRET_KEY
✅ SENDGRID_API_KEY
✅ CORS_ALLOWED_ORIGINS
✅ WEBSOCKET_ALLOWED_ORIGINS
✅ ALLOWED_ORIGIN
```

### 제거할 Secrets
```
❌ EC2_HOST          (더 이상 EC2 SSH 사용 안 함)
❌ EC2_USER          (더 이상 EC2 SSH 사용 안 함)
❌ EC2_SSH_KEY       (더 이상 EC2 SSH 사용 안 함)
```

### 새로 추가할 Secrets

**Kubernetes 클러스터 정보:**

**EKS 사용 시:**
```
✨ EKS_CLUSTER_NAME: "chat-cluster"
✨ K8S_CLUSTER_TYPE: "EKS"
```

**k3s (EC2) 사용 시:**
```
✨ KUBECONFIG: "<base64로 인코딩된 kubeconfig>"
✨ K8S_CLUSTER_TYPE: "k3s"
```

**kubeconfig 생성 방법:**
```bash
# k3s 서버에서 kubeconfig 가져오기
sudo cat /etc/rancher/k3s/k3s.yaml > k3s-config.yaml

# server 주소를 Public IP로 변경
sed -i 's/127.0.0.1/<PUBLIC_IP>/g' k3s-config.yaml

# Base64 인코딩
cat k3s-config.yaml | base64 -w 0

# 출력된 값을 GitHub Secrets의 KUBECONFIG에 저장
```

---

## 📝 워크플로우 파일 수정 포인트

### 1. 컨테이너 레지스트리 선택

#### ECR 사용 (기본값):
```yaml
# .github/workflows/k8s-deploy.yml
env:
  AWS_REGION: ap-northeast-2
  ECR_REPOSITORY_BACKEND: chat-service  # ← ECR 리포지토리 이름

steps:
  - name: Login to Amazon ECR
    uses: aws-actions/amazon-ecr-login@v2
```

**사전 작업:**
```bash
# ECR 리포지토리 생성
aws ecr create-repository \
  --repository-name chat-service \
  --region ap-northeast-2
```

#### Docker Hub 사용 시:
```yaml
# .github/workflows/k8s-deploy.yml 수정

# ECR 로그인 부분 삭제하고 아래로 교체:
steps:
  - name: Login to Docker Hub
    uses: docker/login-action@v3
    with:
      username: ${{ secrets.DOCKERHUB_USERNAME }}
      password: ${{ secrets.DOCKERHUB_TOKEN }}
  
  # 이미지 경로도 수정
  - name: Build and push Backend
    run: |
      IMAGE_URI=your-dockerhub-id/chat-service:$IMAGE_TAG  # ← 수정
      docker build -t $IMAGE_URI .
      docker push $IMAGE_URI
```

**GitHub Secrets 추가:**
```
DOCKERHUB_USERNAME: your-dockerhub-id
DOCKERHUB_TOKEN: dckr_pat_xxxxxxxxxxxxx
```

### 2. Kubernetes 클러스터 타입 선택

워크플로우는 자동으로 `K8S_CLUSTER_TYPE` Secret을 보고 결정합니다:

```yaml
# EKS 사용 시 자동 실행
- name: Update kubeconfig for EKS
  if: ${{ secrets.K8S_CLUSTER_TYPE == 'EKS' }}
  run: aws eks update-kubeconfig --name ${{ secrets.EKS_CLUSTER_NAME }}

# k3s 사용 시 자동 실행
- name: Setup kubeconfig for k3s
  if: ${{ secrets.K8S_CLUSTER_TYPE != 'EKS' }}
  run: echo "${{ secrets.KUBECONFIG }}" | base64 -d > ~/.kube/config
```

**설정만 하면 자동 처리됨!**

---

## 🚀 배포 프로세스 비교

### 기존 방식 (Docker + EC2)
```
1. GitHub에 Push
   ↓
2. GitHub Actions 시작
   ↓
3. Backend/Frontend 빌드
   ↓
4. docker-compose.yml 검증
   ↓
5. SCP로 모든 파일을 EC2에 전송 (느림)
   ↓
6. SSH로 EC2 접속
   ↓
7. docker compose down (서비스 중단 ❌)
   ↓
8. docker compose up --build (재시작)
   ↓
9. 서비스 재개 (다운타임 발생)
```

**문제점:**
- ❌ 배포 중 서비스 중단 (다운타임)
- ❌ 파일 전송 느림
- ❌ 자동 복구 없음
- ❌ Auto-scaling 없음

### 새로운 방식 (Kubernetes)
```
1. GitHub에 Push
   ↓
2. GitHub Actions 시작
   ↓
3. Backend/Frontend 빌드
   ↓
4. Docker 이미지 빌드 & ECR/Docker Hub 푸시
   ↓
5. kubectl로 Deployment 이미지 업데이트
   ↓
6. Kubernetes가 Rolling Update 시작 ✅
   - 새 Pod 생성
   - Health Check 통과 확인
   - 트래픽을 새 Pod로 전환
   - 기존 Pod 종료
   ↓
7. 완료 (무중단 배포 ✅)
```

**장점:**
- ✅ 무중단 배포 (Rolling Update)
- ✅ 자동 Health Check
- ✅ 배포 실패 시 자동 Rollback
- ✅ Auto-scaling (HPA)
- ✅ 자동 재시작 (Self-healing)

---

## ⚙️ 환경 변수 관리 변경

### 기존: .env 파일 (Docker Compose)
```bash
# .env 파일을 GitHub Actions에서 생성
echo "MYSQL_HOST=${{ secrets.MYSQL_HOST }}" >> .env
# ... 모든 변수를 .env에 저장
```

### 신규: ConfigMap & Secret (Kubernetes)

**ConfigMap** (민감하지 않은 설정):
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: chat-config
data:
  DB_HOST: "rds-endpoint.amazonaws.com"
  DB_PORT: "3306"
  REDIS_HOST: "redis-service"
```

**Secret** (민감한 정보):
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: chat-secret
stringData:
  DB_PASSWORD: "your-password"
  JWT_SECRET: "your-secret"
```

**자동 업데이트:**
```yaml
# GitHub Actions에서 자동으로 ConfigMap/Secret 업데이트
- name: Update ConfigMap
  run: kubectl apply -f - <<EOF
    ...
  EOF
```

---

## 📋 마이그레이션 체크리스트

### Phase 1: 준비 (1-2시간)
- [ ] Kubernetes 클러스터 선택 (EKS or k3s)
- [ ] 컨테이너 레지스트리 선택 (ECR or Docker Hub)
- [ ] 클러스터 설치 및 설정
- [ ] kubectl 로컬 설정 확인

### Phase 2: CI/CD 설정 (30분)
- [ ] `.github/workflows/k8s-deploy.yml` 생성
- [ ] 워크플로우 파일 내 이미지 경로 수정
- [ ] GitHub Secrets 추가/수정
- [ ] 기존 `cicd.yml` 처리 결정

### Phase 3: Kubernetes 리소스 배포 (30분)
- [ ] Namespace 생성
- [ ] ConfigMap 생성 (실제 값으로)
- [ ] Secret 생성 (실제 값으로)
- [ ] MySQL 배포 (또는 RDS 연결)
- [ ] Redis 배포
- [ ] Deployment 배포 (최초 1회 수동)
- [ ] Service/Ingress 배포

### Phase 4: 테스트 (1시간)
- [ ] GitHub에 코드 푸시
- [ ] GitHub Actions 실행 확인
- [ ] Pod 정상 실행 확인
- [ ] Health Check 테스트
- [ ] API 기능 테스트
- [ ] Rolling Update 테스트 (재배포)

### Phase 5: 전환 (30분)
- [ ] 도메인 DNS 변경 (필요시)
- [ ] 기존 EC2 서버 중지
- [ ] 모니터링 설정
- [ ] 문서 업데이트

**총 예상 시간: 3-4시간**

---

## 🔍 배포 후 확인 방법

### 1. GitHub Actions 로그
```
GitHub → Actions → 최신 워크플로우 실행 → 로그 확인
```

### 2. Kubernetes 리소스 확인
```bash
# Pod 상태
kubectl get pods -n chat-system

# Service 확인
kubectl get svc -n chat-system

# Deployment 상태
kubectl get deployment -n chat-system

# 전체 리소스
kubectl get all -n chat-system
```

### 3. 애플리케이션 로그
```bash
# 실시간 로그
kubectl logs -f deployment/chat-service -n chat-system

# 특정 Pod 로그
kubectl logs <pod-name> -n chat-system

# 이전 컨테이너 로그 (재시작된 경우)
kubectl logs <pod-name> -n chat-system --previous
```

### 4. Health Check
```bash
# 포트포워딩
kubectl port-forward svc/chat-service 8080:80 -n chat-system

# Health Check
curl http://localhost:8080/actuator/health

# 또는 브라우저에서
open http://localhost:8080/actuator/health
```

---

## 🚨 자주 발생하는 문제

### 1. "error: You must be logged in to the server (Unauthorized)"

**원인:** kubeconfig 설정 오류

**해결:**
```bash
# KUBECONFIG Secret 재생성
cat ~/.kube/config | base64 -w 0

# GitHub Secrets → KUBECONFIG 업데이트
```

### 2. "ImagePullBackOff"

**원인:** Docker 이미지를 pull할 수 없음

**해결:**
```bash
# ECR 리포지토리 확인
aws ecr describe-repositories --repository-name chat-service

# 이미지 존재 확인
aws ecr list-images --repository-name chat-service

# 없으면 생성
aws ecr create-repository --repository-name chat-service
```

### 3. "Error from server (NotFound): namespaces 'chat-system' not found"

**원인:** Namespace가 생성되지 않음

**해결:**
```bash
kubectl apply -f k8s/00-namespace.yaml
```

### 4. 배포는 성공했는데 서비스 접속 안 됨

**원인:** Service 타입이 ClusterIP (내부 전용)

**해결:**
```yaml
# k8s/service.yaml 수정
spec:
  type: LoadBalancer  # 또는 NodePort
```

---

## 💡 추천 설정

### 프로젝트 크기별 추천

#### 소규모 (개발/테스트)
```
✅ k3s (EC2 t3.small)
✅ Docker Hub
✅ 수동 배포 + GitHub Actions
비용: ~$15/월
```

#### 중규모 (프로덕션)
```
✅ k3s (EC2 t3.medium)
✅ ECR
✅ GitHub Actions 자동 배포
✅ HPA (Auto-scaling)
비용: ~$50/월
```

#### 대규모 (엔터프라이즈)
```
✅ EKS (Multi-AZ)
✅ ECR
✅ GitHub Actions + ArgoCD
✅ HPA + Cluster Autoscaler
✅ 모니터링 (Prometheus + Grafana)
비용: ~$200/월
```

---

## 📚 참고 문서

- [상세 마이그레이션 가이드](./KUBERNETES_CICD_MIGRATION_GUIDE.md)
- [k3s 빠른 배포](../AWS_k8s_빠른_배포.md)
- [Kubernetes 인프라 구조](./KUBERNETES_INFRASTRUCTURE.md)

---

**마지막 업데이트:** 2026-01-12  
**버전:** 1.0
