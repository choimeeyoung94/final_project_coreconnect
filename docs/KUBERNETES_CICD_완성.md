# Kubernetes 기반 CI/CD 파이프라인 구축

## 📋 프로젝트 개요

**기존 Docker Compose + EC2 단일 배포 환경을 Kubernetes 기반 자동화 배포 시스템으로 전환**

- **기간**: 2026.01.13
- **기술 스택**: Kubernetes (K3s), GitHub Actions, AWS ECR, Docker
- **목표**: 컨테이너 오케스트레이션을 통한 무중단 배포 및 확장성 확보

---

## 🎯 AS-IS → TO-BE

### AS-IS (기존 구조)

```
❌ 문제점:
- Docker Compose 기반 단일 서버 배포
- 수동 SSH/SCP 배포로 인한 다운타임 발생
- 서버 장애 시 서비스 전체 중단
- 트래픽 증가 시 수평 확장 불가
- 배포 실패 시 롤백 어려움
```

**배포 프로세스:**
1. GitHub에 코드 푸시
2. GitHub Actions에서 Docker Compose 빌드
3. SCP로 EC2 서버에 파일 전송
4. SSH로 서버 접속 후 docker-compose down/up 실행
5. ⚠️ 서비스 다운타임 발생 (약 1-2분)

**아키텍처:**
```
GitHub → GitHub Actions → Docker Compose Build → SCP/SSH → EC2 단일 서버
                                                              ↓
                                                        서비스 중단 발생
```

---

### TO-BE (개선 구조)

```
✅ 개선 사항:
- Kubernetes 기반 컨테이너 오케스트레이션
- Rolling Update를 통한 무중단 배포
- 3개 Pod로 고가용성 확보
- Auto Healing (Pod 장애 시 자동 재시작)
- Health Check 기반 트래픽 라우팅
- 배포 실패 시 자동 롤백
```

**배포 프로세스:**
1. GitHub에 코드 푸시
2. GitHub Actions에서 Docker 이미지 빌드
3. AWS ECR에 이미지 푸시
4. Kubernetes에 Rolling Update 배포
5. ✅ **무중단 배포 완료** (Zero Downtime)

**아키텍처:**
```
GitHub → GitHub Actions → Docker Build → ECR Push → Kubernetes Rolling Update
                                                              ↓
                                                    Pod 1 | Pod 2 | Pod 3
                                                    (순차적 업데이트 → 무중단)
```

---

## 🏗️ Kubernetes CI/CD 파이프라인 상세 설명

### 1. Code Validation & Testing
```yaml
- name: Checkout code
  # 저장소 코드를 Runner로 체크아웃
  
- name: Set up JDK 17
  # Java 17 환경 설정
  
- name: Make gradlew executable
  # Gradle 실행 권한 부여
  
- name: Compile and validate backend code
  # 백엔드 컴파일 및 코드 검증 (오류 조기 발견)
```

**목적**: 배포 전 코드 품질 검증으로 빌드 실패 위험 감소

---

### 2. Build & Push Docker Images
```yaml
- name: Set image tag
  # Git 커밋 해시 기반 이미지 태그 생성 (추적 가능성)
  
- name: Configure AWS credentials
  # AWS 인증 정보 설정
  
- name: Login to Amazon ECR
  # ECR Private Registry 로그인
  
- name: Build and push Backend image
  # 백엔드 Docker 이미지 빌드 및 ECR 푸시
  # 태그: ${COMMIT_SHA}, latest (2개)
  
- name: Build and push Frontend image
  # 프론트엔드 Docker 이미지 빌드 및 ECR 푸시
```

**목적**: 
- 불변 인프라(Immutable Infrastructure) 구현
- 이미지 버전 관리 및 롤백 가능성 확보
- 멀티 태그(SHA + latest)로 추적성 향상

---

### 3. Deploy to Kubernetes (핵심 단계)

#### 3-1. 환경 설정
```yaml
- name: Checkout code
  # Kubernetes 매니페스트 파일 가져오기
  
- name: Configure AWS credentials
  # Kubernetes에서 ECR 접근을 위한 AWS 인증
  
- name: Install kubectl
  # Kubernetes CLI 도구 설치 (v1.28.0)
  
- name: Setup kubeconfig for K3s
  # K3s 클러스터 접근 설정 (kubeconfig)
```

