# Kubernetes 배포 가이드

## 📋 파일 구성

```
k8s/
├── 00-namespace.yaml       # Namespace 생성
├── 01-mysql.yaml           # MySQL StatefulSet
├── 02-redis.yaml           # Redis Pub/Sub
├── 03-chat-server.yaml     # Chat Server (10 Pods)
├── 04-hpa.yaml             # Horizontal Pod Autoscaler
└── README.md               # 이 파일
```

## 🚀 빠른 시작

### 1. EC2에 K3s 설치 (1분)

```bash
# EC2 접속
ssh -i your-key.pem ubuntu@your-ec2-ip

# K3s 설치
curl -sfL https://get.k3s.io | sh -

# kubectl 단축키
echo "alias k='sudo k3s kubectl'" >> ~/.bashrc
source ~/.bashrc

# 확인
k get nodes
```

### 2. Docker 이미지 준비

```bash
# 프로젝트 클론
git clone https://github.com/choimeeyoung94/final_project_coreconnect.git
cd final_project_coreconnect

# 이미지 빌드
cd backend
docker build -t chat-server:latest .

# K3s에 import
docker save chat-server:latest | sudo k3s ctr images import -

# 확인
sudo k3s crictl images | grep chat-server
```

### 3. Kubernetes 배포 (1분)

```bash
# 전체 배포
k apply -f k8s/

# 출력:
# namespace/chat-system created
# statefulset.apps/mysql created
# service/mysql created
# deployment.apps/redis-pubsub created
# service/redis-pubsub created
# deployment.apps/chat-server created
# service/chat-service created
# horizontalpodautoscaler.autoscaling/chat-server-hpa created
```

### 4. 배포 확인

```bash
# Pod 확인 (10개 실행 중)
k get pods -n chat-system

# 출력:
# NAME                           READY   STATUS    RESTARTS   AGE
# mysql-0                        1/1     Running   0          2m
# redis-pubsub-xxx               1/1     Running   0          2m
# chat-server-xxx-1              1/1     Running   0          1m
# chat-server-xxx-2              1/1     Running   0          1m
# ...
# chat-server-xxx-10             1/1     Running   0          1m

# Service 확인
k get svc -n chat-system

# 출력:
# NAME           TYPE           CLUSTER-IP      EXTERNAL-IP   PORT(S)
# chat-service   LoadBalancer   10.43.0.12      your-ec2-ip   80:30080/TCP

# HPA 확인
k get hpa -n chat-system

# 출력:
# NAME               REFERENCE                TARGETS         MINPODS   MAXPODS   REPLICAS
# chat-server-hpa    Deployment/chat-server   15%/70%, 25%/80%   3        20        10
```

### 5. 접속 테스트

```bash
# 헬스체크
curl http://your-ec2-ip/actuator/health

# 로드 밸런싱 확인
for i in {1..20}; do
  curl -s http://your-ec2-ip/api/chatrooms | head -n 1
done
```

## 📊 Kubernetes vs Docker Compose 비교

| 항목 | Docker Compose | Kubernetes |
|------|---------------|------------|
| **EC2 대수** | 10대 | 1대 |
| **월 비용** | $500 | $250 |
| **Pod 개수** | 고정 10개 | 자동 (3~20개) |
| **스케일링** | 수동 | 자동 (HPA) |
| **장애 복구** | 30초 | 10초 |
| **포트폴리오** | 보통 | **우수** ✅ |

## 🎯 자동 스케일링 동작

```yaml
minReplicas: 3   # 최소 3개 (한가할 때)
maxReplicas: 20  # 최대 20개 (폭증 시)

CPU 사용률 < 70%: Pod 감소
CPU 사용률 > 70%: Pod 증가

→ 트래픽에 따라 자동 조절!
```

## 🛠️ 유용한 명령어

```bash
# 실시간 로그 확인
k logs -f -n chat-system deployment/chat-server

# 특정 Pod 로그
k logs -f -n chat-system chat-server-xxx-1

# Pod 목록 실시간 모니터링
watch -n 1 'k get pods -n chat-system'

# HPA 실시간 모니터링
watch -n 1 'k get hpa -n chat-system'

# 리소스 사용량
k top pods -n chat-system

# Pod 접속 (디버깅)
k exec -it -n chat-system chat-server-xxx-1 -- /bin/sh

# 전체 삭제 (재배포 시)
k delete -f k8s/
```

## 🔧 설정 변경

### Pod 개수 변경
```bash
# replicas 수정
nano k8s/03-chat-server.yaml

# replicas: 10 → 5

# 적용
k apply -f k8s/03-chat-server.yaml
```

### HPA 임계값 변경
```bash
# HPA 수정
nano k8s/04-hpa.yaml

# averageUtilization: 70 → 60

# 적용
k apply -f k8s/04-hpa.yaml
```

## 📈 부하 테스트

```bash
# K6 부하 테스트
k6 run --vus 50000 --duration 5m k6-chatroom-performance-test.js

# 다른 터미널에서 모니터링
watch -n 1 'k get hpa -n chat-system'

# 결과:
# REPLICAS: 10 → 12 → 15 → 18 (자동 증가!)
```

## 🎉 완료!

이제 Kubernetes로 10개 Pod를 운영하고 있습니다!

- ✅ 자동 스케일링 (3~20개)
- ✅ 자가 치유 (< 10초)
- ✅ 로드 밸런싱 (자동)
- ✅ 비용 50% 절감


