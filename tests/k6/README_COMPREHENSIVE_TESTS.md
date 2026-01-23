# CoreConnect 포괄적 부하 테스트

> **작성일**: 2026-01-18  
> **작성자**: 20년차 Spring 백엔드 시니어 개발자  
> **전문 분야**: 성능 최적화, Redis, Kafka, 채팅/알림/메일 시스템

---

## 🎯 빠른 시작

### 1분 만에 시작하기

```bash
# 1. k6 Cloud 로그인
k6 login cloud

# 2. 모든 테스트 실행 (Windows)
cd tests/k6
run-all-load-tests.bat

# 또는 (Linux/macOS)
chmod +x run-all-load-tests.sh
./run-all-load-tests.sh
```

---

## 📦 테스트 파일

| 파일명 | 대상 기능 | 소요 시간 | 최대 VU |
|--------|----------|----------|---------|
| `email-stress-test-cloud.js` | 이메일 시스템 | 20분 | 1,000 |
| `notification-stress-test-cloud.js` | 알림 시스템 | 12분 | 1,500 |
| `chat-enhanced-stress-test-cloud.js` | 채팅 시스템 | 20분 | 1,500 |
| `integrated-stress-test-cloud.js` | 통합 시스템 | 20분 | 1,500 |

---

## 🚀 개별 테스트 실행

### Email 시스템 테스트
```bash
k6 cloud email-stress-test-cloud.js
```

**측정 항목**:
- ✅ 이메일 발송 성능
- ✅ 받은편지함 조회 (N+1 문제 체크)
- ✅ DB 쿼리 성능

---

### Notification 시스템 테스트
```bash
k6 cloud notification-stress-test-cloud.js
```

**측정 항목**:
- ✅ 알림 발송 성능
- ✅ 버스트 처리 능력
- ✅ Kafka/Redis 성능

---

### Chat 시스템 테스트
```bash
k6 cloud chat-enhanced-stress-test-cloud.js
```

**측정 항목**:
- ✅ WebSocket 연결 안정성
- ✅ 메시지 송수신 성능
- ✅ 메시지 손실률

---

### 통합 시스템 테스트 (★ 가장 중요)
```bash
k6 cloud integrated-stress-test-cloud.js
```

**측정 항목**:
- ✅ 전체 시스템 처리량
- ✅ 기능별 병목 지점
- ✅ 시스템 건강도

---

## 📊 주요 메트릭

### 처리량 (Throughput)
- `total_throughput` - 초당 전체 요청 수
- `messages_per_second` - 초당 메시지 수

### 지연시간 (Latency)
- `p95` - 95%의 요청 응답 시간
- `p99` - 99%의 요청 응답 시간

### 병목 지점 (Bottleneck)
- `chat_bottleneck` - 채팅 병목 비율
- `email_bottleneck` - 이메일 병목 비율
- `notification_bottleneck` - 알림 병목 비율

### 인프라 성능
- `redis_latency` - Redis 지연시간
- `kafka_latency` - Kafka 지연시간
- `db_query_duration` - DB 쿼리 시간

---

## 🔍 결과 분석

### k6 Cloud Dashboard

테스트 실행 후 자동으로 생성되는 URL에서 확인:
```
Test running at: https://app.k6.io/runs/XXXXX
```

### 핵심 체크포인트

1. **Thresholds 탭** - 임계값 통과 여부
2. **Performance 탭** - 전체 성능 개요
3. **Custom Metrics 탭** - 병목 지점 분석 (★ 가장 중요)

---

## ⚠️ 병목 지점 파악 방법

### Step 1: 병목 기능 식별
```
Custom Metrics에서 확인:
- chat_bottleneck
- email_bottleneck  
- notification_bottleneck

가장 높은 값 = 가장 큰 병목
```

### Step 2: 인프라 레이어 분석
```
병목 기능의 인프라 메트릭 확인:
- redis_latency (Redis 문제?)
- kafka_latency (Kafka 문제?)
- db_query_duration (DB 문제?)
```

### Step 3: 근본 원인 파악
```
서버 로그 및 모니터링 확인:
- Application CPU/Memory
- Redis 메모리 사용률
- Kafka Consumer Lag
- Database Slow Query
```

---

## 💡 최적화 우선순위

### Quick Win (1주일)
1. ✅ N+1 쿼리 수정
2. ✅ 누락된 Index 추가
3. ✅ Redis 캐싱 적용

### Medium Term (1개월)
1. ⬜ Kafka Partition 증가
2. ⬜ Redis Cluster 구성
3. ⬜ Database Read Replica 추가

### Long Term (3개월)
1. ⬜ Horizontal Scaling (Pod 증가)
2. ⬜ CQRS 패턴 적용
3. ⬜ Event Sourcing 도입

---

## 📚 상세 가이드

더 자세한 내용은 다음 문서를 참조하세요:

📖 **[COMPREHENSIVE_LOAD_TEST_GUIDE.md](./COMPREHENSIVE_LOAD_TEST_GUIDE.md)**

내용:
- 전문가의 성능 최적화 접근법
- 메트릭별 상세 분석 방법
- 병목 지점별 해결 방안
- 성능 개선 로드맵

---

## 🎓 시니어 개발자의 조언

### 성능 최적화 핵심 원칙

1. **측정 가능한 것만 개선 가능**
   - 추측하지 말고 측정하라
   - 데이터 기반 의사결정

2. **가장 큰 병목부터 해결**
   - 80/20 법칙 적용
   - ROI가 높은 것 우선

3. **인프라 레이어별 분석**
   - Application → Database → Messaging
   - 각 레이어의 특성 이해

4. **지속적 모니터링**
   - 최적화 후 반드시 재측정
   - Grafana + Prometheus 구축

---

## 🛠️ 문제 해결

### k6 Cloud 로그인 실패
```bash
k6 login cloud --token YOUR_TOKEN
```

### 환경 변수 설정
```bash
# Windows
set BASE_URL=http://your-server:8080
set WS_URL=ws://your-server:8080

# Linux/macOS
export BASE_URL=http://your-server:8080
export WS_URL=ws://your-server:8080
```

### 테스트 중단
```bash
# Ctrl+C로 중단 후
k6 cloud --abort RUN_ID
```

---

## 📞 지원

- **문서**: [K6 Documentation](https://k6.io/docs/)
- **커뮤니티**: [K6 Community Forum](https://community.k6.io/)
- **버그 리포트**: [GitHub Issues](https://github.com/grafana/k6/issues)

---

## ✨ 기대 효과

이 테스트 suite를 통해:

1. ✅ **정확한 성능 측정**
   - 처리량, 지연시간, 병목 지점 명확히 파악

2. ✅ **데이터 기반 최적화**
   - 추측이 아닌 측정 데이터로 의사결정

3. ✅ **프로덕션 준비도 검증**
   - 실제 부하에서의 시스템 안정성 확인

4. ✅ **성능 개선 로드맵 수립**
   - Quick Win부터 Long Term까지 단계별 계획

---

**Happy Load Testing! 🚀**

*"측정하지 않으면 개선할 수 없다" - Peter Drucker*
