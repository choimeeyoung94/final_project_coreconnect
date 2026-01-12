# ✅ Kubernetes CI/CD 전환 완료

## 🎉 생성된 파일

### 1. GitHub Actions 워크플로우
```
.github/workflows/k8s-deploy.yml  (NEW! ✨)
```

**주요 기능:**
- ✅ 코드 검증 및 테스트
- ✅ Docker 이미지 빌드 및 ECR/Docker Hub 푸시
- ✅ Kubernetes 자동 배포
- ✅ Rolling Update 지원
- ✅ 실패 시 자동 Rollback

### 2. 상세 가이드 문서
```
docs/KUBERNETES_CICD_MIGRATION_GUIDE.md    (상세 전환 가이드)
docs/CICD_변경사항_요약.md                 (변경사항 한눈에 보기)
```

### 3. 자동화 스크립트
```
scripts/setup-k8s-cicd.sh   (Linux/Mac)
scripts/setup-k8s-cicd.bat  (Windows)
```

---

## 🚀 빠른 시작 (3단계)

### 1단계: 자동 설정 스크립트 실행

**Windows:**
```cmd
scripts\setup-k8s-cicd.bat
```

**Linux/Mac:**
```bash
chmod +x scripts/setup-k8s-cicd.sh
./scripts/setup-k8s-cicd.sh
```

스크립트가 자동으로:
- ✅ 사전 요구사항 확인 (kubectl, aws-cli)
- ✅ 컨테이너 레지스트리 설정 (ECR/Docker Hub)
- ✅ Kubernetes 클러스터 연결
- ✅ Namespace 생성
- ✅ ConfigMap/Secret 생성

### 2단계: GitHub Secrets 설정

**GitHub 저장소 → Settings → Secrets and variables → Actions**

#### 기본 Secrets (기존 유지)
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_DATABASE`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `JWT_SECRET_KEY`
- `SENDGRID_API_KEY`
- `CORS_ALLOWED_ORIGINS`
- `WEBSOCKET_ALLOWED_ORIGINS`
- `ALLOWED_ORIGIN`

#### 제거할 Secrets (더 이상 불필요)
- ~~`EC2_HOST`~~
- ~~`EC2_USER`~~
- ~~`EC2_SSH_KEY`~~

#### 새로 추가할 Secrets

**EKS 사용 시:**
```
EKS_CLUSTER_NAME: "your-cluster-name"
K8S_CLUSTER_TYPE: "EKS"
```

**k3s 사용 시:**
```
KUBECONFIG: "<base64 인코딩된 kubeconfig>"
K8S_CLUSTER_TYPE: "k3s"
```

**kubeconfig 생성 (k3s):**
```bash
# k3s 서버에서
sudo cat /etc/rancher/k3s/k3s.yaml > k3s-config.yaml

# server 주소를 Public IP로 변경
sed -i 's/127.0.0.1/<YOUR_PUBLIC_IP>/g' k3s-config.yaml

# Base64 인코딩
cat k3s-config.yaml | base64 -w 0
```

**Docker Hub 사용 시 (ECR 대신):**
```
DOCKERHUB_USERNAME: "your-dockerhub-id"
DOCKERHUB_TOKEN: "dckr_pat_xxxxx"
```

### 3단계: 배포!

```bash
# 코드 커밋 및 푸시
git add .
git commit -m "feat: Kubernetes CI/CD 전환 완료"
git push origin main

# GitHub Actions가 자동으로 배포 시작!
```

**진행 상황 확인:**
- GitHub → Actions 탭
- 실시간 로그 확인

---

## 📊 아키텍처 비교

### 기존 (Docker + EC2)
```
┌─────────────┐
│   GitHub    │
│   Actions   │
└──────┬──────┘
       │ SCP (파일 전송)
       ↓
┌─────────────────┐
│   EC2 Server    │
│                 │
│ Docker Compose  │
│  ├─ Backend     │
│  ├─ Frontend    │
│  ├─ MySQL       │
│  └─ Nginx       │
└─────────────────┘

