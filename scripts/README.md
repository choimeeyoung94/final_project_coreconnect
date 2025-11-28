# 🏥 CoreConnect 헬스체크 스크립트

## 📋 개요

CI/CD 파이프라인에서 배포 후 시스템이 정상 작동하는지 확인하는 종합 헬스체크 스크립트입니다.

## 🎯 주요 기능

### 1. **5단계 헬스체크**
1. ✅ Docker 컨테이너 상태 확인
2. ✅ Backend 포트 확인 (TCP 8080)
3. ✅ Backend 헬스체크 API (`GET /api/health`)
4. ✅ Frontend 접근 확인 (`GET /`)
5. ✅ 상세 헬스체크 (DB 연결 포함)

### 2. **재시도 로직**
- 최대 30회 재시도 (커스터마이징 가능)
- 2초 간격 (커스터마이징 가능)
- 전체 타임아웃 120초 (커스터마이징 가능)

### 3. **자동 롤백**
- 헬스체크 실패 시 자동으로 이전 버전으로 롤백

### 4. **상세 로깅**
- 색상 코드로 구분된 로그 (INFO, SUCCESS, WARNING, ERROR)
- Verbose 모드 지원
- 컨테이너 로그 자동 출력

---

## 🚀 사용법

### 기본 사용

```bash
# 실행 권한 부여
chmod +x scripts/healthcheck.sh

# 기본 설정으로 실행
./scripts/healthcheck.sh
```

### 옵션 사용

```bash
# 모든 옵션 지정
./scripts/healthcheck.sh \
  --max-retries 30 \
  --interval 2 \
  --timeout 120 \
  --host localhost \
  --port 80 \
  --backend-port 8080 \
  --verbose
```

### 옵션 설명

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `--max-retries` | 최대 재시도 횟수 | 30 |
| `--interval` | 재시도 간격(초) | 2 |
| `--timeout` | 전체 타임아웃(초) | 120 |
| `--host` | 호스트 주소 | localhost |
| `--port` | 포트 | 80 |
| `--backend-port` | 백엔드 포트 | 8080 |
| `--verbose` | 상세 로그 출력 | false |
| `--help` | 도움말 출력 | - |

---

## 📊 실행 예시

### 성공 케이스

```bash
$ ./scripts/healthcheck.sh --verbose

[INFO] 2025-11-28 10:00:00 - 헬스체크 시작
[INFO] 2025-11-28 10:00:00 - 설정: MAX_RETRIES=30, INTERVAL=2s, TIMEOUT=120s
[INFO] 2025-11-28 10:00:00 - 대상: http://localhost:80

[INFO] 2025-11-28 10:00:00 - 1단계: Docker 컨테이너 상태 확인
[DEBUG] 2025-11-28 10:00:00 - 컨테이너 상태 확인: boot-container
[DEBUG] 2025-11-28 10:00:00 -   - Status: running
[DEBUG] 2025-11-28 10:00:00 -   - Health: healthy
[SUCCESS] 2025-11-28 10:00:00 - ✓ Backend 컨테이너 실행 중
[SUCCESS] 2025-11-28 10:00:01 - ✓ Frontend 컨테이너 실행 중

[INFO] 2025-11-28 10:00:01 - 2단계: Backend 포트 확인 (재시도)
[DEBUG] 2025-11-28 10:00:01 - Backend 포트 체크 시작 (8080)
[DEBUG] 2025-11-28 10:00:01 - Backend 포트 열림: 8080
[SUCCESS] 2025-11-28 10:00:01 - ✓ Backend 포트 열림 (8080)

[INFO] 2025-11-28 10:00:01 - 3단계: Backend 헬스체크 API 호출 (재시도)
[DEBUG] 2025-11-28 10:00:01 - Backend 헬스체크 API 호출 중...
[DEBUG] 2025-11-28 10:00:01 -   - HTTP Status Code: 200
[SUCCESS] 2025-11-28 10:00:01 - ✓ Backend 헬스체크 API 정상 (GET /api/health)

[INFO] 2025-11-28 10:00:01 - 4단계: Frontend 접근 확인
[SUCCESS] 2025-11-28 10:00:01 - ✓ Frontend 접근 정상

[INFO] 2025-11-28 10:00:01 - 5단계: 상세 헬스체크 (DB 연결)
[DEBUG] 2025-11-28 10:00:01 - 상세 헬스체크 API 호출 중...
[DEBUG] 2025-11-28 10:00:01 -   - Database Status: UP
[SUCCESS] 2025-11-28 10:00:01 - ✓ 데이터베이스 연결 정상

========================================
[SUCCESS] 2025-11-28 10:00:01 - 🎉 모든 헬스체크 통과!
[INFO] 2025-11-28 10:00:01 - 총 소요 시간: 1초
========================================
```

