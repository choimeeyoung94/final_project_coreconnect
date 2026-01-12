# K8s 서버 복구 가이드

## 😱 k8s 서버를 실수로 삭제했어요!

### 걱정 마세요! 3가지 옵션이 있습니다:

---

## 옵션 1: 복구하지 않기 (추천!) ⭐⭐⭐

### 언제?
- 개발/테스트용이었다면
- 비용을 줄이고 싶다면
- 로컬 개발로 충분하다면

### 방법
```bash
# 로컬 Docker Compose 사용
docker-compose up -d

# k6로 부하 테스트
k6 run --vus 100000 k6-chatroom-performance-test.js
```

### 장점
- ✅ 비용 $0 (월 40만원 절감!)
- ✅ 무제한 테스트
- ✅ 더 빠른 개발
- ✅ 실수가 오히려 행운!

---

## 옵션 2: 새 서버 생성 (5분) ⭐⭐

### 방법 A: AWS CLI로 생성

```bash
# 1. 새 인스턴스 생성
aws ec2 run-instances \
  --image-id ami-0c9c942bd7bf113a2 \
  --instance-type t3.small \
  --key-name your-key-name \
  --security-group-ids sg-xxxxx \
  --subnet-id subnet-xxxxx \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=k3s-server-new}]' \
  --region ap-northeast-2

# 2. Public IP 확인
aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=k3s-server-new" \
  --query "Reservations[*].Instances[*].PublicIpAddress" \
  --output text

# 3. SSH 접속
ssh -i your-key.pem ec2-user@<PUBLIC_IP>

# 4. k3s 설치 (1분)
curl -sfL https://get.k3s.io | sh -

# 5. 완료! kubectl 사용 가능
sudo kubectl get nodes
```

### 방법 B: AWS Console에서 생성

1. **EC2 콘솔 접속**
   - AWS Console → EC2 → 인스턴스 시작

2. **설정**
   ```
   이름: k3s-server-new
   AMI: Amazon Linux 2
   인스턴스 타입: t3.small (개발용) 또는 t3.medium
   키 페어: 기존 키 선택
   네트워크: 기존 VPC/서브넷
   보안 그룹: 기존 보안 그룹
   ```

3. **시작 후 SSH 접속**
   ```bash
   ssh -i your-key.pem ec2-user@<PUBLIC_IP>
   ```

4. **k3s 설치**
   ```bash
   # 기본 설치 (30초)
   curl -sfL https://get.k3s.io | sh -
   
   # 또는 최적화 설치
   curl -sfL https://get.k3s.io | sh -s - \
     --disable traefik \
     --disable servicelb
   
   # 확인
   sudo kubectl get nodes
   ```

---

## 옵션 3: 기존 k3s-server2 사용 ⭐⭐⭐

### 스크린샷 확인 결과
이미 `k3s-server2`가 실행 중입니다!

```bash
# k3s-server2 IP: 52.78.195.123
ssh ec2-user@52.78.195.123

# k3s 상태 확인
sudo systemctl status k3s

# kubectl 사용
sudo kubectl get nodes
sudo kubectl get pods -A

# 앱 배포
sudo kubectl apply -f k8s/
```

**이미 있으니 새로 만들 필요 없습니다!** ✅

---

## 📋 복구 체크리스트

### 1단계: 필요성 판단

- [ ] 개발/테스트용? → 로컬 사용 (복구 불필요)
- [ ] 프로덕션용? → 복구 필요
- [ ] k3s-server2 사용 가능? → 복구 불필요

### 2단계: 데이터 백업 확인

