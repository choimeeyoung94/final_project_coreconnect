# 🚀 Docker+EC2에서 Kubernetes로 CI/CD 전환 가이드

## 📋 목차
1. [현재 상황 분석](#현재-상황-분석)
2. [필요한 변경 사항](#필요한-변경-사항)
3. [단계별 설정 방법](#단계별-설정-방법)
4. [GitHub Secrets 설정](#github-secrets-설정)
5. [배포 방법 선택](#배포-방법-선택)
6. [트러블슈팅](#트러블슈팅)

---

## 🔍 현재 상황 분석

### 기존 구조 (Docker + EC2)
```
GitHub Actions
  ↓
Docker Compose 빌드
  ↓
SCP로 EC2에 파일 전송
  ↓
SSH로 EC2 접속하여 docker-compose up
```

**파일:** `.github/workflows/cicd.yml`

### 새로운 구조 (Kubernetes)
```
GitHub Actions
  ↓
Docker 이미지 빌드
  ↓
ECR/Docker Hub에 푸시
  ↓
Kubernetes Deployment 업데이트
  ↓
Rolling Update 자동 실행
```

**파일:** `.github/workflows/k8s-deploy.yml` ✨ (새로 생성됨)

---

## 🔧 필요한 변경 사항

### 1. CI/CD 파일 교체

**기존:**
```
.github/workflows/cicd.yml (Docker+EC2용)
```

**신규:**
```
.github/workflows/k8s-deploy.yml (Kubernetes용)
```

### 2. 컨테이너 레지스트리 선택

두 가지 옵션:

#### 옵션 A: AWS ECR (추천 - 프로덕션)
- ✅ AWS와 완벽 통합
- ✅ 보안 강화 (IAM 기반)
- ✅ 빠른 속도 (같은 리전)
- ❌ 초기 설정 필요

#### 옵션 B: Docker Hub (추천 - 간단함)
- ✅ 설정 초간단
- ✅ 무료 Public 저장소
- ❌ Private는 유료
- ❌ 속도 상대적으로 느림

### 3. Kubernetes 클러스터 선택

두 가지 옵션:

#### 옵션 A: AWS EKS (관리형 Kubernetes)
- ✅ 완전 관리형
- ✅ Auto-scaling 쉬움
- ❌ 비용 높음 ($75/월 +)

#### 옵션 B: EC2 + k3s (경량 Kubernetes)
- ✅ 비용 저렴 ($30/월)
- ✅ 빠른 설치
- ❌ 직접 관리 필요

---

## 📝 단계별 설정 방법

### Step 1: 컨테이너 레지스트리 설정

#### 방법 A: AWS ECR 설정 (추천)

**1-1. ECR 리포지토리 생성:**

```bash
# Backend 이미지용 저장소
aws ecr create-repository \
  --repository-name chat-service \
  --region ap-northeast-2

# Frontend 이미지용 저장소  
aws ecr create-repository \
  --repository-name chat-frontend \
  --region ap-northeast-2
```

**1-2. 출력 확인:**
```json
{
  "repository": {
    "repositoryUri": "123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/chat-service",
    ...
  }
}
```

**1-3. repositoryUri 복사해두기!**

#### 방법 B: Docker Hub 설정 (간단)

**1-1. Docker Hub 가입:**
- https://hub.docker.com 가입

**1-2. Access Token 생성:**
```
계정 → Security → New Access Token
Token 복사해두기!
```

**1-3. 워크플로우 파일 수정:**

`.github/workflows/k8s-deploy.yml` 에서:

```yaml
# ECR 로그인 부분을 Docker Hub 로그인으로 교체:

# 기존 (ECR):
- name: Login to Amazon ECR
  uses: aws-actions/amazon-ecr-login@v2

# 변경 (Docker Hub):
- name: Login to Docker Hub
  uses: docker/login-action@v3
  with:
    username: ${{ secrets.DOCKERHUB_USERNAME }}
    password: ${{ secrets.DOCKERHUB_TOKEN }}
```

그리고 이미지 이름 수정:
```yaml
# 기존:
IMAGE_URI=$ECR_REGISTRY/$ECR_REPOSITORY_BACKEND:$IMAGE_TAG

# 변경:
IMAGE_URI=your-dockerhub-id/chat-service:$IMAGE_TAG
```

---

### Step 2: Kubernetes 클러스터 설정

#### 방법 A: AWS EKS 사용

**2-1. EKS 클러스터 생성:**
```bash
aws eks create-cluster \
  --name chat-cluster \
  --role-arn arn:aws:iam::YOUR_ACCOUNT:role/EKSClusterRole \
  --resources-vpc-config subnetIds=subnet-xxx,subnet-yyy,securityGroupIds=sg-xxx \
  --region ap-northeast-2
```

**2-2. kubeconfig 설정:**
```bash
aws eks update-kubeconfig --name chat-cluster --region ap-northeast-2
```

**2-3. Node Group 생성:**
```bash
aws eks create-nodegroup \
  --cluster-name chat-cluster \
  --nodegroup-name chat-nodes \
  --scaling-config minSize=2,maxSize=10,desiredSize=3 \
  --instance-types t3.medium \
  --subnets subnet-xxx subnet-yyy \
  --node-role arn:aws:iam::YOUR_ACCOUNT:role/EKSNodeRole \
  --region ap-northeast-2
```

#### 방법 B: EC2 + k3s 사용 (추천 - 간단)

**이미 가이드 존재:** `AWS_k8s_빠른_배포.md` 참고!

**요약:**
```bash
# 1. EC2 인스턴스 생성 (t3.medium)
# AWS Console에서 생성 또는:
aws ec2 run-instances \
  --image-id ami-0c76973fbe0ee100c \
  --instance-type t3.medium \
  --key-name your-key \
  --security-group-ids sg-xxx

# 2. SSH 접속
ssh -i your-key.pem ec2-user@<PUBLIC_IP>

# 3. k3s 설치
curl -sfL https://get.k3s.io | sh -

# 4. kubeconfig 가져오기
sudo cat /etc/rancher/k3s/k3s.yaml
```

**2-4. kubeconfig를 Base64로 인코딩:**
```bash
# 로컬에서:
cat k3s.yaml | base64 -w 0 > kubeconfig-base64.txt
```

---

### Step 3: Kubernetes 리소스 배포

**3-1. Namespace 생성:**
```bash
kubectl apply -f k8s/00-namespace.yaml
```

**3-2. MySQL 배포 (선택 - RDS 사용 시 생략):**
```bash
kubectl apply -f k8s/01-mysql.yaml
```

**3-3. Redis 배포:**
```bash
kubectl apply -f k8s/02-redis.yaml
```

**3-4. ConfigMap & Secret 수정:**

`k8s/configmap.yaml`:
```yaml
data:
  DB_HOST: "your-rds-endpoint.amazonaws.com"  # ← 실제 RDS 엔드포인트
  REDIS_HOST: "redis-service.chat-system.svc.cluster.local"  # ← k8s 내부 Redis
```

`k8s/secret-template.yaml`:
```yaml
stringData:
  DB_USERNAME: "admin"
  DB_PASSWORD: "your-password"
  # ... 실제 값으로 변경
```

**3-5. 수동으로 배포 (최초 1회):**
```bash
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret-template.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

---

### Step 4: GitHub Secrets 설정

**GitHub 저장소 → Settings → Secrets and variables → Actions**

#### 필수 Secrets:

| Secret 이름 | 설명 | 예시 값 |
|------------|------|---------|
| `AWS_ACCESS_KEY_ID` | AWS 액세스 키 | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS 시크릿 키 | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_REGION` | AWS 리전 | `ap-northeast-2` |
| `MYSQL_HOST` | MySQL 호스트 | `your-rds.amazonaws.com` |
| `MYSQL_PORT` | MySQL 포트 | `3306` |
| `MYSQL_DATABASE` | 데이터베이스 이름 | `coreconnect` |
| `MYSQL_USER` | MySQL 사용자 | `admin` |
| `MYSQL_PASSWORD` | MySQL 비밀번호 | `your-password` |
| `JWT_SECRET_KEY` | JWT 시크릿 키 | `your-jwt-secret-key-at-least-256-bits` |
| `SENDGRID_API_KEY` | SendGrid API 키 | `SG.xxx` |
| `CORS_ALLOWED_ORIGINS` | CORS 허용 도메인 | `http://localhost:3000,https://yourdomain.com` |
| `WEBSOCKET_ALLOWED_ORIGINS` | WebSocket 허용 도메인 | `http://localhost:3000,https://yourdomain.com` |
| `ALLOWED_ORIGIN` | 허용된 오리진 | `https://yourdomain.com` |

#### Kubernetes 관련 Secrets:

**EKS 사용 시:**
```
EKS_CLUSTER_NAME: chat-cluster
K8S_CLUSTER_TYPE: EKS
```

**k3s 사용 시:**
```
KUBECONFIG: (base64 인코딩된 kubeconfig 파일 내용)
K8S_CLUSTER_TYPE: k3s
```

#### Docker Hub 사용 시 (ECR 대신):
```
DOCKERHUB_USERNAME: your-dockerhub-id
DOCKERHUB_TOKEN: dckr_pat_xxxxx
```

---

## 🔀 배포 방법 선택

### 방법 1: GitHub Actions 자동 배포 (추천)

**설정 완료 후:**
```bash
git add .
git commit -m "feat: Kubernetes CI/CD 설정 완료"
git push origin main
```

**자동으로 실행됨:**
1. ✅ 코드 검증 & 테스트
2. ✅ Docker 이미지 빌드 & 푸시
3. ✅ Kubernetes 배포
4. ✅ Rolling Update

**진행 상황 확인:**
- GitHub → Actions 탭
- 실시간 로그 확인 가능

### 방법 2: 수동 배포

**로컬에서 직접:**
```bash
# 1. 이미지 빌드
cd backend
docker build -t your-registry/chat-service:v1.0 .
docker push your-registry/chat-service:v1.0

# 2. Deployment 업데이트
kubectl set image deployment/chat-service \
  chat-service=your-registry/chat-service:v1.0 \
  -n chat-system

# 3. Rollout 상태 확인
kubectl rollout status deployment/chat-service -n chat-system
```

---

## 🔄 기존 cicd.yml 파일 처리

### 옵션 A: 완전히 교체 (추천)

```bash
# 기존 파일 삭제
rm .github/workflows/cicd.yml

# 새 파일 사용
mv .github/workflows/k8s-deploy.yml .github/workflows/cicd.yml
```

### 옵션 B: 두 개 병행 (테스트용)

```bash
# 둘 다 유지
.github/workflows/cicd.yml         # Docker+EC2용
.github/workflows/k8s-deploy.yml   # Kubernetes용

# 필요에 따라 branch 조건 추가:
# cicd.yml → dev 브랜치에서만 실행
# k8s-deploy.yml → main 브랜치에서만 실행
```

---

## 🔍 배포 확인 방법

### 1. Pod 상태 확인
```bash
kubectl get pods -n chat-system
```

**정상 출력:**
```
NAME                           READY   STATUS    RESTARTS   AGE
chat-service-7d8f4c9b8-abc12   1/1     Running   0          2m
chat-service-7d8f4c9b8-def34   1/1     Running   0          2m
```

### 2. Service 확인
```bash
kubectl get svc -n chat-system
```

### 3. 로그 확인
```bash
kubectl logs -f deployment/chat-service -n chat-system
```

### 4. Health Check
```bash
# 포트포워딩
kubectl port-forward svc/chat-service 8080:80 -n chat-system

# 다른 터미널에서
curl http://localhost:8080/actuator/health
```

---

## 🚨 트러블슈팅

### 문제 1: ImagePullBackOff

**원인:** Docker 이미지를 pull할 수 없음

**해결:**
```bash
# ECR 로그인 확인
aws ecr get-login-password --region ap-northeast-2

# 이미지 존재 확인
aws ecr list-images --repository-name chat-service --region ap-northeast-2

# Deployment의 이미지 경로 확인
kubectl describe pod <pod-name> -n chat-system
```

### 문제 2: CrashLoopBackOff

**원인:** 애플리케이션 시작 실패

**해결:**
```bash
# 로그 확인
kubectl logs <pod-name> -n chat-system --previous

# 일반적 원인:
# - DB 연결 실패 → ConfigMap의 DB_HOST 확인
# - Secret 누락 → kubectl get secret -n chat-system
# - 메모리 부족 → kubectl top pod -n chat-system
```

### 문제 3: GitHub Actions 실패

**"Error: Failed to update kubeconfig"**

**해결:**
```bash
# KUBECONFIG Secret 확인
# GitHub → Settings → Secrets → KUBECONFIG
# 값이 Base64 인코딩되어 있는지 확인

# 재생성:
cat ~/.kube/config | base64 -w 0
```

### 문제 4: Rolling Update 느림

**원인:** Health check 실패

**해결:**
```yaml
# deployment.yaml에서 probe 조정:
readinessProbe:
  initialDelaySeconds: 30  # ← 증가
  periodSeconds: 5
  timeoutSeconds: 3
```

---

## 📊 비교: 기존 vs 새로운 방식

| 항목 | Docker+EC2 | Kubernetes |
|-----|-----------|------------|
| 배포 속도 | 느림 (5-10분) | 빠름 (2-3분) |
| 무중단 배포 | ❌ 다운타임 발생 | ✅ Rolling Update |
| Auto-scaling | ❌ 수동 | ✅ HPA 자동 |
| 복원력 | ❌ 수동 재시작 | ✅ 자동 재시작 |
| 모니터링 | 기본 | 강력함 |
| 복잡도 | 낮음 | 중간 |
| 비용 (월) | $30-50 | $30-100 |

---

## ✅ 체크리스트

### 사전 준비
- [ ] 컨테이너 레지스트리 선택 (ECR or Docker Hub)
- [ ] Kubernetes 클러스터 준비 (EKS or k3s)
- [ ] AWS 자격 증명 준비
- [ ] kubectl 설치 및 설정

### CI/CD 설정
- [ ] `.github/workflows/k8s-deploy.yml` 파일 생성
- [ ] GitHub Secrets 모두 설정
- [ ] ECR 리포지토리 생성 (ECR 사용 시)
- [ ] Docker Hub Token 생성 (Docker Hub 사용 시)

### Kubernetes 리소스
- [ ] Namespace 생성
- [ ] ConfigMap 생성 및 값 확인
- [ ] Secret 생성 및 값 확인
- [ ] MySQL 배포 (또는 RDS 사용)
- [ ] Redis 배포
- [ ] Deployment 배포
- [ ] Service 배포

### 배포 테스트
- [ ] GitHub에 코드 푸시
- [ ] GitHub Actions 실행 확인
- [ ] Pod 정상 실행 확인
- [ ] Health Check 성공
- [ ] 실제 API 테스트

### 정리
- [ ] 기존 EC2 서버 중지 (테스트 후)
- [ ] 기존 cicd.yml 삭제 또는 비활성화
- [ ] 문서 업데이트

---

## 🎓 추가 학습 자료

### Kubernetes 기본
- [Kubernetes 공식 문서](https://kubernetes.io/ko/docs/home/)
- [k3s 문서](https://docs.k3s.io/)

### CI/CD
- [GitHub Actions 문서](https://docs.github.com/en/actions)
- [AWS ECR 가이드](https://docs.aws.amazon.com/ecr/)

### 프로젝트 내 관련 문서
- `AWS_k8s_빠른_배포.md` - k3s 빠른 설치 가이드
- `k8s_배포_자동화.bat` - 배포 자동화 스크립트
- `KUBERNETES_INFRASTRUCTURE.md` - 인프라 구조 설명

---

## 💬 도움이 필요하면?

1. **Issues 생성**
2. **팀원에게 문의**
3. **Kubernetes Slack 커뮤니티**

---

**작성일:** 2026-01-12  
**작성자:** AI Assistant  
**버전:** 1.0
