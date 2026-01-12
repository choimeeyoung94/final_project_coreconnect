# 🚀 EC2 배포 가이드 - Redis 설치 여부

## 📋 배포 방법에 따른 Redis 설치 여부

### 시나리오 1: Docker Compose 사용 (권장!) ✅

**Redis 설치 불필요!**

```bash
# EC2에서 필요한 것
✅ Docker
✅ Docker Compose

# 불필요한 것
❌ Redis 직접 설치 (컨테이너로 실행됨)
❌ MySQL 직접 설치 (컨테이너로 실행됨)
```

---

### 시나리오 2: JAR 직접 배포 ❌

**Redis 설치 필요!**

```bash
# EC2에서 필요한 것
✅ Java 17+
✅ Redis 설치
✅ MySQL 설치

# Spring Boot JAR 직접 실행
java -jar backend/build/libs/*.jar
```

---

## 🔍 현재 EC2 상황 확인하기

### EC2에 SSH 접속 후 실행

```bash
# 1. Docker 설치 확인
docker --version

# 2. Docker Compose 설치 확인
docker-compose --version

# 3. Redis 설치 확인 (직접 설치 시)
redis-cli --version
systemctl status redis

# 4. 현재 실행 방법 확인
# Docker 사용 중인가?
docker ps

# JAR 직접 실행 중인가?
ps aux | grep java
```

---

## 📝 상황별 해결 방법

### Case 1: Docker Compose 사용 (권장!)

#### ✅ 장점
- Redis, MySQL 등 자동으로 컨테이너로 실행
- 한 번에 전체 인프라 구성
- 로컬과 동일한 환경
- 쉬운 관리 (start/stop 스크립트)

#### 📦 EC2 설정 (Ubuntu 기준)

```bash
# 1. EC2 SSH 접속
ssh -i your-key.pem ubuntu@your-ec2-ip

# 2. Docker 설치
sudo apt update
sudo apt install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ubuntu

# 3. Docker Compose 설치
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 4. 재접속 (그룹 권한 적용)
exit
ssh -i your-key.pem ubuntu@your-ec2-ip

# 5. 프로젝트 클론
git clone https://github.com/your-repo/final_project_coreconnect.git
cd final_project_coreconnect

# 6. 환경 변수 설정
cp 환경변수_설정.txt .env
nano .env  # 비밀번호 수정

# 7. 클러스터 시작
chmod +x start-cluster.sh
./start-cluster.sh

# 8. 확인
curl http://localhost:80/health
docker ps
```

#### 🔥 포트 오픈 (AWS Security Group)

```
인바운드 규칙:
- 80 (HTTP): 0.0.0.0/0
- 443 (HTTPS): 0.0.0.0/0
- 3000 (Grafana): 0.0.0.0/0 (또는 특정 IP)
- 9090 (Prometheus): 0.0.0.0/0 (또는 특정 IP)

내부 포트 (보안):
- 6379 (Redis): VPC 내부만
- 3306 (MySQL): VPC 내부만
- 8081-8090 (Spring Boot): VPC 내부만
```

---

### Case 2: Redis 직접 설치 (Docker 사용 안 할 경우)

#### EC2에 Redis 설치

```bash
# 1. Redis 설치 (Ubuntu)
sudo apt update
sudo apt install -y redis-server

# 2. Redis 설정
sudo nano /etc/redis/redis.conf

# 다음 설정 변경:
# bind 127.0.0.1 ::1  →  bind 0.0.0.0
# supervised no  →  supervised systemd
# maxmemory 2gb 추가
# maxmemory-policy allkeys-lru 추가

# 3. Redis 시작
sudo systemctl restart redis-server
sudo systemctl enable redis-server

# 4. 확인
redis-cli ping
# 출력: PONG

# 5. 방화벽 설정 (보안 주의!)
sudo ufw allow 6379/tcp
```

#### application.yml 수정 (Spring Boot)

```yaml
spring:
  redis:
    host: localhost  # 또는 EC2 Private IP
    port: 6379
```

---

## 🎯 추천: Docker Compose 사용!

### 이유

1. **간편성**
   - Redis, MySQL 등 자동 설치
   - 한 줄 명령어로 전체 시작: `./start-cluster.sh`

2. **일관성**
   - 로컬 개발 환경과 동일
   - 버전 관리 용이

3. **확장성**
   - 10대 서버 스케일 아웃 지원
   - 로드 밸런싱, 모니터링 자동 구성

4. **관리 용이**
   - 자동화 스크립트 제공
   - 헬스체크, 로그 관리

---

## 🔧 EC2 Docker Compose 배포 (완벽 가이드)

### 1단계: EC2 준비

```bash
# EC2 인스턴스 생성
인스턴스 타입: t3.2xlarge (8 vCPU, 32GB RAM) 이상
OS: Ubuntu 22.04 LTS
스토리지: 100GB
보안 그룹: 포트 80, 443 오픈
```

### 2단계: Docker 설치 스크립트

```bash
#!/bin/bash
# install-docker.sh

set -e

echo "🐳 Docker 설치 중..."

# Docker 설치
sudo apt update
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Docker 시작
sudo systemctl start docker
sudo systemctl enable docker

# 현재 사용자를 docker 그룹에 추가
sudo usermod -aG docker $USER

echo "✅ Docker 설치 완료: $(docker --version)"

# Docker Compose 설치
echo "🐳 Docker Compose 설치 중..."
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

echo "✅ Docker Compose 설치 완료: $(docker-compose --version)"

echo "⚠️  재로그인이 필요합니다!"
echo "   exit 후 다시 SSH 접속하세요."
```