- [ ] DB 데이터는 안전한가? (RDS 또는 별도 서버)
- [ ] 설정 파일은 Git에 있는가? (k8s/*.yaml)
- [ ] 이미지는 ECR/DockerHub에 있는가?

### 3단계: 복구 또는 대체

**대부분의 경우 데이터는 안전합니다:**
- ✅ MySQL: 별도 EC2 또는 RDS
- ✅ Redis: 별도 서버
- ✅ 설정: Git 저장소
- ✅ 이미지: Docker Hub

**k8s 서버는 단지 실행 환경일 뿐!**

---

## 🚀 빠른 복구 스크립트

### 전체 자동화 스크립트

```bash
#!/bin/bash
# k3s-recovery.sh

echo "🔧 k3s 서버 복구 시작..."

# 1. 인스턴스 생성
echo "1. EC2 인스턴스 생성 중..."
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id ami-0c9c942bd7bf113a2 \
  --instance-type t3.small \
  --key-name your-key-name \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=k3s-server-recovered}]' \
  --query 'Instances[0].InstanceId' \
  --output text \
  --region ap-northeast-2)

echo "✅ 인스턴스 생성: $INSTANCE_ID"

# 2. 실행 대기
echo "2. 인스턴스 시작 대기 중..."
aws ec2 wait instance-running --instance-ids $INSTANCE_ID --region ap-northeast-2

# 3. Public IP 가져오기
PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text \
  --region ap-northeast-2)

echo "✅ Public IP: $PUBLIC_IP"

# 4. SSH 준비 대기
echo "3. SSH 준비 대기 중 (30초)..."
sleep 30

# 5. k3s 설치
echo "4. k3s 설치 중..."
ssh -o StrictHostKeyChecking=no -i your-key.pem ec2-user@$PUBLIC_IP << 'EOF'
  curl -sfL https://get.k3s.io | sh -
  sudo systemctl status k3s
EOF

echo "✅ k3s 설치 완료!"

# 6. kubeconfig 가져오기
echo "5. kubeconfig 설정 중..."
ssh -i your-key.pem ec2-user@$PUBLIC_IP "sudo cat /etc/rancher/k3s/k3s.yaml" > k3s.yaml
sed -i "s/127.0.0.1/$PUBLIC_IP/g" k3s.yaml

echo "✅ 복구 완료!"
echo ""
echo "다음 명령어로 사용하세요:"
echo "  export KUBECONFIG=./k3s.yaml"
echo "  kubectl get nodes"
```

### 사용법

```bash
# 스크립트 실행 권한
chmod +x k3s-recovery.sh

# 실행
./k3s-recovery.sh

# 5분 후 완료!
```

---

## 💡 복구 후 해야 할 일

### 1. Namespace 생성
```bash
kubectl apply -f k8s/00-namespace.yaml
```

### 2. 데이터베이스 배포
```bash
kubectl apply -f k8s/01-mysql.yaml
```

### 3. Redis 배포
```bash
kubectl apply -f k8s/02-redis.yaml
```

### 4. 애플리케이션 배포
```bash
# 개발용
kubectl apply -f k8s/03-chat-server-dev.yaml

# 또는 프로덕션용
kubectl apply -f k8s/03-chat-server-loadtest.yaml
```

### 5. 확인
```bash
kubectl get pods -n chat-system
kubectl get services -n chat-system
```

---

## 🛡️ 재발 방지

### 1. 스냅샷 자동화

```bash
# 매일 스냅샷 생성 (AWS Lambda)
aws ec2 create-snapshot \
  --volume-id vol-xxxxx \
  --description "Daily k3s backup" \
  --tag-specifications 'ResourceType=snapshot,Tags=[{Key=Name,Value=k3s-daily-backup}]'
```

### 2. Infrastructure as Code

```bash
# Terraform으로 관리
terraform plan
terraform apply

# 삭제해도 쉽게 재생성
terraform apply
```

### 3. GitOps

```yaml
# 모든 설정을 Git에 저장
k8s/
├── 00-namespace.yaml
├── 01-mysql.yaml
├── 02-redis.yaml
└── 03-chat-server-dev.yaml

# 언제든 재배포 가능
kubectl apply -f k8s/
```

### 4. 삭제 보호 활성화

```bash
# AWS Console
EC2 → 인스턴스 → 작업 → 인스턴스 설정 → 종료 보호 변경

# 또는 CLI
aws ec2 modify-instance-attribute \
  --instance-id i-xxxxx \
  --disable-api-termination
```

---

## 🎯 권장 사항

### 개발 단계라면

```
❌ 복구하지 마세요
✅ 로컬 Docker로 개발하세요

장점:
- 비용 $0
- 더 빠름
- 실수 걱정 없음
```

### 프로덕션이라면

```
✅ 기존 k3s-server2 활용
또는
✅ 새 서버 생성 (5분)

장점:
- 빠른 복구
- 기존 데이터 안전
- 같은 환경 재현
```

---

## 📊 비용 비교

| 옵션 | 초기 비용 | 월 비용 | 복구 시간 |
|------|-----------|---------|-----------|
| 복구 안 함 (로컬) | $0 | $0 | 0분 |
| k3s-server2 사용 | $0 | 기존 비용 | 0분 |
| t3.small 새로 생성 | $0 | $15 | 5분 |
| t3.medium 새로 생성 | $0 | $30 | 5분 |

---

## 🆘 긴급 상황 대응

### Q: 데이터가 날아갔어요!
**A:** 대부분 괜찮습니다:
- MySQL: 별도 서버 또는 RDS
- Redis: 캐시라 재생성 가능
- 애플리케이션: Git에서 재배포

### Q: 프로덕션이 멈췄어요!
**A:** 빠른 대응:
1. 기존 spot 인스턴스 확인 (6개 실행 중)
2. k3s-server2 사용 (이미 있음)
3. 또는 5분 안에 새 서버 생성

### Q: 설정을 기억 못해요!
**A:** Git에 다 있습니다:
```bash
cd c:\dev\final_project_coreconnect
ls k8s/  # 모든 설정 파일
```

---

## ✅ 최종 점검

### 삭제한 서버가...

#### 1. 개발/테스트용이었다면
- [ ] 로컬 Docker로 전환
- [ ] docker-compose up -d
- [ ] k6로 테스트
- [ ] **복구 불필요!** ✅

#### 2. 프로덕션용이었다면
- [ ] k3s-server2 사용 가능?
- [ ] 또는 새 서버 생성 (5분)
- [ ] k8s/ 폴더에서 재배포
- [ ] 테스트 후 운영 재개

#### 3. 확신이 안 선다면
- [ ] 일단 로컬로 개발 계속
- [ ] 필요하면 나중에 생성
- [ ] 급하지 않음!

---

## 🎉 결론

### 실수로 삭제했지만...

#### 좋은 소식 3가지:

1. **데이터는 안전합니다**
   - MySQL, Redis: 별도 서버
   - 설정: Git 저장소
   - 코드: Git 저장소

2. **쉽게 복구 가능합니다**
   - 5분이면 새 서버 생성
   - 또는 k3s-server2 사용
   - 모든 설정은 k8s/ 폴더에

3. **오히려 기회일 수 있습니다**
   - 로컬 개발로 전환 → 비용 $0
   - 더 효율적인 개발
   - 월 40만원 절감!

### 추천: 일단 로컬로 개발하세요!

```bash
docker-compose up -d
k6 run --vus 10000 k6-chatroom-performance-test.js

# 필요하면 나중에 k8s 서버 생성
# 급하지 않습니다! 😊
```

---

**실수가 오히려 비용 절감의 기회가 될 수 있습니다!** 🎯
