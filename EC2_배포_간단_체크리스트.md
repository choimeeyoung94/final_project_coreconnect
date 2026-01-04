# EC2 배포 간단 체크리스트 ✅

## 📌 현재 상황
- ✅ nginx.conf Git에 푸시 완료
- ✅ docker-compose.yml 완벽하게 구성됨
- ✅ 모든 스크립트 준비 완료

## 🚀 EC2 배포 방법 (3단계!)

### Step 1: EC2에서 Docker 설치 (1회만)

```bash
# EC2 SSH 접속
ssh -i your-key.pem ubuntu@your-ec2-ip

# Docker 설치
sudo apt update
sudo apt install -y docker.io docker-compose
sudo systemctl start docker
sudo usermod -aG docker ubuntu

# 재접속 (그룹 권한 적용)
exit
ssh -i your-key.pem ubuntu@your-ec2-ip
```

### Step 2: 프로젝트 배포

```bash
# 프로젝트 클론 (또는 git pull)
git clone https://github.com/choimeeyoung94/final_project_coreconnect.git
cd final_project_coreconnect

# 또는 기존 프로젝트 업데이트
cd final_project_coreconnect
git pull origin main
```

### Step 3: 실행!

```bash
# 환경 변수 설정 (선택)
export MYSQL_ROOT_PASSWORD="YourSecurePassword123!"
export GF_ADMIN_PASSWORD="admin123"

# 전체 클러스터 시작 (10대 서버 + Nginx + Redis + MySQL)
docker-compose up -d

# 또는
bash start-cluster.sh

# 상태 확인
docker ps
bash health-check.sh
```

## 🔍 배포 후 확인사항

### 1. 서비스 확인
```bash
# Nginx 로드 밸런서
curl http://localhost/health
curl http://your-ec2-ip/health

# 10대 서버 헬스체크
curl http://localhost:8081/actuator/health  # 서버 #1
curl http://localhost:8090/actuator/health  # 서버 #10

# 로드 밸런싱 테스트
for i in {1..10}; do
  curl -s http://localhost/api/chatrooms | jq -r '.serverId'
done
```

### 2. 로그 확인
```bash
# 전체 로그
docker-compose logs -f

# Nginx 로그만
docker-compose logs -f nginx

# 특정 서버 로그
docker-compose logs -f chat-app-1
```

### 3. 모니터링
- Grafana: http://your-ec2-ip:3000
- Prometheus: http://your-ec2-ip:9090
- Redis Commander: http://your-ec2-ip:8081

## 🔧 EC2 인스턴스 스펙 권장사항

### 최소 스펙 (10대 서버 실행)
- **인스턴스 타입**: `t3.2xlarge` 이상
- **CPU**: 8 vCPU
- **메모리**: 32GB RAM
- **스토리지**: 100GB SSD

### 권장 스펙 (프로덕션)
- **인스턴스 타입**: `c5.4xlarge` 이상
- **CPU**: 16 vCPU
- **메모리**: 64GB RAM
- **스토리지**: 200GB SSD

### 비용 절감 옵션
한 대씩 테스트하려면:
```bash
# 서버 1대만 실행
docker-compose up -d nginx redis-pubsub redis-session mysql-master chat-app-1

# 서버 3대만 실행
docker-compose up -d nginx redis-pubsub redis-session mysql-master \
  chat-app-1 chat-app-2 chat-app-3
```

## 🛡️ 보안 설정 (중요!)

### EC2 보안 그룹 설정
```
인바운드 규칙:
- HTTP (80): 0.0.0.0/0
- HTTPS (443): 0.0.0.0/0
- SSH (22): Your IP Only
- 8081-8090: Your IP Only (개발 시에만)
- 3000 (Grafana): Your IP Only
- 9090 (Prometheus): Your IP Only
```

### 환경 변수 보안
```bash
# .env 파일 생성 (gitignore에 포함됨)
cat > .env << EOF
MYSQL_ROOT_PASSWORD=YourVerySecurePassword123!
MYSQL_REPLICATION_PASSWORD=ReplicationPassword456!
GF_ADMIN_PASSWORD=GrafanaPassword789!
REDIS_COMMANDER_PASSWORD=RedisPassword012!
EOF

# .env 파일 권한 제한
chmod 600 .env
```

## 📊 부하 테스트

```bash
# K6 부하 테스트 (로컬에서 EC2로)
k6 run --vus 10000 --duration 5m k6-chatroom-performance-test.js

# 또는 K6 Cloud
k6 cloud run k6-chatroom-performance-test.js
```

## 🔄 업데이트 방법

```bash
# 코드 업데이트
git pull origin main

# 컨테이너 재시작 (다운타임 없음)
docker-compose up -d --build

# 또는 개별 재시작
docker-compose up -d --build chat-app-1
```

## 🛑 중지 방법

```bash
# 전체 중지
docker-compose down

# 또는
bash stop-cluster.sh

# 데이터도 함께 삭제
docker-compose down -v
```

## ✅ 최종 체크리스트

배포 전 확인:
- [ ] EC2 인스턴스 생성 (충분한 스펙)
- [ ] 보안 그룹 설정 (포트 개방)
- [ ] Docker & Docker Compose 설치
- [ ] Git 저장소 클론
- [ ] 환경 변수 설정 (.env)
- [ ] docker-compose up -d 실행
- [ ] 헬스체크 통과 확인
- [ ] 부하 테스트 실행
- [ ] 모니터링 대시보드 확인

배포 후 확인:
- [ ] Nginx 로드 밸런싱 동작 확인
- [ ] 10대 서버 모두 정상 작동
- [ ] Redis Pub/Sub 메시지 동기화 확인
- [ ] MySQL Replication 동작 확인
- [ ] Grafana 모니터링 정상
- [ ] WebSocket 연결 테스트
- [ ] 실제 채팅 기능 테스트

---

## 💡 TIP: 로컬에서 먼저 테스트!

EC2 배포 전에 로컬에서 먼저 테스트하세요:

```bash
# 로컬에서 실행
cd c:\dev\final_project_coreconnect
docker-compose up -d

# 테스트
curl http://localhost/health

# 문제없으면 EC2에 배포
```


















