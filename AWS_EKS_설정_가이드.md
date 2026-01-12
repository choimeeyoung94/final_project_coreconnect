# AWS EKS 설정 가이드

## 🎯 현재 상황

스크린샷 확인:
- ✅ EKS 클러스터 2개 존재
  - `chat-prod` (활성, Kubernetes 1.29)
  - `kube-practice` (Kubernetes 1.34)

**사용할 클러스터:** `chat-prod`

---

## 📋 해야 할 작업 (단계별)

### 1단계: EKS 클러스터 확인 ✅

**이미 완료됨!** `chat-prod` 클러스터가 활성 상태

확인사항:
- [x] 클러스터 상태: **활성** (초록색)
- [x] Kubernetes 버전: 1.29
- [x] 리전: ap-northeast-2 (서울)

---

### 2단계: Node Group 확인

**AWS Console에서 확인:**

1. **EKS → 클러스터 → chat-prod 클릭**

2. **"컴퓨팅" 탭 선택**
   - Node Group이 있는지 확인
   - 없으면 생성 필요

**Node Group 생성 (없는 경우):**

```bash
# AWS Console에서:
# 1. "노드 그룹 추가" 클릭
# 2. 이름: chat-nodes
# 3. 노드 IAM 역할: AmazonEKSNodeRole (없으면 생성)
# 4. 인스턴스 유형: t3.medium 또는 t3.small
# 5. 스케일링 구성:
#    - 최소: 2
#    - 최대: 10
#    - 원하는: 3
```

---

### 3단계: ECR 리포지토리 생성

**현재 필요한 리포지토리:**
- `chat-service` (백엔드)
- `chat-frontend` (프론트엔드)

**생성 방법 1: AWS Console**

1. **ECR 서비스로 이동**
   - 상단 검색에서 "ECR" 입력

2. **"리포지토리 생성" 클릭**

3. **설정:**
   ```
   표시 여부 설정: 프라이빗
   리포지토리 이름: chat-service
   태그 변경 가능성: 활성화 (기본값)
   이미지 스캔 설정: 푸시 시 스캔 (선택사항)
   KMS 암호화: 비활성화 (비용 절감)
   ```

4. **"리포지토리 생성" 클릭**

5. **반복:** `chat-frontend` 리포지토리도 동일하게 생성

**생성 방법 2: AWS CLI (더 빠름!)**

```bash
# Backend 리포지토리
aws ecr create-repository \
  --repository-name chat-service \
  --region ap-northeast-2 \
  --image-scanning-configuration scanOnPush=true

# Frontend 리포지토리
aws ecr create-repository \
  --repository-name chat-frontend \
  --region ap-northeast-2 \
  --image-scanning-configuration scanOnPush=true
```

**확인:**
```bash
aws ecr describe-repositories --region ap-northeast-2
```

---

### 4단계: kubeconfig 설정 (로컬)

**로컬 PC에서 EKS 접근 설정:**

```bash
# kubeconfig 업데이트
aws eks update-kubeconfig --name chat-prod --region ap-northeast-2

# 확인
kubectl cluster-info
kubectl get nodes
```

**출력 예시:**
```
Kubernetes control plane is running at https://xxxxx.eks.amazonaws.com
...

NAME                                           STATUS   ROLES    AGE   VERSION
ip-192-168-xx-xx.ap-northeast-2.compute.internal   Ready    <none>   1d    v1.29.x
ip-192-168-xx-xx.ap-northeast-2.compute.internal   Ready    <none>   1d    v1.29.x
```

---

### 5단계: Kubernetes Namespace 생성

```bash
# Namespace 생성
kubectl create namespace chat-system

# 확인
kubectl get namespace
```

**또는 yaml 파일 사용:**
```bash
kubectl apply -f k8s/00-namespace.yaml
```

---

### 6단계: ConfigMap 생성

**ConfigMap 생성:**

```bash
kubectl create configmap chat-config \
  --from-literal=DB_HOST="your-rds-endpoint.amazonaws.com" \
  --from-literal=DB_PORT="3306" \
  --from-literal=DB_NAME="coreconnect" \
  --from-literal=REDIS_HOST="redis-service.chat-system.svc.cluster.local" \
  --from-literal=REDIS_PORT="6379" \
  --from-literal=AWS_REGION="ap-northeast-2" \
  --from-literal=WEBSOCKET_ORIGINS="*" \
  --from-literal=JWT_EXPIRATION="86400000" \
  --from-literal=SECURITY_MODE="secure" \
  --from-literal=SPRING_JPA_HIBERNATE_DDL_AUTO="update" \
  --from-literal=CORS_ALLOWED_ORIGINS="http://localhost:3000" \
  --namespace=chat-system
```

**RDS 엔드포인트 확인:**
```bash
# AWS Console → RDS → 데이터베이스 → MySQL 인스턴스 선택
# "연결 & 보안" 탭에서 엔드포인트 복사
```

---

### 7단계: Secret 생성

```bash
kubectl create secret generic chat-secret \
  --from-literal=DB_USERNAME="admin" \
  --from-literal=DB_PASSWORD="your-mysql-password" \
  --from-literal=JWT_SECRET="your-jwt-secret-key" \
  --from-literal=AWS_ACCESS_KEY_ID="your-aws-key" \
  --from-literal=AWS_SECRET_ACCESS_KEY="your-aws-secret" \
  --from-literal=SENDGRID_API_KEY="your-sendgrid-key" \
  --from-literal=REDIS_PASSWORD="" \
  --namespace=chat-system
```

**확인:**
```bash
kubectl get configmap -n chat-system
kubectl get secret -n chat-system
```

---

### 8단계: MySQL 배포 (선택사항)

**RDS 사용 시:** 이 단계 생략

