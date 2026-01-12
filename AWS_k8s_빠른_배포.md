# ⚡ AWS k8s 서버 빠른 생성 & 배포

## 🎯 목표
**새 k3s 서버를 만들어서 바로 배포!**

---

## 🚀 방법 1: AWS Console (가장 빠름! 10분)

### Step 1: EC2 인스턴스 생성 (3분)

#### 1. AWS Console 로그인
https://console.aws.amazon.com/ec2/

#### 2. 인스턴스 시작 클릭
```
EC2 대시보드 → 인스턴스 → 인스턴스 시작
```

#### 3. 설정

**이름 및 태그:**
```
이름: coreconnect-k3s-server
```

**Application and OS Images (AMI):**
```
Amazon Linux 2 AMI (HVM) - Kernel 5.10
(무료 티어 가능)
```

**인스턴스 유형:**
```
개발/테스트: t3.small
프로덕션: t3.medium 또는 t3.large

추천: t3.medium (2 vCPU, 4GB RAM) - $30/월
```

**키 페어:**
```
- 기존 키 있으면: 선택
- 없으면: "새 키 페어 생성" 클릭
  - 이름: coreconnect-key
  - 유형: RSA
  - 형식: .pem
  - 다운로드! (중요!)
```

**네트워크 설정:**
```
"편집" 클릭

✅ Auto-assign public IP: 활성화

보안 그룹 규칙:
1. SSH (22) - 소스: 내 IP
2. HTTP (80) - 소스: 0.0.0.0/0
3. HTTPS (443) - 소스: 0.0.0.0/0
4. Custom TCP (6443) - 소스: 내 IP (k3s API)
5. Custom TCP (6379) - 소스: 내 IP (Redis, 선택)
6. Custom TCP (3306) - 소스: 내 IP (MySQL, 선택)
```

**스토리지 구성:**
```
30 GB gp3
```

#### 4. 인스턴스 시작!

**Public IP 확인:**
```
인스턴스 선택 → 세부 정보 → 퍼블릭 IPv4 주소 복사
```

---

### Step 2: SSH 접속 (1분)

#### Windows (PowerShell 또는 Git Bash)

```bash
# 키 파일 권한 설정 (PowerShell, 한 번만)
icacls coreconnect-key.pem /reset
icacls coreconnect-key.pem /grant:r "%username%:(R)"
icacls coreconnect-key.pem /inheritance:r

# SSH 접속
ssh -i coreconnect-key.pem ec2-user@<PUBLIC_IP>
```

#### 접속 확인
```bash
# 성공하면 프롬프트 변경됨
[ec2-user@ip-xxx-xxx-xxx-xxx ~]$
```

---

### Step 3: k3s 설치 (1분)

```bash
# k3s 설치 (자동)
curl -sfL https://get.k3s.io | sh -

# 대기 (30초)
sleep 30

# 확인
sudo systemctl status k3s
sudo kubectl get nodes

# 출력 예시:
# NAME                          STATUS   ROLES                  AGE   VERSION
# ip-xxx-xxx-xxx-xxx.ec2.internal   Ready    control-plane,master   30s   v1.28.5+k3s1
```

**✅ k3s 설치 완료!**

---

### Step 4: Git 저장소 클론 (1분)

```bash
# Git 설치 확인
git --version

# 없으면 설치
sudo yum install -y git

# 저장소 클론
git clone https://github.com/your-username/final_project_coreconnect.git
cd final_project_coreconnect
```

---

### Step 5: Docker 이미지 준비 (2가지 방법)

#### 방법 A: Docker Hub 사용 (추천!)

**로컬 PC에서:**
```bash
# 로그인
docker login

# 이미지 빌드 & 푸시
cd backend
docker build -t your-dockerhub-id/chat-server:latest .
docker push your-dockerhub-id/chat-server:latest
```

**k8s yaml 파일 수정:**
```bash
# k8s/03-chat-server-dev.yaml
vim k8s/03-chat-server-dev.yaml

# 이미지 경로 변경
image: your-dockerhub-id/chat-server:latest
imagePullPolicy: Always  # Never → Always
```

#### 방법 B: 로컬 빌드 (빠름, 간단)

```bash
# Docker 설치
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# 재접속
exit
ssh -i coreconnect-key.pem ec2-user@<PUBLIC_IP>

# 이미지 빌드
cd final_project_coreconnect/backend
sudo docker build -t chat-server:latest .

# k3s가 Docker 이미지 사용하도록
sudo ctr images import chat-server:latest
```

---

### Step 6: k8s 배포 (2분)

```bash
cd ~/final_project_coreconnect

# Namespace 생성
sudo kubectl apply -f k8s/00-namespace.yaml

# MySQL 배포
sudo kubectl apply -f k8s/01-mysql.yaml

# MySQL 준비 대기 (1분)
sudo kubectl wait --for=condition=ready pod -l app=mysql -n chat-system --timeout=120s

# Redis 배포
sudo kubectl apply -f k8s/02-redis.yaml

# Redis 준비 대기 (30초)
sudo kubectl wait --for=condition=ready pod -l app=redis -n chat-system --timeout=60s

# 채팅 서버 배포 (개발용 또는 프로덕션용)
sudo kubectl apply -f k8s/03-chat-server-dev.yaml

# 상태 확인
sudo kubectl get pods -n chat-system -w
```

**대기 (2-3분):**
```
NAME                           READY   STATUS    RESTARTS   AGE
mysql-xxx                      1/1     Running   0          2m
redis-xxx                      1/1     Running   0          1m
chat-server-xxx-xxx           1/1     Running   0          30s
chat-server-xxx-yyy           1/1     Running   0          30s
```

