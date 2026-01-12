# CoreConnect 채팅 서비스 Kubernetes 배포 가이드

## 📋 사전 준비

### 완료된 것
- ✅ EKS 클러스터 생성 (chat-prod, 5개 스팟 노드)
- ✅ AWS Load Balancer Controller 설치
- ✅ Cluster Autoscaler 설치
- ✅ Metrics Server 설치

### 필요한 것
- Redis (ElastiCache)
- MySQL (RDS)
- ECR에 Docker 이미지 푸시

---

## 🚀 배포 단계

### 1단계: Git으로 서버에 업로드

```bash
# 로컬(Windows)에서
cd C:\dev\final_project_coreconnect
git add .
git commit -m "Add Kubernetes deployment files"
git push origin main

# 서버(Ubuntu)에서
cd ~/
git clone https://github.com/your-username/final_project_coreconnect.git
# 또는 기존 repo 업데이트
cd final_project_coreconnect
git pull
```

### 2단계: Docker 이미지 빌드 & ECR 푸시

```bash
cd ~/final_project_coreconnect/backend

# ECR 로그인
aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin 230438301300.dkr.ecr.ap-northeast-2.amazonaws.com

# ECR 리포지토리 생성
aws ecr create-repository \
    --repository-name chat-service \
    --region ap-northeast-2

# Docker 이미지 빌드 (5~10분 소요)
docker build -t chat-service:v1.0.0 .

# 태그
docker tag chat-service:v1.0.0 230438301300.dkr.ecr.ap-northeast-2.amazonaws.com/chat-service:v1.0.0
docker tag chat-service:v1.0.0 230438301300.dkr.ecr.ap-northeast-2.amazonaws.com/chat-service:latest

# ECR 푸시
docker push 230438301300.dkr.ecr.ap-northeast-2.amazonaws.com/chat-service:v1.0.0
docker push 230438301300.dkr.ecr.ap-northeast-2.amazonaws.com/chat-service:latest

# 확인
aws ecr describe-images --repository-name chat-service --region ap-northeast-2
```

### 3단계: MySQL RDS 생성

```bash
# VPC ID 확인
VPC_ID=$(aws eks describe-cluster --name chat-prod --region ap-northeast-2 --query 'cluster.resourcesVpcConfig.vpcId' --output text)
echo "VPC ID: $VPC_ID"

# 서브넷 확인
aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[].SubnetId' --output table

# DB 서브넷 그룹 생성
aws rds create-db-subnet-group \
    --db-subnet-group-name chat-db-subnet-group \
    --db-subnet-group-description "Subnet group for chat DB" \
    --subnet-ids subnet-xxxxx subnet-xxxxx subnet-xxxxx \
    --region ap-northeast-2

# DB 보안 그룹 생성
DB_SG_ID=$(aws ec2 create-security-group \
    --group-name chat-db-sg \
    --description "Security group for chat MySQL" \
    --vpc-id $VPC_ID \
    --output text)

echo "DB SG ID: $DB_SG_ID"

# EKS 노드 보안 그룹에서 접근 허용
NODE_SG_ID=$(aws ec2 describe-security-groups \
    --filters "Name=tag:aws:eks:cluster-name,Values=chat-prod" "Name=tag:aws:autoscaling:groupName,Values=*" \
    --query 'SecurityGroups[0].GroupId' \
    --output text)

echo "Node SG ID: $NODE_SG_ID"

aws ec2 authorize-security-group-ingress \
    --group-id $DB_SG_ID \
    --protocol tcp \
    --port 3306 \
    --source-group $NODE_SG_ID

# MySQL RDS 인스턴스 생성
aws rds create-db-instance \
    --db-instance-identifier chat-mysql \
    --db-instance-class db.t3.micro \
    --engine mysql \
    --engine-version 8.0.35 \
    --master-username admin \
    --master-user-password 'YourSecurePassword123!' \
    --allocated-storage 20 \
    --db-subnet-group-name chat-db-subnet-group \
    --vpc-security-group-ids $DB_SG_ID \
    --backup-retention-period 7 \
    --publicly-accessible false \
    --region ap-northeast-2

# 생성 상태 확인 (10~15분 소요)
aws rds describe-db-instances \
    --db-instance-identifier chat-mysql \
    --region ap-northeast-2 \
    --query 'DBInstances[0].[DBInstanceStatus,Endpoint.Address]' \
    --output table

# 엔드포인트 저장
DB_ENDPOINT=$(aws rds describe-db-instances \
    --db-instance-identifier chat-mysql \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text)

echo "DB Endpoint: $DB_ENDPOINT"
```

