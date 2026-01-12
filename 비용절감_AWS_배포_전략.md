# 💰 비용 절감 AWS 배포 전략

## 현재 상황
- **월 비용**: 40만원 이상
- **목표**: 10만 명 동시 접속 부하 테스트
- **고민**: 서버를 내리면 테스트 못하는지?

## ✅ 해결 방안

### 1. 로컬 개발 환경 (비용 $0)

#### Docker Compose 활용
```bash
# 이미 프로젝트에 있는 파일 사용
docker-compose up -d

# 로컬에서 부하 테스트
k6 run --vus 10000 --duration 5m k6-chatroom-performance-test.js
```

**장점:**
- 무료
- 빠른 개발 사이클
- 코드 수정 즉시 테스트 가능
- 10만 명까지는 k6가 시뮬레이션 가능

**단점:**
- 실제 AWS 환경과 차이 있을 수 있음
- 네트워크 레이턴시 시뮬레이션 불가

---

### 2. AWS 온디맨드 전략 (월 5만원 이하)

#### A. 평소: 서버 중지
```bash
# EC2 인스턴스 중지 (스토리지 비용만 발생 ~$5/월)
aws ec2 stop-instances --instance-ids i-xxxxx
```

#### B. 테스트 필요시: 서버 시작 (1시간 단위)
```bash
# 1. 서버 시작
aws ec2 start-instances --instance-ids i-xxxxx

# 2. 부하 테스트 실행 (1-2시간)
k6 run --vus 100000 --duration 30m k6-chatroom-performance-test.js

# 3. 즉시 중지
aws ec2 stop-instances --instance-ids i-xxxxx
```

**비용 계산:**
- t3.large: $0.0832/시간
- 월 10시간 테스트: $0.83 (약 1,200원)
- EBS 스토리지: 100GB = $10/월
- **총 월 비용: ~$11 (약 1.5만원)**

---

### 3. 스팟 인스턴스 활용 (70% 비용 절감)

```bash
# 스팟 인스턴스로 부하 테스트용 클러스터 생성
aws ec2 request-spot-instances \
  --spot-price "0.03" \
  --instance-count 3 \
  --type "one-time" \
  --launch-specification file://spot-spec.json
```

**비용:**
- 정상 가격의 30% 수준
- 대규모 테스트 시에만 사용
- 월 4-5회 테스트: ~$20 (약 2.7만원)

---

### 4. 최소 비용 아키텍처 (추천)

#### 개발 환경 설정
```yaml
# k8s/03-chat-server-dev.yaml
spec:
  replicas: 2  # 10 → 2
  resources:
    requests:
      memory: "512Mi"
      cpu: "250m"
    limits:
      memory: "1Gi"
      cpu: "500m"
```

#### 프로덕션 테스트 환경 (필요시에만)
```yaml
# k8s/03-chat-server-prod.yaml
spec:
  replicas: 10
  resources:
    requests:
      memory: "1Gi"
      cpu: "500m"
    limits:
      memory: "2Gi"
      cpu: "1000m"
```

**사용법:**
```bash
# 평소 개발
kubectl apply -f k8s/03-chat-server-dev.yaml

# 대규모 테스트시
kubectl apply -f k8s/03-chat-server-prod.yaml
# 테스트 완료 후
kubectl apply -f k8s/03-chat-server-dev.yaml
```

---

### 5. K6 Cloud 활용 (무료 티어)

```bash
# K6 Cloud에서 부하 생성 (로컬 서버는 최소화)
k6 cloud k6-chatroom-performance-test.js
```

**장점:**
- K6 Cloud가 부하 생성 (로컬 리소스 불필요)
- 무료 티어: 월 50개 테스트
- 전 세계 여러 리전에서 테스트 가능

**비용:**
- 무료 티어로 충분
- 서버는 t3.small 1대면 충분 (~$15/월)

---

## 🎯 추천 전략

