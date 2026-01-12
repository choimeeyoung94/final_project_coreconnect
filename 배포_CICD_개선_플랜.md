# CoreConnect 배포 및 CI/CD 개선 플랜

> **목표**: 수동 배포를 자동화하고, 무중단 배포 및 롤백 전략 구축

---

## 📊 AS-IS 배포 프로세스 분석

### 🔴 현재 배포 방식의 문제점

#### 1. 수동 배포 프로세스
```bash
# 현재 배포 절차 (예상)
1. 로컬에서 코드 수정
2. Git commit & push
3. SSH로 EC2 접속
4. git pull
5. docker build
6. docker stop (기존 컨테이너 중지) ⚠️ 서비스 중단!
7. docker rm (기존 컨테이너 삭제)
8. docker run (새 컨테이너 시작)
9. 수동으로 health check

총 소요 시간: 10-15분
서비스 중단 시간: 2-5분 ⚠️
```

#### 2. 발견된 문제점

| 문제 | 심각도 | 영향 | 빈도 |
|------|--------|------|------|
| **서비스 중단** (Downtime) | 🔴 높음 | 2-5분간 사용 불가 | 매 배포 시 |
| **수동 작업 많음** | 🟠 중간 | 배포 시간 15분 | 매 배포 시 |
| **테스트 누락** | 🔴 높음 | 버그 프로덕션 배포 위험 | 자주 |
| **롤백 어려움** | 🟠 중간 | 장애 복구 느림 (10분+) | 가끔 |
| **환경 불일치** | 🟡 낮음 | "로컬에서는 되는데?" | 가끔 |
| **모니터링 부재** | 🟠 중간 | 배포 실패 감지 느림 | 항상 |
| **단일 서버** | 🔴 높음 | SPOF (단일 장애점) | 항상 |

#### 3. AS-IS 아키텍처
```
[Developer] 
    ↓ git push
[GitHub Repository]
    ↓ manual SSH
[EC2 Single Instance]
    ├─ Docker Container (Backend)
    ├─ MySQL
    └─ Nginx
    
문제:
- CI/CD 파이프라인 없음
- 자동 테스트 없음
- 무중단 배포 불가
- 모니터링 없음
```

---

## 🎯 TO-BE 배포 프로세스 (단계별)

### 📋 개선 우선순위 매트릭스