### 실패 케이스 (자동 롤백)

```bash
$ ./scripts/healthcheck.sh

[INFO] 2025-11-28 10:00:00 - 헬스체크 시작
[INFO] 2025-11-28 10:00:00 - 1단계: Docker 컨테이너 상태 확인
[SUCCESS] 2025-11-28 10:00:00 - ✓ Backend 컨테이너 실행 중
[SUCCESS] 2025-11-28 10:00:00 - ✓ Frontend 컨테이너 실행 중

[INFO] 2025-11-28 10:00:00 - 2단계: Backend 포트 확인 (재시도)
[INFO] 2025-11-28 10:00:02 - 재시도 중... (1/30)
[INFO] 2025-11-28 10:00:04 - 재시도 중... (2/30)
[INFO] 2025-11-28 10:00:06 - 재시도 중... (3/30)
...
[ERROR] 2025-11-28 10:01:00 - Backend 포트가 열리지 않았습니다 (30회 시도)
[INFO] 2025-11-28 10:01:00 - 컨테이너 로그 (boot-container):
========================================
[컨테이너 로그 출력]
========================================
[ERROR] 2025-11-28 10:01:00 - 헬스체크 실패
```

---

## 🔧 CI/CD에서 사용

### GitHub Actions

```yaml
- name: Deploy with Docker Compose on EC2
  uses: appleboy/ssh-action@v1
  with:
    host: ${{ secrets.EC2_HOST }}
    username: ${{ secrets.EC2_USER }}
    key: ${{ secrets.EC2_SSH_KEY }}
    script: |
      cd /home/ubuntu/website

      # 배포
      docker compose up --build -d

      # 헬스체크
      chmod +x scripts/healthcheck.sh
      if ! ./scripts/healthcheck.sh --max-retries 30 --interval 2 --timeout 120; then
        echo "❌ 헬스체크 실패! 롤백 시작..."
        # 롤백 로직
        docker compose down
        docker tag app:backup app:latest
        docker compose up -d
        exit 1
      fi

      echo "✅ 배포 성공!"
```

---

## 🧪 로컬 테스트

### 1. Docker Compose 실행

```bash
# 프로젝트 루트에서
docker compose up --build -d
```

### 2. 헬스체크 실행

```bash
# 기본 헬스체크
./scripts/healthcheck.sh

# 상세 로그 포함
./scripts/healthcheck.sh --verbose

# 빠른 테스트 (재시도 5회)
./scripts/healthcheck.sh --max-retries 5 --interval 1
```

### 3. 수동 API 테스트

```bash
# 기본 헬스체크
curl http://localhost/api/health

# 상세 헬스체크 (DB 연결 포함)
curl http://localhost/api/health/detailed

# Readiness Probe
curl http://localhost/api/health/ready

# Liveness Probe
curl http://localhost/api/health/live
```

---

## 📝 체크 항목

### ✅ 컨테이너 상태
- Backend 컨테이너 (`boot-container`) 실행 중
- Frontend 컨테이너 (`nginx-container`) 실행 중

### ✅ 네트워크
- Backend 포트 8080 열림 (TCP)
- Frontend 포트 80 열림

