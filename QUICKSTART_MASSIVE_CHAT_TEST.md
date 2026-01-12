# ⚡ 10만명 동시 접속 채팅 부하 테스트 - 빠른 시작

## 📋 체크리스트

시작하기 전에 다음을 확인하세요:

- [ ] Docker 설치됨 ✅
- [ ] MySQL 서버 실행 중 ✅
- [ ] 백엔드 서버 실행 중 ✅
- [ ] K6 설치됨 (또는 Docker 사용)

## 🚀 3단계로 시작하기

### Step 1: 모니터링 환경 시작 (30초)

```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

**확인:**
- InfluxDB: http://localhost:8086
- Grafana: http://localhost:3000 (admin/admin123)

### Step 2: 테스트 사용자 생성 (1-10분)

```bash
# MySQL 접속
mysql -u root -p coreconnect

# SQL 파일 실행
source 테스트_사용자_10만명_생성.sql
```

**소규모 테스트 (권장 - 1,000명):**
```sql
CALL CreateTestUsers(1000);
```

**대규모 테스트 (100,000명 - 시간 소요):**
```sql
CALL CreateTestUsers(100000);
```

### Step 3: 테스트 실행

**Windows:**
```bash
run-massive-chat-test.bat
```

**Linux/Mac:**
```bash
chmod +x run-massive-chat-test.sh
./run-massive-chat-test.sh
```

메뉴에서 선택:
1. **대규모 부하 테스트** (10만명) - 프로덕션 시뮬레이션
2. **중간 부하 테스트** (1만명) - 성능 검증
3. **소규모 테스트** (1,000명) - 로컬 개발 테스트 ⭐ 권장

## 📊 실시간 모니터링

테스트가 시작되면 Grafana 대시보드를 열어보세요:

**URL:** http://localhost:3000

**대시보드:** "K6 - 10만명 동시 접속 채팅 부하 테스트"

**주요 메트릭:**
- 🔴 메시지 응답 시간
- 🟢 메시지 전달 성공률
- 🔵 활성 사용자 수 (VUs)
- 🟡 초당 요청 수 (RPS)

## 📈 결과 해석

### ✅ 좋은 결과

```
✅ 로그인 성공률: 98%+
✅ 메시지 전달 성공률: 95%+
✅ P95 응답 시간: < 3초
✅ 순서 보장률: 99%+
```

### ⚠️ 개선 필요

```
⚠️ 로그인 성공률: 90-98%
⚠️ 메시지 전달 성공률: 85-95%
⚠️ P95 응답 시간: 3-5초
⚠️ 순서 보장률: 95-99%
```

### ❌ 즉시 개선 필요

```
❌ 로그인 성공률: < 90%
❌ 메시지 전달 성공률: < 85%
❌ P95 응답 시간: > 5초
❌ 순서 보장률: < 95%
```

## 🎯 측정하는 것

### 1. 서버 응답 시간
**질문:** "10만명이 동시에 메시지를 보낼 때 서버가 몇 초 만에 응답하는가?"

**측정:** P95 응답 시간 (95%의 사용자가 경험하는 응답 시간)

### 2. 메시지 순서 보장
**질문:** "10만개의 메시지가 순서대로 도착하는가?"

**측정:** 순서 위반 건수 / 전체 메시지 수

### 3. 메시지 조회 시간
**질문:** "10만개의 메시지를 조회하는 데 얼마나 걸리는가?"

**측정:** 1,000개 단위 조회 시간 평균

## 🔧 빠른 문제 해결

### 백엔드 서버가 응답하지 않음

```bash
# 서버 상태 확인
curl http://localhost:8080/api/health

# 서버 재시작
docker-compose restart backend

# 로그 확인
docker logs boot-container
```

### Grafana가 열리지 않음

```bash
# 모니터링 재시작
docker-compose -f docker-compose.monitoring.yml restart

# 30초 대기 후 다시 시도
```

### 테스트 사용자가 없음

```bash
# 사용자 수 확인
mysql -u root -p coreconnect -e "SELECT COUNT(*) FROM users WHERE email LIKE 'testuser%@test.com';"

# 사용자가 없으면 Step 2로 돌아가서 생성
```

## 📁 생성되는 파일

테스트 완료 후:

```
📄 summary.json       # JSON 형식의 상세 결과
📄 summary.html       # HTML 리포트 (브라우저로 열기)
```

**HTML 리포트 열기:**
```bash
# Windows
start summary.html

# macOS
open summary.html

# Linux
xdg-open summary.html
```

## 💡 팁

### 1. 소규모로 먼저 테스트하세요
처음에는 1,000명으로 시작하여 시스템이 잘 작동하는지 확인하세요.

### 2. Grafana를 계속 열어두세요
실시간으로 문제를 발견할 수 있습니다.

### 3. 서버 리소스를 모니터링하세요
```bash
# CPU/메모리 사용량 확인
docker stats
```

### 4. 테스트 후 정리
```bash
# 테스트 사용자 삭제 (선택사항)
mysql -u root -p coreconnect -e "DELETE FROM users WHERE email LIKE 'testuser%@test.com';"
```

## 📚 더 자세한 내용

- [K6_10만명_동시접속_테스트_가이드.md](K6_10만명_동시접속_테스트_가이드.md) - 완전한 가이드
- [대규모_트래픽_아키텍처_개선안.md](대규모_트래픽_아키텍처_개선안.md) - 개선 방안

## 🆘 도움이 필요하신가요?

1. 콘솔 로그를 확인하세요
2. Docker 로그를 확인하세요: `docker logs <container-name>`
3. Grafana 대시보드에서 메트릭을 확인하세요
4. 이슈를 생성하거나 팀에 문의하세요

---

**시작 시간:** 약 5분  
**테스트 시간:** 소규모 5분 ~ 대규모 20분  
**난이도:** ⭐⭐☆☆☆

**화이팅! 🚀**