```
┌─────────────────────────────────────────────────────────────┐
│ 배포/CI/CD 개선 우선순위 (효과 × 난이도)                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  효과  ┃                                                      │
│  높음  ┃  ① GitHub Actions CI    ② Health Check             │
│   ↑    ┃  ③ Blue-Green 배포      ④ 자동 롤백                │
│        ┃  ⑤ Multi-Instance       ⑥ Kubernetes               │
│        ┃  ⑦ Monitoring/Alert     ⑧ E2E 테스트               │
│  낮음  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│         쉬움                 보통                 어려움      │
│                           난이도 →                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🟢 Phase 1: 기본 CI/CD 구축 (1주일, 비용 0원)

### ✅ 개선 #1: GitHub Actions CI 파이프라인

#### 📋 기본 정보
- **난이도**: ⭐⭐☆☆☆ (보통)
- **소요 시간**: 2일
- **비용**: 0원 (GitHub Actions 무료 티어)
- **효과**: 자동 테스트, 빌드 자동화
- **리스크**: 낮음

#### 🎯 목표
```
✅ 코드 Push 시 자동 테스트 실행
✅ 테스트 통과 시에만 빌드
✅ Docker 이미지 자동 빌드 및 푸시
✅ Slack 알림 (성공/실패)
```

#### 📝 실행 단계

**Step 1: GitHub Actions Workflow 생성 (2시간)**
```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    name: 🧪 Test
    runs-on: ubuntu-latest
    
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: test
          MYSQL_DATABASE: test_db
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3
    
    steps:
      - name: 📥 Checkout code
        uses: actions/checkout@v3
      
      - name: ☕ Set up JDK 17
        uses: actions/setup-java@v3
        with:
          java-version: '17'
          distribution: 'temurin'
          cache: gradle
      
      - name: 🔐 Grant execute permission for gradlew
        run: chmod +x backend/gradlew
      
      - name: 🧪 Run tests
        run: |
          cd backend
          ./gradlew test --info
        env:
          SPRING_PROFILES_ACTIVE: test
          SPRING_DATASOURCE_URL: jdbc:mysql://localhost:3306/test_db
          SPRING_DATASOURCE_USERNAME: root
          SPRING_DATASOURCE_PASSWORD: test
      
      - name: 📊 Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: backend/build/reports/tests/
      
      - name: 📈 Test Report
        uses: dorny/test-reporter@v1
        if: always()
        with:
          name: JUnit Test Report
          path: backend/build/test-results/**/*.xml
          reporter: java-junit

  build:
    name: 🏗️ Build
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
      - name: 📥 Checkout code
        uses: actions/checkout@v3
      
      - name: ☕ Set up JDK 17
        uses: actions/setup-java@v3
        with:
          java-version: '17'
          distribution: 'temurin'
          cache: gradle
      
      - name: 🔨 Build with Gradle
        run: |
          cd backend
          chmod +x gradlew
          ./gradlew bootJar -x test
      
      - name: 🐳 Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: 🔐 Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      
      - name: 🏗️ Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: ./backend
          push: true
          tags: |
            ${{ secrets.DOCKER_USERNAME }}/coreconnect-backend:latest
            ${{ secrets.DOCKER_USERNAME }}/coreconnect-backend:${{ github.sha }}
          cache-from: type=registry,ref=${{ secrets.DOCKER_USERNAME }}/coreconnect-backend:buildcache
          cache-to: type=registry,ref=${{ secrets.DOCKER_USERNAME }}/coreconnect-backend:buildcache,mode=max
      
      - name: 📝 Image digest
        run: echo "Image pushed with tag ${{ github.sha }}"

  notify:
    name: 📢 Notify
    needs: [test, build]
    runs-on: ubuntu-latest
    if: always()
    
    steps:
      - name: 💬 Slack Notification - Success
        if: ${{ needs.test.result == 'success' && needs.build.result == 'success' }}
        uses: 8398a7/action-slack@v3
        with:
          status: custom
          custom_payload: |
            {
              text: "✅ CI Pipeline 성공",
              attachments: [{
                color: 'good',
                text: `Repository: ${process.env.AS_REPO}\nBranch: ${process.env.AS_REF}\nCommit: ${process.env.AS_COMMIT}\nAuthor: ${process.env.AS_AUTHOR}`
              }]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
      
      - name: 💬 Slack Notification - Failure
        if: ${{ needs.test.result == 'failure' || needs.build.result == 'failure' }}
        uses: 8398a7/action-slack@v3
        with:
          status: custom
          custom_payload: |
            {
              text: "❌ CI Pipeline 실패",
              attachments: [{
                color: 'danger',
                text: `Repository: ${process.env.AS_REPO}\nBranch: ${process.env.AS_REF}\nCommit: ${process.env.AS_COMMIT}\nAuthor: ${process.env.AS_AUTHOR}\n\nCheck: ${process.env.AS_WORKFLOW}`
              }]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

**Step 2: GitHub Secrets 설정 (10분)**
```bash
# GitHub Repository → Settings → Secrets and variables → Actions

필요한 Secrets:
[ ] DOCKER_USERNAME: Docker Hub 사용자명
[ ] DOCKER_PASSWORD: Docker Hub 액세스 토큰
[ ] SLACK_WEBHOOK_URL: Slack Incoming Webhook URL (선택)
```

**Step 3: 테스트 실행 및 검증 (30분)**
```bash
# 3.1 테스트 Push
git add .github/workflows/ci.yml
git commit -m "ci: GitHub Actions CI 파이프라인 추가"
git push origin main

# 3.2 GitHub Actions 확인
# GitHub Repository → Actions 탭
# [ ] Workflow 실행 확인
# [ ] 테스트 통과 확인
# [ ] Docker 이미지 빌드 확인
# [ ] Slack 알림 수신 확인 (설정한 경우)

# 3.3 Docker Hub 확인
# [ ] coreconnect-backend:latest 이미지 확인
# [ ] coreconnect-backend:{git-sha} 이미지 확인
```

#### ✅ 완료 체크리스트
- [ ] ci.yml 워크플로우 생성 완료
- [ ] GitHub Secrets 설정 완료
- [ ] 테스트 자동 실행 확인
- [ ] Docker 이미지 자동 빌드 확인
- [ ] Slack 알림 동작 확인 (선택)

#### 📊 기대 효과
```
Before:
- 테스트 수동 실행 (자주 누락)
- 빌드 수동 실행 (15분)
- 배포 실패 시 뒤늦게 발견

After:
- 테스트 자동 실행 (100%)
- 빌드 자동화 (5분)
- 실패 즉시 알림 (Slack)
```

---

### ✅ 개선 #2: Health Check 엔드포인트

#### 📋 기본 정보
- **난이도**: ⭐☆☆☆☆ (쉬움)
- **소요 시간**: 1시간
- **비용**: 0원
- **효과**: 배포 검증 자동화
- **리스크**: 매우 낮음

#### 📝 실행 단계

**Step 1: Spring Actuator Health Check (30분)**
```gradle
// build.gradle
dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-actuator'
}
```

```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: health, info, metrics, prometheus
      base-path: /actuator
  
  endpoint:
    health:
      show-details: always  # 프로덕션에서는 when-authorized 권장
      probes:
        enabled: true  # Kubernetes liveness/readiness probe 지원
  
  health:
    db:
      enabled: true
    diskSpace:
      enabled: true
    redis:
      enabled: true  # Redis 사용 시

# Health Check 엔드포인트:
# GET /actuator/health
# GET /actuator/health/liveness
# GET /actuator/health/readiness
```

**Step 2: Custom Health Indicator (30분)**
```java
// CustomHealthIndicator.java
@Component
public class CustomHealthIndicator implements HealthIndicator {
    
    @Autowired
    private EmailRepository emailRepository;
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    @Override
    public Health health() {
        try {
            // 1. DB 연결 확인
            long emailCount = emailRepository.count();
            
            // 2. Redis 연결 확인
            String pong = redisTemplate.getConnectionFactory()
                .getConnection()
                .ping();
            
            // 3. 모두 정상
            return Health.up()
                .withDetail("database", "connected")
                .withDetail("emailCount", emailCount)
                .withDetail("redis", pong)
                .withDetail("timestamp", LocalDateTime.now())
                .build();
                
        } catch (Exception e) {
            return Health.down()
                .withDetail("error", e.getMessage())
                .withException(e)
                .build();
        }
    }
}
```

**Step 3: Health Check 스크립트 (10분)**
```bash
# scripts/health_check.sh
#!/bin/bash

HEALTH_URL="http://localhost:8080/actuator/health"
MAX_RETRIES=30
RETRY_INTERVAL=2

echo "🏥 Health Check 시작..."

for i in $(seq 1 $MAX_RETRIES); do
    echo "[$i/$MAX_RETRIES] Health Check 시도..."
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)
    
    if [ "$HTTP_CODE" -eq 200 ]; then
        RESPONSE=$(curl -s $HEALTH_URL)
        STATUS=$(echo $RESPONSE | jq -r '.status')
        
        if [ "$STATUS" == "UP" ]; then
            echo "✅ Health Check 성공!"
            echo "응답: $RESPONSE"
            exit 0
        else
            echo "⚠️ Status: $STATUS"
        fi
    else
        echo "❌ HTTP Code: $HTTP_CODE"
    fi
    
    if [ $i -lt $MAX_RETRIES ]; then
        echo "   ${RETRY_INTERVAL}초 후 재시도..."
        sleep $RETRY_INTERVAL
    fi
done

echo "❌ Health Check 실패 (최대 재시도 초과)"
exit 1
```

#### ✅ 완료 체크리스트
- [ ] Spring Actuator 의존성 추가
- [ ] Health Check 엔드포인트 활성화
- [ ] Custom Health Indicator 구현
- [ ] Health Check 스크립트 작성
- [ ] 로컬 테스트 통과
- [ ] 프로덕션 배포 완료

---

### ✅ 개선 #3: 자동 배포 스크립트

#### 📋 기본 정보
- **난이도**: ⭐⭐☆☆☆ (보통)
- **소요 시간**: 2일
- **비용**: 0원
- **효과**: 배포 시간 70% 단축 (15분 → 5분)
- **리스크**: 중간

#### 📝 실행 단계

**Step 1: GitHub Actions CD Workflow (4시간)**
```yaml
# .github/workflows/cd.yml
name: CD Pipeline

on:
  workflow_run:
    workflows: ["CI Pipeline"]
    types:
      - completed
    branches:
      - main

jobs:
  deploy:
    name: 🚀 Deploy to Production
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    
    steps:
      - name: 📥 Checkout code
        uses: actions/checkout@v3
      
      - name: 🔐 Configure SSH
        env:
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
          SSH_HOST: ${{ secrets.SSH_HOST }}
          SSH_USER: ${{ secrets.SSH_USER }}
        run: |
          mkdir -p ~/.ssh
          echo "$SSH_PRIVATE_KEY" > ~/.ssh/id_rsa
          chmod 600 ~/.ssh/id_rsa
          ssh-keyscan -H $SSH_HOST >> ~/.ssh/known_hosts
      
      - name: 🚀 Deploy to Server
        env:
          SSH_HOST: ${{ secrets.SSH_HOST }}
          SSH_USER: ${{ secrets.SSH_USER }}
          DOCKER_USERNAME: ${{ secrets.DOCKER_USERNAME }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          ssh $SSH_USER@$SSH_HOST << 'EOF'
            # 1. 최신 이미지 Pull
            echo "📥 Pulling latest image..."
            docker pull $DOCKER_USERNAME/coreconnect-backend:$IMAGE_TAG
            
            # 2. 기존 컨테이너 중지 및 삭제
            echo "🛑 Stopping old container..."
            docker stop boot-container || true
            docker rm boot-container || true
            
            # 3. 새 컨테이너 시작
            echo "🚀 Starting new container..."
            docker run -d \
              --name boot-container \
              --restart always \
              -p 8080:8080 \
              -e SPRING_PROFILES_ACTIVE=secure \
              -e DB_PASSWORD=$DB_PASSWORD \
              $DOCKER_USERNAME/coreconnect-backend:$IMAGE_TAG
            
            # 4. Health Check
            echo "🏥 Running health check..."
            bash /home/ubuntu/scripts/health_check.sh
            
            if [ $? -eq 0 ]; then
              echo "✅ Deployment successful!"
            else
              echo "❌ Deployment failed! Rolling back..."
              docker stop boot-container
              docker rm boot-container
              docker run -d \
                --name boot-container \
                --restart always \
                -p 8080:8080 \
                -e SPRING_PROFILES_ACTIVE=secure \
                $DOCKER_USERNAME/coreconnect-backend:latest
              exit 1
            fi
            
            # 5. 이전 이미지 정리
            echo "🧹 Cleaning up old images..."
            docker image prune -f
          EOF
      
      - name: 💬 Slack Notification - Success
        if: success()
        uses: 8398a7/action-slack@v3
        with:
          status: custom
          custom_payload: |
            {
              text: "🚀 배포 성공!",
              attachments: [{
                color: 'good',
                text: `Environment: Production\nVersion: ${process.env.AS_COMMIT}\nDeployed by: ${process.env.AS_AUTHOR}`
              }]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
      
      - name: 💬 Slack Notification - Failure
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: custom
          custom_payload: |
            {
              text: "❌ 배포 실패!",
              attachments: [{
                color: 'danger',
                text: `Environment: Production\nVersion: ${process.env.AS_COMMIT}\nCheck logs for details`
              }]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

**Step 2: GitHub Secrets 추가 (10분)**
```bash
# 추가 필요한 Secrets:
[ ] SSH_PRIVATE_KEY: EC2 접속용 Private Key
[ ] SSH_HOST: EC2 Public IP (54.116.26.182)
[ ] SSH_USER: ubuntu
[ ] DB_PASSWORD: 프로덕션 DB 비밀번호
```

**Step 3: SSH Key 설정 (20분)**
```bash
# 로컬에서 SSH Key 생성
ssh-keygen -t rsa -b 4096 -C "github-actions" -f ~/.ssh/github_actions_key

# Public Key를 EC2에 등록
ssh-copy-id -i ~/.ssh/github_actions_key.pub ubuntu@54.116.26.182

# Private Key를 GitHub Secrets에 등록
cat ~/.ssh/github_actions_key
# → GitHub Secrets → SSH_PRIVATE_KEY에 복사
```

#### ✅ 완료 체크리스트
- [ ] cd.yml 워크플로우 생성
- [ ] SSH 관련 Secrets 설정
- [ ] SSH Key 설정 완료
- [ ] 배포 자동화 테스트
- [ ] Health Check 통과 확인
- [ ] Slack 알림 수신 확인

#### 📊 Phase 1 효과

| 지표 | Before | After | 개선율 |
|------|--------|-------|--------|
| **배포 소요 시간** | 15분 (수동) | 5분 (자동) | ⬇️ 67% |
| **테스트 실행** | 가끔 (수동) | 항상 (자동) | ⬆️ 100% |
| **배포 실패 감지** | 10분+ (수동) | 즉시 (알림) | ⬇️ 95% |
| **서비스 중단** | 2-5분 | 2-5분 | 동일 (Phase 2에서 해결) |

---

## 🟡 Phase 2: 무중단 배포 (2주일, 비용 월 $20)

### ✅ 개선 #4: Blue-Green 배포

#### 📋 기본 정보
- **난이도**: ⭐⭐⭐☆☆ (어려움)
- **소요 시간**: 3일
- **비용**: 0원 (기존 서버 활용)
- **효과**: 서비스 중단 0초!
- **리스크**: 중간

#### 🎯 Blue-Green 배포 개념
```
Blue (현재 버전)          Green (새 버전)
[Container:8080] ←───┐    [Container:8081]
                     │
                  [Nginx]
                     │
                  [Users]

배포 절차:
1. Green 컨테이너 시작 (8081)
2. Health Check 통과 확인
3. Nginx 트래픽을 Green으로 전환
4. Blue 컨테이너 중지
```

#### 📝 실행 단계

**Step 1: Nginx 설정 (1시간)**
```nginx
# /etc/nginx/sites-available/coreconnect
upstream backend {
    server localhost:8080;  # Blue (기본)
}

server {
    listen 80;
    server_name coreconnect.io.kr;

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Health Check (선택)
        proxy_next_upstream error timeout http_502 http_503 http_504;
        proxy_connect_timeout 5s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
    }
    
    location /actuator/health {
        proxy_pass http://backend;
        access_log off;
    }
}
```

**Step 2: Blue-Green 배포 스크립트 (4시간)**
```bash
# scripts/blue_green_deploy.sh
#!/bin/bash

set -e  # 에러 발생 시 즉시 중단

IMAGE_NAME="$DOCKER_USERNAME/coreconnect-backend"
IMAGE_TAG="${1:-latest}"

# 현재 활성 컨테이너 확인
CURRENT_PORT=$(docker inspect boot-container --format='{{(index (index .NetworkSettings.Ports "8080/tcp") 0).HostPort}}' 2>/dev/null || echo "8080")

echo "🔵 현재 활성 포트: $CURRENT_PORT"

# 새 포트 결정 (8080 ↔ 8081)
if [ "$CURRENT_PORT" == "8080" ]; then
    NEW_PORT=8081
    NEW_COLOR="GREEN"
    OLD_COLOR="BLUE"
else
    NEW_PORT=8080
    NEW_COLOR="BLUE"
    OLD_COLOR="GREEN"
fi

echo "🟢 새 배포 포트: $NEW_PORT ($NEW_COLOR)"

# Step 1: 새 컨테이너 시작
echo "📦 Step 1: 새 컨테이너 시작..."
docker pull $IMAGE_NAME:$IMAGE_TAG

docker run -d \
    --name boot-container-$NEW_COLOR \
    -p $NEW_PORT:8080 \
    -e SPRING_PROFILES_ACTIVE=secure \
    -e DB_PASSWORD=$DB_PASSWORD \
    $IMAGE_NAME:$IMAGE_TAG

echo "⏳ 컨테이너 초기화 대기 (10초)..."
sleep 10

# Step 2: Health Check
echo "🏥 Step 2: Health Check..."
MAX_RETRIES=30
for i in $(seq 1 $MAX_RETRIES); do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$NEW_PORT/actuator/health || echo "000")
    
    if [ "$HTTP_CODE" -eq 200 ]; then
        echo "✅ Health Check 성공!"
        break
    fi
    
    if [ $i -eq $MAX_RETRIES ]; then
        echo "❌ Health Check 실패! 롤백..."
        docker stop boot-container-$NEW_COLOR
        docker rm boot-container-$NEW_COLOR
        exit 1
    fi
    
    echo "[$i/$MAX_RETRIES] 재시도..."
    sleep 2