### 3단계: 프로젝트 배포

```bash
# 1. 프로젝트 클론
git clone https://github.com/your-username/final_project_coreconnect.git
cd final_project_coreconnect

# 2. 환경 변수 설정
cp 환경변수_설정.txt .env
nano .env

# 비밀번호 변경:
MYSQL_ROOT_PASSWORD=YourSecurePassword123!
GF_ADMIN_PASSWORD=YourGrafanaPass456!

# 3. 스크립트 권한
chmod +x start-cluster.sh stop-cluster.sh health-check.sh

# 4. 클러스터 시작
./start-cluster.sh

# 5. 헬스체크
./health-check.sh

# 6. 확인
curl http://localhost:80/health
curl http://localhost:3000  # Grafana
```

### 4단계: 외부 접속 확인

```bash
# EC2 Public IP 확인
curl -4 ifconfig.me

# 브라우저에서 접속
http://your-ec2-public-ip
http://your-ec2-public-ip:3000  # Grafana
```

---

## 🆘 트러블슈팅

### 문제 1: Docker 권한 에러

```bash
# 증상
Got permission denied while trying to connect to the Docker daemon socket

# 해결
sudo usermod -aG docker $USER
exit  # 재접속
```

### 문제 2: 포트 충돌

```bash
# 증상
Bind for 0.0.0.0:80 failed: port is already allocated

# 해결
sudo lsof -i :80
sudo kill -9 [PID]
```

### 문제 3: 메모리 부족

```bash
# 증상
Cannot allocate memory

# 해결 1: 스왑 메모리 추가
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 해결 2: EC2 인스턴스 타입 업그레이드
# t3.2xlarge → t3.4xlarge
```

### 문제 4: Docker 컨테이너 시작 실패

```bash
# 로그 확인
docker-compose logs [service-name]

# 예시
docker-compose logs chat-app-1
docker-compose logs redis-pubsub
docker-compose logs mysql-master

# 재시작
docker-compose restart [service-name]
```

---

## 📊 성능 최적화 (EC2)

### EC2 인스턴스 타입 추천

| 동시 접속자 | 인스턴스 타입 | vCPU | RAM | 월 비용 (예상) |
|------------|--------------|------|-----|----------------|
| 10,000명 | t3.xlarge | 4 | 16GB | $120 |
| 50,000명 | t3.2xlarge | 8 | 32GB | $240 |
| 100,000명 | t3.4xlarge | 16 | 64GB | $480 |

### 모니터링 설정

```bash
# Grafana 접속
http://your-ec2-ip:3000
Username: admin
Password: admin123

# CloudWatch 연동 (선택 사항)
# AWS CloudWatch에서 EC2 메트릭 확인
- CPU 사용률
- 네트워크 In/Out
- 디스크 I/O
```

---

## 🔐 보안 설정 (프로덕션)

### 1. 비밀번호 강화

```bash
# .env 파일
MYSQL_ROOT_PASSWORD=$(openssl rand -base64 32)
MYSQL_REPLICATION_PASSWORD=$(openssl rand -base64 32)
GF_ADMIN_PASSWORD=$(openssl rand -base64 32)
```

### 2. 방화벽 설정

```bash
# UFW 활성화
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# 내부 포트는 차단 (외부 접근 불가)
# 6379 (Redis), 3306 (MySQL), 8081-8090 (Spring Boot)
```

### 3. SSL/TLS 설정

```bash
# Let's Encrypt 인증서
sudo apt install -y certbot
sudo certbot certonly --standalone -d your-domain.com

# nginx.conf에서 SSL 설정 활성화
# (서버_스케일_아웃_10대_구축_가이드.md 참고)
```

---

## ✅ 체크리스트

### EC2 배포 전
- [ ] EC2 인스턴스 생성 (t3.2xlarge 이상)
- [ ] 보안 그룹 설정 (포트 80, 443 오픈)
- [ ] 키 페어 다운로드
- [ ] Elastic IP 할당 (선택 사항)

### Docker 설치
- [ ] Docker 설치
- [ ] Docker Compose 설치
- [ ] 그룹 권한 설정 (usermod -aG docker)
- [ ] 재로그인

### 프로젝트 배포
- [ ] Git 클론
- [ ] .env 파일 설정
- [ ] 스크립트 권한 부여
- [ ] ./start-cluster.sh 실행
- [ ] 헬스체크 통과

### 확인
- [ ] http://ec2-ip:80/health 접속
- [ ] Grafana 접속 (3000)
- [ ] 로그 확인 (docker-compose logs)

---

## 🎯 결론

### ✅ Docker Compose 사용 시

```bash
# Redis 설치 불필요!
# Docker와 Docker Compose만 설치하면 끝!

sudo apt install -y docker.io docker-compose
./start-cluster.sh
```

### ❌ Docker 사용 안 할 시

```bash
# Redis, MySQL 등 모두 직접 설치 필요
sudo apt install -y redis-server mysql-server
# 복잡한 설정...
```

---

## 📞 문의

배포 중 문제가 발생하면:
1. `./health-check.sh` 실행
2. `docker-compose logs -f` 확인
3. GitHub Issues 생성

---

**추천: Docker Compose 사용! 🚀**

Redis 직접 설치 없이 한 번에 전체 인프라 구성 가능!