### 4단계: Redis ElastiCache 생성

```bash
# Redis 보안 그룹 생성
REDIS_SG_ID=$(aws ec2 create-security-group \
    --group-name chat-redis-sg \
    --description "Security group for chat Redis" \
    --vpc-id $VPC_ID \
    --output text)

echo "Redis SG ID: $REDIS_SG_ID"

# EKS 노드에서 접근 허용
aws ec2 authorize-security-group-ingress \
    --group-id $REDIS_SG_ID \
    --protocol tcp \
    --port 6379 \
    --source-group $NODE_SG_ID

# Redis 서브넷 그룹 생성
aws elasticache create-cache-subnet-group \
    --cache-subnet-group-name chat-redis-subnet-group \
    --cache-subnet-group-description "Subnet group for chat Redis" \
    --subnet-ids subnet-xxxxx subnet-xxxxx subnet-xxxxx \
    --region ap-northeast-2

# Redis 클러스터 생성
aws elasticache create-cache-cluster \
    --cache-cluster-id chat-redis \
    --engine redis \
    --cache-node-type cache.t3.micro \
    --num-cache-nodes 1 \
    --engine-version 7.0 \
    --cache-subnet-group-name chat-redis-subnet-group \
    --security-group-ids $REDIS_SG_ID \
    --region ap-northeast-2

# 생성 상태 확인 (5~10분 소요)
aws elasticache describe-cache-clusters \
    --cache-cluster-id chat-redis \
    --region ap-northeast-2 \
    --show-cache-node-info \
    --query 'CacheClusters[0].[CacheClusterStatus,CacheNodes[0].Endpoint.Address]' \
    --output table

# 엔드포인트 저장
REDIS_ENDPOINT=$(aws elasticache describe-cache-clusters \
    --cache-cluster-id chat-redis \
    --show-cache-node-info \
    --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' \
    --output text)

echo "Redis Endpoint: $REDIS_ENDPOINT"
```

### 5단계: ConfigMap 업데이트

```bash
cd ~/final_project_coreconnect/k8s

# ConfigMap에 실제 엔드포인트 입력
nano configmap.yaml
# DB_HOST와 REDIS_HOST를 위에서 얻은 엔드포인트로 교체
```

### 6단계: Secret 생성

```bash
# kubectl로 Secret 생성 (안전)
kubectl create secret generic chat-secret \
  --from-literal=DB_USERNAME=admin \
  --from-literal=DB_PASSWORD='YourSecurePassword123!' \
  --from-literal=REDIS_PASSWORD='' \
  --from-literal=JWT_SECRET='your-jwt-secret-key-minimum-256-bits-long-string' \
  --from-literal=AWS_ACCESS_KEY='your-aws-access-key' \
  --from-literal=AWS_SECRET_KEY='your-aws-secret-key' \
  --from-literal=SENDGRID_API_KEY='your-sendgrid-api-key' \
  -n chat-system

# 확인
kubectl get secret chat-secret -n chat-system
```

### 7단계: MySQL 데이터베이스 초기화

```bash
# MySQL 클라이언트 설치
sudo apt install -y mysql-client

# RDS 접속
mysql -h $DB_ENDPOINT -u admin -p

# 데이터베이스 생성
CREATE DATABASE IF NOT EXISTS coreconnect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE coreconnect;

# 테이블 생성 (기존 SQL 스크립트 실행)
# source /path/to/your/schema.sql

# 확인
SHOW TABLES;
EXIT;
```

### 8단계: Kubernetes 리소스 배포

```bash
cd ~/final_project_coreconnect/k8s

# 순서대로 배포
kubectl apply -f 00-namespace.yaml
kubectl apply -f configmap.yaml
# kubectl apply -f secret-template.yaml  # 또는 6단계의 kubectl create secret 사용
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml
kubectl apply -f hpa.yaml
kubectl apply -f pdb.yaml

# 배포 상태 확인
kubectl get all -n chat-system
```

### 9단계: 배포 검증