문제점:
❌ 배포 중 다운타임
❌ 수동 스케일링
❌ 복원력 부족
```

### 신규 (Kubernetes)
```
┌─────────────┐
│   GitHub    │
│   Actions   │
└──────┬──────┘
       │ Docker Push
       ↓
┌─────────────────┐
│ ECR/Docker Hub  │
│  (이미지 저장소)  │
└──────┬──────────┘
       │ kubectl
       ↓
┌─────────────────────────────┐
│   Kubernetes Cluster        │
│                             │
│  ┌─────────────────────┐   │
│  │  Chat Service Pods  │   │
│  │  ├─ Pod 1           │   │
│  │  ├─ Pod 2           │   │
│  │  └─ Pod N           │   │
│  └─────────────────────┘   │
│                             │
│  ┌─────┐  ┌───────┐        │
│  │MySQL│  │ Redis │        │
│  └─────┘  └───────┘        │
│                             │
│  Load Balancer              │
└─────────────────────────────┘

장점:
✅ 무중단 배포 (Rolling Update)
✅ 자동 스케일링 (HPA)
✅ 자동 복구 (Self-healing)
✅ 로드 밸런싱
```

---

## 🔄 배포 프로세스

### 기존 방식
```
1. git push
   ↓
2. GitHub Actions 시작
   ↓
3. 코드 검증 & 테스트
   ↓
4. SCP로 EC2에 파일 전송 (느림)
   ↓
5. SSH로 EC2 접속
   ↓
6. docker compose down  ← 서비스 중단! ❌
   ↓
7. docker compose up
   ↓
8. 서비스 재개 (다운타임 발생)
```

### 새로운 방식
```
1. git push
   ↓
2. GitHub Actions 시작
   ↓
3. 코드 검증 & 테스트
   ↓
4. Docker 이미지 빌드
   ↓
5. ECR/Docker Hub 푸시
   ↓
6. kubectl로 Deployment 업데이트
   ↓
7. Kubernetes Rolling Update 시작
   ├─ 새 Pod 생성
   ├─ Health Check 통과 확인
   ├─ 트래픽을 새 Pod로 전환
   └─ 기존 Pod 종료
   ↓
8. 완료 (무중단 배포!) ✅
```

---

## 📋 체크리스트

### ✅ Phase 1: 사전 준비 (완료!)
- [x] `.github/workflows/k8s-deploy.yml` 생성
- [x] 상세 가이드 문서 작성
- [x] 자동화 스크립트 작성

### 🔲 Phase 2: 환경 설정 (진행 필요)
- [ ] 컨테이너 레지스트리 선택 (ECR or Docker Hub)
- [ ] Kubernetes 클러스터 준비 (EKS or k3s)
- [ ] kubectl 설치 및 설정
- [ ] 자동화 스크립트 실행

### 🔲 Phase 3: GitHub 설정 (진행 필요)
- [ ] GitHub Secrets 추가/수정
- [ ] 기존 EC2 관련 Secrets 제거
- [ ] Kubernetes 관련 Secrets 추가

### 🔲 Phase 4: Kubernetes 리소스 배포 (진행 필요)
- [ ] Namespace 생성
- [ ] ConfigMap 생성
- [ ] Secret 생성
- [ ] MySQL 배포 (또는 RDS 연결)
- [ ] Redis 배포
- [ ] Deployment 배포
- [ ] Service 배포

### 🔲 Phase 5: 테스트 및 전환 (진행 필요)
- [ ] GitHub에 코드 푸시
- [ ] GitHub Actions 실행 확인
- [ ] Pod 정상 실행 확인
- [ ] Health Check 테스트
- [ ] API 기능 테스트
- [ ] 기존 EC2 서버 중지

---

## 🎯 다음 단계

### 1. 자동화 스크립트 실행
```bash
# Windows
scripts\setup-k8s-cicd.bat