**✅ 모든 Pod가 Running이면 배포 완료!**

---

### Step 7: 접속 확인 (1분)

```bash
# LoadBalancer External IP 확인
sudo kubectl get svc -n chat-system

# 출력:
# NAME           TYPE           CLUSTER-IP      EXTERNAL-IP   PORT(S)        AGE
# chat-service   LoadBalancer   10.43.xxx.xxx   <pending>     80:30080/TCP   1m
```

**k3s의 LoadBalancer:**
- k3s는 자체 LoadBalancer 지원
- External IP 대신 NodePort 사용
- 접속: http://<PUBLIC_IP>:30080

**또는 포트포워딩:**
```bash
sudo kubectl port-forward svc/chat-service 80:80 -n chat-system --address=0.0.0.0
```

**접속 테스트:**
```bash
# 서버에서
curl http://localhost:80/actuator/health

# 로컬 PC에서
curl http://<PUBLIC_IP>/actuator/health
# 또는 브라우저에서 http://<PUBLIC_IP>
```

**✅ 배포 완료!** 🎉

---

## 🚀 방법 2: Terraform (자동화)

나중에 자동화하고 싶으면 Terraform 사용!

---

## 🔧 트러블슈팅

### 문제 1: SSH 접속 안 됨

```bash
# 키 파일 권한 확인
ls -la coreconnect-key.pem
# -r-------- 또는 400이어야 함

# 권한 수정
chmod 400 coreconnect-key.pem

# 보안 그룹 확인
# AWS Console → EC2 → 보안 그룹
# 인바운드: 22번 포트 열림?
```

### 문제 2: k3s 설치 실패

```bash
# 로그 확인
sudo journalctl -u k3s -n 50

# 재설치
sudo /usr/local/bin/k3s-uninstall.sh
curl -sfL https://get.k3s.io | sh -
```

### 문제 3: Pod가 ImagePullBackOff

```bash
# 로그 확인
sudo kubectl describe pod <pod-name> -n chat-system

# 원인: Docker Hub에 이미지 없음
# 해결: 이미지 빌드 & 푸시
# 또는 imagePullPolicy: Never로 변경
```

### 문제 4: Pod가 CrashLoopBackOff

```bash
# 로그 확인
sudo kubectl logs <pod-name> -n chat-system

# 일반적 원인:
# - DB 연결 실패 (MySQL 준비 안 됨)
# - 환경 변수 오류
# - 메모리 부족

# MySQL 확인
sudo kubectl get pods -n chat-system | grep mysql

# 로그 상세
sudo kubectl logs <pod-name> -n chat-system --previous
```

### 문제 5: 외부 접속 안 됨

```bash
# 보안 그룹 확인
# 80, 443 포트 0.0.0.0/0 열림?

# Service 확인
sudo kubectl get svc -n chat-system

# NodePort 확인
# 예: 80:30080/TCP → http://<PUBLIC_IP>:30080

# 포트포워딩 (임시)
sudo kubectl port-forward svc/chat-service 80:80 -n chat-system --address=0.0.0.0 &
```

---

## 📊 배포 확인 체크리스트

### ✅ 인프라

- [ ] EC2 인스턴스 실행 중
- [ ] Public IP 할당됨
- [ ] 보안 그룹 설정 완료
- [ ] SSH 접속 가능

### ✅ k3s

- [ ] k3s 설치됨 (`sudo systemctl status k3s`)
- [ ] kubectl 작동 (`sudo kubectl get nodes`)
- [ ] 노드 Ready 상태

### ✅ 애플리케이션

- [ ] Namespace 생성됨
- [ ] MySQL Pod Running
- [ ] Redis Pod Running
- [ ] Chat Server Pods Running
- [ ] 모든 Pod Ready (1/1)

### ✅ 접속

- [ ] Health Check 성공
- [ ] 외부 접속 가능
- [ ] API 테스트 성공

---

## 💰 비용

### 개발/테스트 (t3.small)
```
인스턴스: $0.0208/시간
= $15/월 (항상 켜둘 경우)

필요시만:
= 주 10시간 × 4주 = $0.83/월
```

### 프로덕션 (t3.medium)
```
인스턴스: $0.0416/시간
= $30/월

또는 Reserved Instance:
= $18/월 (1년 약정시)
```

### 추가 비용
```
EBS: $3-10/월
네트워크: $5-10/월 (트래픽 따라)
총: $35-50/월
```

---

## 🎯 추천 전략

### 개발/테스트
```
t3.small + 필요시에만 시작
= $1-5/월
```

### 프로덕션
```
t3.medium + Reserved Instance
= $20-30/월
```

---

## 🚀 다음 단계

### 1. 배포 완료 후
```bash
# k6 부하 테스트
k6 run --vus 10000 k6-chatroom-performance-test.js

# 모니터링 설정
sudo kubectl apply -f k8s/monitoring/
```

### 2. 도메인 연결 (선택)
```bash
# Route 53에서 도메인 설정
# A 레코드: your-domain.com → <PUBLIC_IP>
```

### 3. HTTPS 설정 (선택)
```bash
# Let's Encrypt 인증서
sudo yum install -y certbot
sudo certbot certonly --standalone -d your-domain.com
```

---

## ✅ 완료!

**10분 안에 배포 완료!** 🎉

접속: http://<PUBLIC_IP>

---

**문제 있으면 바로 물어보세요!** 😊