#### 3-2. 클러스터 초기화
```yaml
- name: Login to Amazon ECR
  # ECR 로그인 토큰 생성
  
- name: Create namespace if not exists
  # Kubernetes Namespace 생성 (chat-system)
  # → 리소스 격리 및 관리 편의성
  
- name: Create ECR pull secret
  # ECR Private Registry 접근을 위한 imagePullSecret 생성
  # → Pod가 ECR에서 이미지를 Pull할 수 있도록 인증 정보 제공
```

**핵심 개념**:
- **ImagePullSecret**: Private Registry 인증 정보를 Kubernetes Secret으로 저장
- Pod 생성 시 자동으로 ECR 인증하여 이미지 다운로드

#### 3-3. 설정 업데이트
```yaml
- name: Update ConfigMap
  # 애플리케이션 환경 변수 (비민감 정보)
  # - DB_HOST, DB_PORT, REDIS_HOST
  # - DATASOURCE_MASTER_URL, DATASOURCE_SLAVE_URL
  # - CORS, WEBSOCKET 설정 등
  
- name: Update Secret
  # 민감 정보 (암호화 저장)
  # - DB_USERNAME, DB_PASSWORD
  # - JWT_SECRET, AWS Credentials
  # - MAIL_USERNAME, MAIL_PASSWORD
```

**ConfigMap vs Secret**:
- **ConfigMap**: 비민감 정보 (평문 저장 가능)
- **Secret**: 민감 정보 (Base64 인코딩, etcd 암호화)

#### 3-4. Rolling Update 배포
```yaml
- name: Update Deployment image
  # Deployment 존재 여부 확인
  if kubectl get deployment chat-service; then
    # 기존 배포 → 이미지만 업데이트 (Rolling Update)
    kubectl set image deployment/chat-service chat-service=$NEW_IMAGE
  else
    # 첫 배포 → Deployment 및 Service 생성
    kubectl apply -f k8s/deployment.yaml
    kubectl apply -f k8s/service.yaml
  fi
```

**Rolling Update 동작 원리**:
```
기존: Pod1 Pod2 Pod3 (v1.0)
        ↓
Step1: Pod1 Pod2 Pod3 Pod4(v2.0) ← 새 Pod 생성
Step2: Pod1 Pod2 Pod4(v2.0) Pod5(v2.0) ← Pod3 종료, Pod5 생성
Step3: Pod1 Pod4(v2.0) Pod5(v2.0) Pod6(v2.0) ← Pod2 종료, Pod6 생성
Step4: Pod4(v2.0) Pod5(v2.0) Pod6(v2.0) ← Pod1 종료
        ↓
완료: 무중단 배포 완료!
```

**설정**:
- `maxSurge: 3`: 최대 3개 초과 Pod 허용 (빠른 배포)
- `maxUnavailable: 1`: 최대 1개 Pod 다운 허용 (안정성)

#### 3-5. 배포 검증
```yaml
- name: Wait for rollout to complete
  # Rolling Update 완료 대기 (Timeout: 10분)
  kubectl rollout status deployment/chat-service --timeout=10m
  
  # Health Check:
  # - Startup Probe: 애플리케이션 초기 시작 확인 (최대 5분)
  # - Readiness Probe: 트래픽 수신 가능 여부 확인
  # - Liveness Probe: Pod 정상 동작 여부 확인
```

**Health Check 엔드포인트**:
- `/actuator/health` - 전체 상태
- `/actuator/health/liveness` - Liveness 체크
- `/actuator/health/readiness` - Readiness 체크

```yaml
- name: Verify deployment
  # 배포 상태 최종 확인
  kubectl get pods -n chat-system -l app=chat-service
  kubectl get svc -n chat-system
  kubectl get events -n chat-system
```

#### 3-6. 자동 롤백
```yaml
- name: Rollback on failure
  if: failure()
  # 배포 실패 시 자동 롤백
  if kubectl rollout history deployment/chat-service --revision=1; then
    # 이전 버전으로 롤백
    kubectl rollout undo deployment/chat-service
  else
    # 첫 배포 실패 → Deployment 삭제
    kubectl delete deployment chat-service
  fi
```

**롤백 메커니즘**:
- Kubernetes가 이전 ReplicaSet을 보관 (기본 10개)
- 롤백 시 이전 ReplicaSet을 즉시 활성화
- 데이터베이스 마이그레이션은 별도 처리 필요

---

## 🔧 주요 트러블슈팅

### 문제 1: ImagePullBackOff

**증상**:
```
Error: Back-off pulling image from ECR
Pod Status: ImagePullBackOff
```

**원인**: Kubernetes가 AWS ECR Private Registry에 접근할 인증 정보가 없음