### Phase 1: 로컬 개발 (현재 ~ 코드 최적화 완료)
```bash
# Docker Compose로 로컬 환경 구축
docker-compose up -d

# 소규모 부하 테스트로 병목 찾기
k6 run --vus 1000 --duration 5m k6-chatroom-performance-test.js
k6 run --vus 1000 --duration 5m K6_부하테스트_파일_목록.md의 다른 테스트들

# 코드 개선 반복
```

**기간**: 2-4주  
**비용**: $0

---

### Phase 2: AWS 검증 테스트 (최적화 검증)
```bash
# AWS에 최소 환경 배포 (t3.small 2대)
replicas: 2
instance-type: t3.small

# 중규모 테스트
k6 run --vus 10000 --duration 10m k6-chatroom-performance-test.js
```

**기간**: 1-2일  
**비용**: ~$5

---

### Phase 3: 대규모 검증 (최종)
```bash
# 스팟 인스턴스로 대규모 클러스터 구성
# 2-3시간 집중 테스트
# 즉시 종료
```

**기간**: 2-3시간  
**비용**: ~$10-20

---

## 📊 비용 비교

| 전략 | 월 비용 | 테스트 가능 여부 |
|------|---------|------------------|
| **현재 (상시 운영)** | 40만원 | ⭕ 항상 가능 |
| **로컬 Docker** | 0원 | ⭕ 언제든지 가능 |
| **온디맨드 (필요시)** | 1.5만원 | ⭕ 필요할 때만 |
| **최소 환경 상시** | 3만원 | ⭕ 항상 가능 (소규모) |
| **하이브리드 (추천)** | 5만원 | ⭕ 로컬 + 주 1회 AWS |

---

## 🚀 실행 계획

### 1주차: 로컬 환경 최적화
```bash
# 1. Docker Compose 실행
docker-compose up -d

# 2. 기본 부하 테스트
k6 run --vus 100 k6-login-test.js
k6 run --vus 1000 k6-chatroom-performance-test.js

# 3. 병목 찾기 및 코드 개선
```

### 2주차: AWS 최소 환경 테스트
```bash
# AWS 서버를 최소 구성으로 변경
# t3.small 2대로 테스트
# 문제 없으면 계속 개발
```

### 최종 배포 전: 대규모 검증
```bash
# 스팟 인스턴스로 10만 명 테스트
# 2-3시간 집중 테스트
# 결과 확인 후 종료
```

---

## ✨ 핵심 포인트

### ❌ 오해
> "서버를 내리면 k6 테스트를 못한다"

### ⭕ 진실
> "k6는 로컬에서도 10만 명 시뮬레이션 가능하다"  
> "AWS는 최종 검증용으로만 사용하면 된다"

---

## 💡 추가 팁

### 1. K6 부하 생성은 무료
```bash
# k6는 로컬 PC에서 실행
# 수십만 가상 사용자 생성 가능
# 비용: $0
k6 run --vus 100000 --duration 30s test.js
```

### 2. 병목은 로컬에서도 찾을 수 있음
- N+1 쿼리
- 비효율적인 알고리즘
- 메모리 누수
- 동기 처리 문제

→ 이런 문제들은 소규모 테스트로도 발견 가능

### 3. 대규모 테스트는 최종 검증용
- 코드 최적화 완료 후
- 배포 직전
- 월 1-2회면 충분

---

## 📞 실전 조언

1. **지금 당장**: AWS 서버 중지하세요
   - 스토리지만 유지 (~$10/월)
   - 데이터는 보존됨

2. **로컬로 전환**: Docker Compose 활용
   - 개발 속도 더 빠름
   - 비용 $0

3. **코드 개선**: 로컬에서 최적화
   - N+1 쿼리 해결
   - 인덱스 최적화
   - 캐싱 추가

4. **필요할 때만**: AWS 서버 시작
   - 최종 검증용
   - 월 5-10시간이면 충분

**결론: 40만원 → 1.5만원으로 절감 가능하면서도 테스트는 더 자주 할 수 있습니다!**