done

# Step 3: Nginx 트래픽 전환
echo "🔄 Step 3: Nginx 트래픽 전환..."
sudo sed -i "s/server localhost:[0-9]\+/server localhost:$NEW_PORT/" /etc/nginx/sites-available/coreconnect
sudo nginx -t
sudo systemctl reload nginx

echo "✅ 트래픽이 $NEW_COLOR ($NEW_PORT)로 전환되었습니다."

# Step 4: 이전 컨테이너 중지 (유예 시간 30초)
echo "⏳ Step 4: 이전 컨테이너 중지 (30초 후)..."
sleep 30

OLD_CONTAINER="boot-container-$OLD_COLOR"
if [ "$OLD_COLOR" == "BLUE" ]; then
    OLD_CONTAINER="boot-container"  # 첫 배포 시 기존 이름
fi

docker stop $OLD_CONTAINER 2>/dev/null || true
docker rm $OLD_CONTAINER 2>/dev/null || true

echo "🧹 Step 5: 정리..."
docker image prune -f

echo "🎉 배포 완료! ($OLD_COLOR → $NEW_COLOR)"
echo "현재 활성: http://localhost:$NEW_PORT"
```

**Step 3: GitHub Actions 수정 (1시간)**
```yaml
# .github/workflows/cd.yml (일부 수정)
- name: 🚀 Blue-Green Deploy
  run: |
    ssh $SSH_USER@$SSH_HOST << 'EOF'
      export DOCKER_USERNAME=$DOCKER_USERNAME
      export DB_PASSWORD=$DB_PASSWORD
      bash /home/ubuntu/scripts/blue_green_deploy.sh $IMAGE_TAG
    EOF
