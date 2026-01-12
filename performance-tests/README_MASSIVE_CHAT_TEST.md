# 📊 대규모 채팅 부하 테스트 (10만명 동시 접속)

## 🚀 빠른 시작

### 1단계: 모니터링 환경 시작

```bash
# 루트 디렉토리에서 실행
docker-compose -f docker-compose.monitoring.yml up -d
```

### 2단계: 테스트 사용자 생성

```bash
# MySQL 접속
mysql -u root -p coreconnect

# SQL 실행
source 테스트_사용자_10만명_생성.sql

# 소규모 테스트 (1,000명) - 권장
CALL CreateTestUsers(1000);

# 대규모 테스트 (10만명) - 시간 소요
# CALL CreateTestUsers(100000);
```

### 3단계: 백엔드 서버 시작

```bash
docker-compose up -d backend
```

### 4단계: 테스트 실행

#### Windows
```bash
run-massive-chat-test.bat
```

#### Linux/Mac
```bash
./run-massive-chat-test.sh
```

## 📈 결과 확인

### Grafana 대시보드
- URL: http://localhost:3000
- 로그인: `admin` / `admin123`
- 대시보드: "K6 - 10만명 동시 접속 채팅 부하 테스트"

### 리포트 파일
- `summary.html` - HTML 리포트
- `summary.json` - JSON 상세 데이터

## 📊 측정 지표

| 지표 | 설명 | 목표 |
|------|------|------|
| 메시지 응답 시간 (P95) | 95%의 메시지 응답 시간 | < 3초 |
| 메시지 전달 성공률 | 전송 메시지 중 전달 성공 비율 | ≥ 90% |
| 메시지 순서 보장률 | 메시지 순서 정확도 | ≥ 99% |
| 메시지 조회 시간 (1000개) | 1000개 메시지 조회 시간 | < 5초 |

## 🎯 테스트 옵션

### 옵션 1: 소규모 (1,000명)
- 사용자: 1,000명
- 램프업: 1분
- 유지: 3분
- 용도: 로컬 테스트

### 옵션 2: 중간 부하 (10,000명)
- 사용자: 10,000명
- 램프업: 2분
- 유지: 5분
- 용도: 성능 검증

### 옵션 3: 대규모 (100,000명)
- 사용자: 100,000명
- 램프업: 5분
- 유지: 10분
- 용도: 최종 부하 테스트

## 🔧 환경 변수

```bash
BASE_URL=http://localhost:8080      # 백엔드 URL
WS_URL=ws://localhost:8080          # WebSocket URL
TEST_ROOM_ID=1                      # 테스트 채팅방 ID
TOTAL_USERS=100000                  # 동시 접속 사용자 수
RAMP_UP_TIME=5m                     # 램프업 시간
STEADY_TIME=10m                     # 유지 시간
RAMP_DOWN_TIME=2m                   # 램프다운 시간
```

## 📝 파일 구조

```
.
├── performance-tests/
│   ├── massive-chat-load-test.js       # 메인 K6 테스트 스크립트
│   └── README_MASSIVE_CHAT_TEST.md     # 이 파일
├── grafana/
│   ├── provisioning/
│   │   ├── datasources/
│   │   │   └── influxdb.yml            # InfluxDB 연결 설정
│   │   └── dashboards/
│   │       └── dashboard.yml           # 대시보드 프로비저닝
│   └── dashboards/
│       └── k6-massive-chat-dashboard.json  # K6 대시보드
├── docker-compose.monitoring.yml       # 모니터링 환경 (InfluxDB + Grafana)
├── run-massive-chat-test.bat          # Windows 실행 스크립트
├── run-massive-chat-test.sh           # Linux/Mac 실행 스크립트
├── 테스트_사용자_10만명_생성.sql       # 사용자 생성 SQL
└── K6_10만명_동시접속_테스트_가이드.md  # 상세 가이드
```

## 🐛 문제 해결

### 로그인 실패

```bash
# 테스트 사용자 확인
mysql -u root -p -e "SELECT COUNT(*) FROM users WHERE email LIKE 'testuser%@test.com';" coreconnect
```

### InfluxDB 연결 실패

```bash
# InfluxDB 재시작
docker-compose -f docker-compose.monitoring.yml restart influxdb

# 로그 확인
docker logs k6-influxdb
```

### 메모리 부족

Docker Desktop 설정:
- CPU: 4 cores 이상
- Memory: 8GB 이상

## 📚 추가 문서

- [K6_10만명_동시접속_테스트_가이드.md](../K6_10만명_동시접속_테스트_가이드.md) - 상세 가이드
- [대규모_트래픽_아키텍처_개선안.md](../대규모_트래픽_아키텍처_개선안.md) - 아키텍처 개선안

---

**버전:** 1.0.0  
**최종 업데이트:** 2025년 1월