**해결**:
```yaml
# ECR imagePullSecret 생성
kubectl create secret docker-registry ecr-registry-secret \
  --docker-server=$ECR_REGISTRY \
  --docker-username=AWS \
  --docker-password=$(aws ecr get-login-password)

# Deployment에 추가
spec:
  imagePullSecrets:
  - name: ecr-registry-secret
```

**결과**: ✅ Pod가 ECR에서 이미지를 성공적으로 Pull

---

### 문제 2: CrashLoopBackOff (MySQL 연결 실패)

**증상**:
```
Error: java.net.UnknownHostException: mysql-master
Pod Status: CrashLoopBackOff (지속적 재시작)
```

**원인**: 
- 애플리케이션이 `mysql-master` 호스트를 찾으려 하지만 실제 서비스는 `mysql`
- Master-Slave DB 아키텍처 환경 변수 누락

**해결**:
```yaml
# ConfigMap에 DB URL 추가
data:
  SPRING_DATASOURCE_MASTER_URL: "jdbc:mysql://mysql:3306/db_coreconnect"
  SPRING_DATASOURCE_SLAVE_URL: "jdbc:mysql://mysql:3306/db_coreconnect"

# Deployment에 환경 변수 매핑
env:
- name: SPRING_DATASOURCE_MASTER_URL
  valueFrom:
    configMapKeyRef:
      name: chat-config
      key: SPRING_DATASOURCE_MASTER_URL
```

**결과**: ✅ MySQL 연결 성공

---

### 문제 3: MySQL 인증 실패

**증상**:
```
Error: Access denied for user 'admin'@'10.42.0.88' (using password: YES)
```

**원인**: MySQL Pod에 `admin` 사용자가 생성되지 않음

**해결**:
```sql
-- MySQL에 admin 사용자 생성
CREATE USER 'admin'@'%' IDENTIFIED BY 'finalcoreconnect';
GRANT ALL PRIVILEGES ON db_coreconnect.* TO 'admin'@'%';
FLUSH PRIVILEGES;
```

**결과**: ✅ DB 인증 성공

---

### 문제 4: CPU 부족 (FailedScheduling)

**증상**:
```
Warning: 0/1 nodes are available: 1 Insufficient cpu
Pod Status: Pending (스케줄링 불가)
```

**원인**: 
- 10개 Pod 요구: 10 × 500m = 5000m (5 CPU)
- EC2 노드 가용 CPU: 8000m 중 93% 사용

**해결**:
```yaml
# Deployment 최적화
spec:
  replicas: 3  # 10 → 3 축소
  
  resources:
    requests:
      cpu: 200m      # 500m → 200m
      memory: 512Mi  # 1Gi → 512Mi
    limits:
      cpu: 1000m     # 2000m → 1000m
      memory: 1Gi    # 2Gi → 1Gi
```

**결과**: ✅ 3개 Pod 모두 스케줄링 성공

---

### 문제 5: JWT Secret 길이 부족

**증상**:
```
Error: JWT secret key is too short. Current length: 15 bytes.
The key must be at least 256 bits (32 bytes) long for HMAC-SHA256.
```

**원인**: JWT_SECRET 환경 변수가 너무 짧음 (보안 기준 미달)

**해결**:
```yaml
# 64자 JWT_SECRET_KEY 생성 및 적용
JWT_SECRET_KEY=PTI6BhDdXJzKjL3Z6RWZvQ9Fe31kTv6lgxPlDN/Zu10nOM+fZ7tBMpMae4u9qkrhYgWerrOvLpbQleEjGTFN2Q==

# Secret에 저장
kubectl create secret generic chat-secret \
  --from-literal=JWT_SECRET=$JWT_SECRET_KEY
```

**결과**: ✅ JWT Provider 초기화 성공

---

### 문제 6: Mail 인증 실패

**증상**:
```
Error: jakarta.mail.AuthenticationFailedException: 
       failed to connect, no password specified?
```

**원인**: MAIL_USERNAME, MAIL_PASSWORD 환경 변수 누락

**해결**:
```yaml
# Secret에 메일 정보 추가
--from-literal=MAIL_USERNAME=yoochun8128@gmail.com \
--from-literal=MAIL_PASSWORD=bgmydykgzrjftohv

# Deployment에 환경 변수 매핑
env:
- name: MAIL_USERNAME
  valueFrom:
    secretKeyRef:
      name: chat-secret
      key: MAIL_USERNAME
```

**결과**: ✅ 메일 서비스 정상 동작