# Linux/Mac
./scripts/setup-k8s-cicd.sh
```

### 2. 상세 가이드 확인
```
docs/KUBERNETES_CICD_MIGRATION_GUIDE.md    (모든 것이 설명되어 있음)
docs/CICD_변경사항_요약.md                 (핵심만 빠르게)
```

### 3. GitHub Secrets 설정
- GitHub → Settings → Secrets

### 4. 배포 테스트
```bash
git push origin main
```

---

## 🔍 배포 확인 방법

### GitHub Actions 로그
```
GitHub → Actions → 최신 워크플로우
```

### Kubernetes 리소스 확인
```bash
# Pod 상태
kubectl get pods -n chat-system

# Service 확인
kubectl get svc -n chat-system

# 로그 확인
kubectl logs -f deployment/chat-service -n chat-system

# Health Check
kubectl port-forward svc/chat-service 8080:80 -n chat-system
curl http://localhost:8080/actuator/health
```

---

## 🚨 문제 발생 시

### 1. 공식 문서 확인
```
docs/KUBERNETES_CICD_MIGRATION_GUIDE.md
  → 트러블슈팅 섹션 참고
```

### 2. 일반적인 문제

**ImagePullBackOff:**
```bash
# ECR 리포지토리 확인
aws ecr list-images --repository-name chat-service
```

**CrashLoopBackOff:**
```bash
# 로그 확인
kubectl logs <pod-name> -n chat-system --previous
```

**GitHub Actions 실패:**
```bash
# GitHub Secrets 확인
# KUBECONFIG가 base64로 인코딩되어 있는지 확인
```

---

## 💰 예상 비용

### k3s (EC2 t3.medium)
```
인스턴스: $30/월
EBS: $5/월
네트워크: $5/월
────────────────
총: ~$40/월
```

### AWS EKS
```
EKS 컨트롤 플레인: $75/월
Worker Nodes (t3.medium × 2): $60/월
EBS: $10/월
네트워크: $10/월
────────────────
총: ~$155/월
```

**추천:** k3s (개발/중소규모)

---

## 📚 참고 자료

### 프로젝트 내 문서
- `docs/KUBERNETES_CICD_MIGRATION_GUIDE.md` - 상세 전환 가이드
- `docs/CICD_변경사항_요약.md` - 변경사항 요약
- `AWS_k8s_빠른_배포.md` - k3s 빠른 설치
- `KUBERNETES_INFRASTRUCTURE.md` - 인프라 구조

### 외부 자료
- [Kubernetes 공식 문서](https://kubernetes.io/ko/)
- [GitHub Actions 문서](https://docs.github.com/en/actions)
- [AWS ECR 가이드](https://docs.aws.amazon.com/ecr/)

---

## 🎓 핵심 개념

### Rolling Update
- 새 버전을 점진적으로 배포
- 기존 버전과 동시 실행
- 무중단 배포 가능

### Health Check
- Liveness Probe: 컨테이너가 살아있는지
- Readiness Probe: 트래픽을 받을 준비가 되었는지
- Startup Probe: 시작 시간 여유

### Auto-scaling (HPA)
- CPU/메모리 사용률 기반
- 자동으로 Pod 개수 조정
- 트래픽 급증 시 대응

---

## ✅ 최종 확인

### 준비 완료!
- [x] 워크플로우 파일 생성
- [x] 상세 가이드 작성
- [x] 자동화 스크립트 작성
- [x] 트러블슈팅 가이드 작성

### 이제 할 일:
1. ⏭️ 자동화 스크립트 실행
2. ⏭️ GitHub Secrets 설정
3. ⏭️ 코드 푸시 및 배포 테스트

---

**작성일:** 2026-01-12  
**상태:** ✅ 준비 완료  
**다음 단계:** 자동화 스크립트 실행 (`scripts\setup-k8s-cicd.bat`)

---

## 💬 궁금한 점이 있으면?

1. 상세 가이드 확인: `docs/KUBERNETES_CICD_MIGRATION_GUIDE.md`
2. 트러블슈팅: `docs/KUBERNETES_CICD_MIGRATION_GUIDE.md` → 트러블슈팅 섹션
3. Issues 생성

**화이팅!** 🚀