### ✅ API
- `GET /api/health` → HTTP 200
- `GET /api/health/detailed` → HTTP 200 + DB UP
- `GET /` → HTTP 200

### ✅ 데이터베이스
- MySQL 연결 정상
- `SELECT 1` 쿼리 성공

---

## 🐛 트러블슈팅

### 1. "Backend 포트가 열리지 않았습니다"

**원인**: Spring Boot 애플리케이션 시작 지연

**해결**:
```bash
# 재시도 횟수 증가
./scripts/healthcheck.sh --max-retries 60 --interval 3

# 컨테이너 로그 확인
docker logs boot-container
```

### 2. "데이터베이스 연결 실패"

**원인**: MySQL 컨테이너 준비 안 됨

**해결**:
```bash
# MySQL 컨테이너 확인
docker ps | grep mysql
docker logs [mysql-container-name]

# .env 파일 확인
cat .env | grep MYSQL
```

### 3. "헬스체크 API 호출 실패"

**원인**: Nginx 설정 또는 라우팅 문제

**해결**:
```bash
# Nginx 설정 확인
docker exec nginx-container nginx -t

# Backend 직접 호출
docker exec boot-container curl localhost:8080/api/health

# Nginx를 거쳐 호출
curl http://localhost/api/health
```

### 4. "타임아웃 발생"

**원인**: 전체 타임아웃(120초) 초과

**해결**:
```bash
# 타임아웃 증가
./scripts/healthcheck.sh --timeout 300

# 상세 로그 확인
./scripts/healthcheck.sh --verbose
```

---

## 🔍 로그 분석

### 색상 코드

- 🔵 **BLUE** (INFO): 일반 정보
- 🟢 **GREEN** (SUCCESS): 성공
- 🟡 **YELLOW** (WARNING): 경고 (치명적이지 않음)
- 🔴 **RED** (ERROR): 오류 (치명적)

### 로그 레벨

```bash
# DEBUG (--verbose 옵션 필요)
[DEBUG] 2025-11-28 10:00:00 - 상세한 디버깅 정보

# INFO
[INFO] 2025-11-28 10:00:00 - 일반 진행 상황

# SUCCESS
[SUCCESS] 2025-11-28 10:00:00 - ✓ 성공 메시지

# WARNING
[WARNING] 2025-11-28 10:00:00 - 경고 메시지

# ERROR
[ERROR] 2025-11-28 10:00:00 - 오류 메시지
```

---

## 📚 참고 자료

### 관련 파일
- `.github/workflows/cicd.yml` - CI/CD 파이프라인
- `backend/.../HealthCheckController.java` - 헬스체크 API
- `EXCEPTION_HANDLING_GUIDE.md` - 예외 처리 가이드

### 헬스체크 API
- `GET /api/health` - 기본 헬스체크
- `GET /api/health/detailed` - 상세 헬스체크 (DB 포함)
- `GET /api/health/ready` - Readiness Probe
- `GET /api/health/live` - Liveness Probe

---

## 🚀 고급 사용

### 커스텀 컨테이너 이름

스크립트 내부의 변수를 수정하여 커스텀 컨테이너 이름 사용:

```bash
# healthcheck.sh 파일 수정
BACKEND_CONTAINER="my-backend-container"
FRONTEND_CONTAINER="my-frontend-container"
```

### 외부 서버 헬스체크

```bash
# EC2 인스턴스의 Public IP로 헬스체크
./scripts/healthcheck.sh --host 3.34.123.45 --port 80
```

### jq 설치 (JSON 파싱)

```bash
# Ubuntu/Debian
sudo apt-get install jq

# CentOS/RHEL
sudo yum install jq

# macOS
brew install jq
```

jq가 설치되면 상세 헬스체크에서 JSON 응답을 파싱하여 더 정확한 상태 확인 가능.

---

**작성일**: 2025-11-28
**버전**: 1.0
**작성자**: CoreConnect Team