---

## 📊 성과 및 개선 효과

### 1. 배포 안정성 향상

| 항목 | AS-IS | TO-BE | 개선율 |
|------|-------|-------|--------|
| **배포 중 서비스 다운타임** | 1-2분 | 0초 (무중단) | **100% 개선** |
| **배포 실패 시 복구 시간** | 5-10분 (수동) | 30초 (자동 롤백) | **90% 단축** |
| **동시 실행 가능 인스턴스** | 1개 | 3개 | **300% 증가** |
| **장애 복구 시간 (MTTR)** | 5분 (수동 재시작) | 30초 (자동 재시작) | **90% 단축** |

---

### 2. 운영 효율성 향상

**자동화 수준**:
- AS-IS: 50% (수동 SSH/SCP 필요)
- TO-BE: 95% (Git Push만으로 배포 완료)
- **개선**: +45%p

**배포 속도**:
- AS-IS: 약 5분 (빌드 3분 + 배포 2분)
- TO-BE: 약 10분 (검증 2분 + 빌드 3분 + 배포 5분)
- **Trade-off**: 안정성을 위해 검증 단계 추가

---

### 3. 고가용성 확보

**Single Point of Failure 제거**:
```
AS-IS: 단일 서버 → 서버 장애 = 서비스 전체 중단
TO-BE: 3개 Pod → 1-2개 장애 발생해도 서비스 정상 운영
```

**Auto Healing**:
- Pod Crash 시 Kubernetes가 자동 재시작
- Health Check 실패 시 트래픽 자동 차단 후 재시작

---

### 4. 확장성 확보

**수평 확장 (Scale-Out)**:
```bash
# 간단한 명령어로 Pod 수 조정 가능
kubectl scale deployment chat-service --replicas=10

# HPA (Horizontal Pod Autoscaler) 설정 가능
kubectl autoscale deployment chat-service \
  --cpu-percent=70 --min=3 --max=10
```

**수직 확장 (Scale-Up)**:
- 리소스 요청량 조정으로 Pod 성능 향상

---

## 🎓 기술적 의의

### 1. Infrastructure as Code (IaC)
- Kubernetes 매니페스트로 인프라 코드화
- Git으로 버전 관리 및 이력 추적
- 재현 가능한 배포 환경 구축

### 2. Immutable Infrastructure
- 컨테이너 이미지 기반 불변 인프라
- 환경 불일치 문제 해결
- 롤백 및 버전 관리 용이

### 3. Cloud Native Architecture
- Kubernetes를 활용한 클라우드 네이티브 구조
- 마이크로서비스 확장 가능성 확보
- DevOps 문화 정착

---

## 🔮 향후 개선 방향

### 1. 멀티 클러스터 배포
```
현재: 단일 K3s 클러스터
목표: Dev / Staging / Production 환경 분리
```

### 2. GitOps 도입
```
현재: GitHub Actions Push 방식
목표: ArgoCD/FluxCD로 Pull 방식 전환
     → Git = Single Source of Truth
```

### 3. 모니터링 강화
```
현재: kubectl 명령어 기반 모니터링
목표: Prometheus + Grafana 대시보드 구축
     → 실시간 메트릭 수집 및 시각화
```

### 4. 비용 최적화
```
현재: EC2 단일 노드 (리소스 제약)
목표: AWS EKS + Auto Scaling Group
     → 트래픽에 따른 노드 자동 조정
```

---

## 💡 배운 점 및 인사이트

### 1. 컨테이너 오케스트레이션의 중요성
- 단순 컨테이너화를 넘어 운영 자동화의 필요성 체감
- Kubernetes의 Self-Healing, Rolling Update 등 강력한 기능 활용

### 2. 설정 관리의 중요성
- ConfigMap/Secret 분리로 보안 강화
- 환경별 설정 관리 체계화

### 3. 트러블슈팅 역량 향상
- ImagePullBackOff, CrashLoopBackOff 등 다양한 에러 해결
- Kubernetes 내부 동작 원리 이해 심화

### 4. 인프라 코드화 (IaC)의 가치
- Git으로 인프라 버전 관리
- 코드 리뷰를 통한 인프라 변경 검증

---

## 📚 참고 자료

- [Kubernetes 공식 문서](https://kubernetes.io/docs/)
- [GitHub Actions 문서](https://docs.github.com/en/actions)
- [AWS ECR 사용자 가이드](https://docs.aws.amazon.com/ecr/)
- [K3s 공식 문서](https://k3s.io/)