```

#### ✅ 완료 체크리스트
- [ ] Nginx 설정 완료
- [ ] Blue-Green 배포 스크립트 작성
- [ ] GitHub Actions 수정
- [ ] 테스트 배포 성공
- [ ] 무중단 배포 확인 (Downtime 0초)
- [ ] 롤백 테스트 통과

#### 📊 개선 효과
```
Before (Phase 1):
- 서비스 중단: 2-5분
- 배포 실패 시 복구: 10분+

After (Phase 2):
- 서비스 중단: 0초 ✅
- 배포 실패 시 자동 롤백: 30초
```

---

### ✅ 개선 #5: 자동 롤백

#### 📋 기본 정보
- **난이도**: ⭐⭐☆☆☆ (보통)
- **소요 시간**: 1일
- **비용**: 0원
- **효과**: 장애 복구 시간 90% 단축
- **리스크**: 낮음

#### 📝 실행 단계

**Step 1: 롤백 스크립트 (2시간)**
```bash
# scripts/rollback.sh
#!/bin/bash

set -e

echo "🔄 롤백 시작..."

# 1. 현재 활성 컨테이너 확인
CURRENT_PORT=$(docker inspect boot-container --format='{{(index (index .NetworkSettings.Ports "8080/tcp") 0).HostPort}}')