**EKS 내부에 MySQL 배포 시:**
```bash
kubectl apply -f k8s/01-mysql.yaml
kubectl wait --for=condition=ready pod -l app=mysql -n chat-system --timeout=120s
```

---

### 9단계: Redis 배포

```bash
kubectl apply -f k8s/02-redis.yaml
kubectl wait --for=condition=ready pod -l app=redis -n chat-system --timeout=60s
```

---

### 10단계: Deployment 배포 (최초 1회)

**수동 배포 (최초):**

```bash
# Deployment 배포
kubectl apply -f k8s/deployment.yaml

# Service 배포
kubectl apply -f k8s/service.yaml

# 상태 확인
kubectl get pods -n chat-system
kubectl get svc -n chat-system
```

**⚠️ 주의:** 
- 최초 1회는 수동 배포 필요
- 이후부터는 GitHub Actions가 자동 배포

---

### 11단계: LoadBalancer 또는 Ingress 설정

**방법 1: LoadBalancer (간단)**

```bash
# Service 타입을 LoadBalancer로 변경
kubectl patch svc chat-service -n chat-system -p '{"spec":{"type":"LoadBalancer"}}'

# External IP 확인 (몇 분 소요)
kubectl get svc chat-service -n chat-system -w
```

**출력 예시:**
```
NAME           TYPE           EXTERNAL-IP                                                                 
chat-service   LoadBalancer   xxxxx-xxxxxxx.ap-northeast-2.elb.amazonaws.com
```

**방법 2: Ingress (추천 - 프로덕션)**

```bash
# Ingress 배포
kubectl apply -f k8s/ingress.yaml

# Ingress 확인
kubectl get ingress -n chat-system
```

---

## 🔍 IAM 권한 설정

### GitHub Actions용 IAM 사용자 권한

**AWS Console → IAM → Users → (GitHub Actions 사용자) → Permissions**

**필요한 권한:**

1. **EKS 권한:**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "eks:DescribeCluster",
           "eks:ListClusters",
           "eks:AccessKubernetesApi"
         ],
         "Resource": "arn:aws:eks:ap-northeast-2:*:cluster/chat-prod"
       }
     ]
   }
   ```

2. **ECR 권한:**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "ecr:GetAuthorizationToken",
           "ecr:BatchCheckLayerAvailability",
           "ecr:GetDownloadUrlForLayer",
           "ecr:PutImage",
           "ecr:InitiateLayerUpload",
           "ecr:UploadLayerPart",
           "ecr:CompleteLayerUpload"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

**또는 관리형 정책 사용:**
- `AmazonEKSClusterPolicy`
- `AmazonEC2ContainerRegistryPowerUser`

---

## 🚀 배포 테스트

### 1. 로컬에서 테스트

```bash
# Pod 상태 확인
kubectl get pods -n chat-system

# 로그 확인
kubectl logs -f deployment/chat-service -n chat-system

# Health Check
kubectl port-forward svc/chat-service 8080:80 -n chat-system
curl http://localhost:8080/actuator/health
```

### 2. GitHub Actions 배포 테스트

```bash
# 코드 변경 후 푸시
git add .
git commit -m "test: Kubernetes CI/CD 테스트"
git push origin main

# GitHub → Actions 탭에서 실행 확인
```

---

## 📊 비용 예상

### chat-prod 클러스터 (EKS)

**EKS 컨트롤 플레인:**
- $0.10/시간 = **$73/월**

**Node Group (t3.medium × 3):**
- $0.0416/시간 × 3 = $0.1248/시간
- **$91/월**

**ECR:**
- 처음 500MB 무료
- 이후 $0.10/GB/월

**총 예상 비용:** **$165-180/월**

### 비용 절감 팁:

1. **Reserved Instances 사용** (1년 약정 시 40% 할인)
2. **Spot Instances 사용** (최대 90% 할인, 불안정)
3. **개발 환경은 kube-practice 사용** (필요시만 기동)
4. **HPA 설정으로 트래픽 없을 때 Pod 수 감소**

---

## ✅ 최종 체크리스트

### EKS 클러스터
- [x] chat-prod 클러스터 확인 (활성)
- [ ] Node Group 확인/생성
- [ ] IAM 역할 확인

### ECR
- [ ] chat-service 리포지토리 생성
- [ ] chat-frontend 리포지토리 생성

### Kubernetes 리소스
- [ ] Namespace 생성 (chat-system)
- [ ] ConfigMap 생성
- [ ] Secret 생성
- [ ] MySQL 배포 (또는 RDS 사용)
- [ ] Redis 배포
- [ ] Deployment 배포
- [ ] Service 배포
- [ ] Ingress/LoadBalancer 설정

### GitHub
- [ ] EKS_CLUSTER_NAME Secret 추가
- [ ] K8S_CLUSTER_TYPE Secret 추가
- [ ] AWS 권한 확인

### 테스트
- [ ] 로컬에서 kubectl 접속 확인
- [ ] Pod 정상 실행 확인
- [ ] Health Check 성공
- [ ] GitHub Actions 배포 테스트

---

## 🆘 문제 발생 시

### 1. kubectl 접속 안 됨
```bash
# kubeconfig 재설정
aws eks update-kubeconfig --name chat-prod --region ap-northeast-2

# 권한 확인
aws sts get-caller-identity
```

### 2. ECR 푸시 실패
```bash
# ECR 로그인
aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.ap-northeast-2.amazonaws.com
```

### 3. Pod가 시작 안 됨
```bash
# 로그 확인
kubectl describe pod <pod-name> -n chat-system
kubectl logs <pod-name> -n chat-system
```

---

**다음 단계:** GitHub에 코드 푸시하여 자동 배포 테스트! 🚀