```bash
# 파드 확인 (10개 Running이어야 함)
kubectl get pods -n chat-system

# 파드 로그 확인
kubectl logs -n chat-system -l app=chat-service --tail=100

# 파드 상세 정보
kubectl describe pod -n chat-system <pod-name>

# Ingress ALB 주소 확인 (2~3분 소요)
kubectl get ingress -n chat-system

# ALB DNS 주소 저장
ALB_DNS=$(kubectl get ingress -n chat-system chat-ingress -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo "ALB DNS: $ALB_DNS"

# 헬스체크 테스트
curl http://$ALB_DNS/actuator/health

# WebSocket 엔드포인트 테스트
curl http://$ALB_DNS/ws
```

### 10단계: HPA 동작 확인

```bash
# HPA 상태
kubectl get hpa -n chat-system

# Pod 리소스 사용량
kubectl top pods -n chat-system

# 노드 리소스 사용량
kubectl top nodes
```

---

## 🔧 트러블슈팅

### 파드가 Pending 상태

```bash
# 이벤트 확인
kubectl describe pod -n chat-system <pod-name>

# 노드 리소스 확인
kubectl describe nodes

# 해결: Cluster Autoscaler가 노드 추가 (5~10분)
```

### 파드가 CrashLoopBackOff

```bash
# 로그 확인
kubectl logs -n chat-system <pod-name>

# 이전 컨테이너 로그
kubectl logs -n chat-system <pod-name> --previous

# 일반 원인:
# - DB 연결 실패 (엔드포인트/비밀번호 확인)
# - Redis 연결 실패
# - 환경변수 누락
```

### ALB가 생성되지 않음

```bash
# ALB Controller 로그
kubectl logs -n kube-system deployment/aws-load-balancer-controller

# Ingress 이벤트
kubectl describe ingress -n chat-system chat-ingress

# 해결: Annotation 확인, ALB Controller 재시작
```

### WebSocket 연결 실패

```bash
# Ingress annotation 확인
# - idle_timeout 설정
# - sticky session 설정

# 로그에서 WebSocket 업그레이드 확인
kubectl logs -n chat-system -l app=chat-service | grep -i websocket
```

---

## 📊 모니터링

```bash
# 실시간 파드 상태
kubectl get pods -n chat-system -w

# 실시간 HPA
kubectl get hpa -n chat-system -w

# 리소스 사용량
watch kubectl top pods -n chat-system

# 파드 이벤트
kubectl get events -n chat-system --sort-by='.lastTimestamp'
```

---

## 🔄 업데이트 배포

```bash
# 새 이미지 빌드
docker build -t chat-service:v1.0.1 .
docker tag chat-service:v1.0.1 230438301300.dkr.ecr.ap-northeast-2.amazonaws.com/chat-service:v1.0.1
docker push 230438301300.dkr.ecr.ap-northeast-2.amazonaws.com/chat-service:v1.0.1

# 배포 업데이트
kubectl set image deployment/chat-service \
  chat-service=230438301300.dkr.ecr.ap-northeast-2.amazonaws.com/chat-service:v1.0.1 \
  -n chat-system

# 롤아웃 상태 확인
kubectl rollout status deployment/chat-service -n chat-system

# 롤백 (문제 발생 시)
kubectl rollout undo deployment/chat-service -n chat-system
```

---

## 🧹 리소스 정리

```bash
# 애플리케이션만 삭제
kubectl delete namespace chat-system

# RDS 삭제
aws rds delete-db-instance --db-instance-identifier chat-mysql --skip-final-snapshot

# Redis 삭제
aws elasticache delete-cache-cluster --cache-cluster-id chat-redis

# EKS 클러스터 삭제
eksctl delete cluster --name chat-prod --region ap-northeast-2
```

---

## 📋 체크리스트

배포 전:
- [ ] Docker 이미지 빌드 완료
- [ ] ECR에 푸시 완료
- [ ] RDS MySQL 생성 및 초기화
- [ ] Redis ElastiCache 생성
- [ ] ConfigMap 엔드포인트 업데이트
- [ ] Secret 생성

배포 후:
- [ ] 파드 10개 Running 확인
- [ ] ALB 생성 확인
- [ ] 헬스체크 정상 응답
- [ ] WebSocket 연결 테스트
- [ ] HPA 동작 확인
- [ ] 로그 확인 (에러 없음)