# 2. 이전 포트로 복원
if [ "$CURRENT_PORT" == "8080" ]; then
    TARGET_PORT=8081
    TARGET_CONTAINER="boot-container-GREEN"
else
    TARGET_PORT=8080
    TARGET_CONTAINER="boot-container-BLUE"
fi

# 3. 이전 컨테이너가 있는지 확인
if ! docker ps -a --format '{{.Names}}' | grep -q "$TARGET_CONTAINER"; then
    echo "❌ 이전 컨테이너를 찾을 수 없습니다!"
    echo "수동 복구가 필요합니다."
    exit 1
fi

# 4. 이전 컨테이너 재시작
echo "🔄 이전 버전으로 복원 중..."
docker start $TARGET_CONTAINER

# 5. Health Check
sleep 5
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$TARGET_PORT/actuator/health)

if [ "$HTTP_CODE" -ne 200 ]; then
    echo "❌ 롤백 실패! 이전 버전도 정상 동작하지 않습니다."
    exit 1
fi

# 6. Nginx 트래픽 전환
sudo sed -i "s/server localhost:[0-9]\+/server localhost:$TARGET_PORT/" /etc/nginx/sites-available/coreconnect
sudo nginx -t
sudo systemctl reload nginx

# 7. 현재(문제) 컨테이너 중지
docker stop boot-container
docker rm boot-container

echo "✅ 롤백 완료! 이전 버전으로 복원되었습니다."
echo "현재 활성: http://localhost:$TARGET_PORT"
```

**Step 2: GitHub Actions 롤백 워크플로우 (1시간)**
```yaml
# .github/workflows/rollback.yml
name: Rollback

on:
  workflow_dispatch:  # 수동 실행
    inputs:
      reason:
        description: '롤백 사유'
        required: true
        type: string

jobs:
  rollback:
    name: 🔄 Rollback to Previous Version
    runs-on: ubuntu-latest
    
    steps:
      - name: 🔐 Configure SSH
        env:
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
          SSH_HOST: ${{ secrets.SSH_HOST }}
          SSH_USER: ${{ secrets.SSH_USER }}
        run: |
          mkdir -p ~/.ssh
          echo "$SSH_PRIVATE_KEY" > ~/.ssh/id_rsa
          chmod 600 ~/.ssh/id_rsa
          ssh-keyscan -H $SSH_HOST >> ~/.ssh/known_hosts
      
      - name: 🔄 Execute Rollback
        run: |
          ssh $SSH_USER@$SSH_HOST << 'EOF'
            bash /home/ubuntu/scripts/rollback.sh
          EOF
      
      - name: 💬 Slack Notification
        uses: 8398a7/action-slack@v3
        with:
          status: custom
          custom_payload: |
            {
              text: "🔄 롤백 완료",
              attachments: [{
                color: 'warning',
                text: `Reason: ${{ github.event.inputs.reason }}\nExecuted by: ${{ github.actor }}`
              }]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

#### ✅ 완료 체크리스트
- [ ] 롤백 스크립트 작성
- [ ] GitHub Actions 롤백 워크플로우 추가
- [ ] 롤백 테스트 통과
- [ ] Slack 알림 확인

---

## 🟠 Phase 3: 고급 배포 전략 (1개월, 비용 월 $50-100)

### ✅ 개선 #6: Multi-Instance (Auto Scaling)

#### 📋 기본 정보
- **난이도**: ⭐⭐⭐⭐☆ (매우 어려움)
- **소요 시간**: 1주
- **비용**: 월 $50 (EC2 2대)
- **효과**: 고가용성, 부하 분산
- **리스크**: 높음

#### 🎯 아키텍처
```
            [Application Load Balancer]
                  /           \
        [EC2 Instance 1]  [EC2 Instance 2]
          - Backend          - Backend
          - MySQL Replica    - MySQL Replica
```

#### 📝 실행 단계 (개요)
```
1. AWS ALB 생성
2. EC2 Auto Scaling Group 설정
3. Target Group Health Check 설정
4. Rolling Update 전략 적용
5. CloudWatch 알람 설정
```

---

### ✅ 개선 #7: Monitoring & Alerting

#### 📋 기본 정보
- **난이도**: ⭐⭐⭐☆☆ (어려움)
- **소요 시간**: 3일
- **비용**: 월 $10 (Grafana Cloud)
- **효과**: 장애 조기 감지, 성능 모니터링
- **리스크**: 낮음

#### 📝 실행 단계

**Step 1: Prometheus + Grafana 설치 (Docker Compose) (2시간)**
```yaml
# docker-compose-monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    restart: always
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.enable-lifecycle'

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    restart: always
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana-data:/var/lib/grafana
    depends_on:
      - prometheus

volumes:
  prometheus-data:
  grafana-data:
```

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'spring-boot-app'
    metrics_path: '/actuator/prometheus'
    static_configs:
      - targets: ['host.docker.internal:8080']
```

**Step 2: Spring Boot Metrics 설정 (30분)**
```gradle
// build.gradle
dependencies {
    implementation 'io.micrometer:micrometer-registry-prometheus'
}
```

```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: health, info, metrics, prometheus
  metrics:
    export:
      prometheus:
        enabled: true
    tags:
      application: ${spring.application.name}
```

**Step 3: Grafana 대시보드 설정 (1시간)**
```
1. Grafana 접속: http://54.116.26.182:3000
2. Data Source 추가: Prometheus (http://prometheus:9090)
3. Dashboard Import: Spring Boot 2.1 Statistics (ID: 10280)
4. 커스텀 패널 추가:
   - API 응답 시간 (P95, P99)
   - 처리량 (RPS)
   - 에러율
   - DB Connection Pool 사용률
   - JVM 메모리 사용률
```

**Step 4: Alerting 설정 (2시간)**
```yaml
# prometheus.yml에 추가
rule_files:
  - 'alerts.yml'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

```yaml
# alerts.yml
groups:
  - name: application_alerts
    interval: 30s
    rules:
      # P95 응답시간 알림
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, http_server_requests_seconds_bucket) > 1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "높은 응답 시간 감지"
          description: "P95 응답시간이 1초를 초과했습니다."
      
      # 에러율 알림
      - alert: HighErrorRate
        expr: rate(http_server_requests_seconds_count{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "높은 에러율 감지"
          description: "5xx 에러율이 5%를 초과했습니다."
      
      # DB Connection Pool 알림
      - alert: ConnectionPoolExhausted
        expr: hikaricp_connections_active / hikaricp_connections_max > 0.9
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Connection Pool 고갈 위험"
          description: "Connection Pool 사용률이 90%를 초과했습니다."
      
      # 애플리케이션 다운 알림
      - alert: ApplicationDown
        expr: up{job="spring-boot-app"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "애플리케이션 다운"
          description: "Spring Boot 애플리케이션이 응답하지 않습니다."
```

#### ✅ 완료 체크리스트
- [ ] Prometheus + Grafana 설치
- [ ] Spring Boot Metrics 노출
- [ ] Grafana 대시보드 설정
- [ ] Alerting 규칙 설정
- [ ] Slack 알림 연동
- [ ] 테스트 알람 발생 확인

---

### ✅ 개선 #8: E2E 테스트 자동화

#### 📋 기본 정보
- **난이도**: ⭐⭐⭐☆☆ (어려움)
- **소요 시간**: 1주
- **비용**: 0원
- **효과**: 프로덕션 배포 전 검증
- **리스크**: 중간

#### 📝 실행 단계 (개요)
```
1. k6 Smoke Test 추가 (100 VU, 1분)
2. GitHub Actions에 E2E 단계 추가
3. 테스트 실패 시 배포 중단
4. 테스트 결과 Grafana Cloud 전송
```

---

## 🔴 Phase 4: Kubernetes (2개월+, 비용 월 $100+)

### ✅ 개선 #9: Kubernetes 마이그레이션

#### 📋 기본 정보
- **난이도**: ⭐⭐⭐⭐⭐ (최고 난이도)
- **소요 시간**: 1-2개월
- **비용**: 월 $100-300 (EKS)
- **효과**: 자동 스케일링, 고가용성, 선언적 배포
- **리스크**: 매우 높음

#### 🎯 Kubernetes 아키텍처
```
[AWS EKS Cluster]
├─ [Ingress (ALB)]
├─ [Service (ClusterIP)]
├─ [Deployment]
│  ├─ Pod 1 (Backend)
│  ├─ Pod 2 (Backend)
│  └─ Pod 3 (Backend)
├─ [HPA] (Auto Scaling)
└─ [ConfigMap, Secret]
```

#### 📝 주요 작업 (개요)
```
1. EKS 클러스터 생성
2. Dockerfile 최적화 (Multi-stage)
3. Kubernetes Manifests 작성
   - Deployment
   - Service
   - Ingress
   - ConfigMap/Secret
   - HorizontalPodAutoscaler
4. Helm Chart 작성
5. ArgoCD 설치 (GitOps)
6. CI/CD 파이프라인 전환
```

---

## 📊 전체 개선 로드맵 요약

### Phase별 타임라인 및 비용

| Phase | 기간 | 비용 | 핵심 개선 |
|-------|------|------|----------|
| **Phase 1** | 1주 | 0원 | CI/CD 자동화, Health Check |
| **Phase 2** | 2주 | 0원 | Blue-Green 배포, 무중단 배포 |
| **Phase 3** | 1개월 | 월 $50-100 | Multi-Instance, Monitoring |
| **Phase 4** | 2개월+ | 월 $100-300 | Kubernetes, GitOps |

### 최종 효과 예측

| 지표 | AS-IS | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|------|-------|---------|---------|---------|---------|
| **배포 소요 시간** | 15분 | 5분 | 5분 | 3분 | 2분 |
| **서비스 중단** | 2-5분 | 2-5분 | 0초 | 0초 | 0초 |
| **배포 자동화** | 0% | 100% | 100% | 100% | 100% |
| **테스트 자동화** | 20% | 80% | 80% | 100% | 100% |
| **롤백 시간** | 10분+ | 10분 | 30초 | 30초 | 10초 |
| **장애 감지** | 10분+ | 5분 | 1분 | 10초 | 5초 |
| **고가용성** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Auto Scaling** | ❌ | ❌ | ❌ | 수동 | 자동 |

---

## 🎯 우선순위 의사결정 가이드

### 즉시 시작 (🔥 최우선)
```
✅ Phase 1: CI/CD 자동화
→ 이유: 비용 0원, 배포 시간 67% 단축, 기본 중의 기본
```

### 2주 내 완료 (⚠️ 중요)
```
✅ Phase 2: 무중단 배포
→ 이유: 서비스 중단 0초 달성, 사용자 경험 개선
```

### 1-2개월 내 완료 (💡 권장)
```
✅ Phase 3: Multi-Instance + Monitoring
→ 이유: 고가용성 확보, 장애 조기 감지
```

### 장기 계획 (📅 선택)
```
⚠️ Phase 4: Kubernetes
→ 이유: 트래픽 1000+ VUs 시 필요, 대규모 확장 시
```

---

## 📋 면접 답변 가이드

### Q: "현재 배포 프로세스의 문제점은?"
```
"현재는 수동 배포로 15분이 소요되고, 2-5분간 서비스 중단이 발생합니다.
또한 테스트 자동화가 없어 버그가 프로덕션에 배포될 위험이 있습니다."
```

### Q: "어떻게 개선했나요?"
```
"3단계로 개선했습니다.

Phase 1은 GitHub Actions로 CI/CD를 자동화하여 배포 시간을 67% 단축했습니다.

Phase 2는 Blue-Green 배포로 서비스 중단을 0초로 만들었고,
자동 롤백 기능으로 장애 복구 시간을 90% 단축했습니다.

Phase 3는 Multi-Instance와 Prometheus/Grafana로
고가용성과 실시간 모니터링을 구축했습니다."
```

### Q: "Kubernetes를 도입할 계획은?"
```
"현재는 트래픽이 45 VU 수준이므로 EC2 Blue-Green 배포로 충분합니다.

하지만 트래픽이 500+ VU로 증가하면 Kubernetes 도입을 고려할 것입니다.
K8s는 자동 스케일링, 선언적 배포, GitOps 등의 장점이 있지만,
학습 곡선이 높고 비용이 월 $100+이므로 적절한 시기에 도입해야 합니다."
```

---

**작성일**: 2025-12-17  
**목적**: 배포 및 CI/CD 개선 플랜  
**버전**: 1.0  
**예상 완료**: Phase 1-2는 3주, Phase 3는 2개월

