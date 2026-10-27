# CoreConnect - 실시간 협업 그룹웨어 플랫폼

CoreConnect는 **실시간 채팅·이메일·전자결재·일정 관리**를 하나의 시스템에서 제공하는 그룹웨어 플랫폼입니다.  
Spring Boot 기반 백엔드로 핵심 기능을 구현했고, 성능 병목을 **수치로 분석·개선**하며 안정적인 운영을 목표로 설계했습니다.

**발표 영상:** https://www.youtube.com/watch?v=zwhAtlYjLRY

---

## 폴더 구조

```
final_project_coreconnect/
├── backend/             Spring Boot 서버 (API, WebSocket, DB 접근)
├── frontend/            React + Vite 화면
├── docs/                설계·문제 해결·성능 분석 문서
├── performance-tests/   k6 부하 테스트 (채팅·이메일·알림·N+1 측정)
├── tests/k6/            k6 부하·스트레스 테스트 (k6 Cloud 포함)
├── k8s/                 Kubernetes(K3s) 배포 설정
├── monitoring/          Prometheus 수집 설정 + Grafana 연결 설정
├── grafana/             부하 테스트용 Grafana 대시보드
├── mysql/               MySQL Master-Slave 복제 설정 스크립트
├── nginx/               로컬 테스트용 Nginx 로드밸런서 설정
├── scripts/             배포·테스트 사용자 생성 스크립트
└── .github/workflows/   GitHub Actions CI/CD
```

| 폴더 | 내용 | 주요 파일 |
|---|---|---|
| `backend/` | Spring Boot 3.3 + JPA 서버. 채팅·이메일·전자결재·일정·근태·알림 기능 | `build.gradle`, `src/`, `Dockerfile`, `로컬_실행_가이드.md` |
| `frontend/` | React 19 + Vite로 만든 화면 | `package.json`, `vite.config.js`, `src/`, `Dockerfile` |
| `docs/` | 아키텍처 설계, N+1·Redis 캐싱·Kubernetes CI/CD 정리, 부하 테스트 계획·분석, 면접 대비 문서 | `N+1_문제_해결_상세_가이드.md`, `Redis_캐싱_전략_채팅.md`, `PERFORMANCE_ANALYSIS.md`, `KUBERNETES_CICD_완성.md` |
| `performance-tests/` | k6 부하 테스트 스크립트와 결과 분석. 채팅방 목록 N+1, 대량 채팅, STOMP 팬아웃, 이메일, 알림 | `chatroom-list-n-plus-1-test.js`, `massive-chat-load-test.js`, `k6-stomp-fanout-test.js`, `run-all-tests.sh` |
| `tests/k6/` | k6 부하·스트레스·스파이크 테스트 (k6 Cloud 실행 포함)와 실행 가이드 | `chat-stress-test-cloud.js`, `integrated-stress-test-cloud.js`, `common/`, `QUICK_START.md` |
| `k8s/` | Kubernetes(K3s) 배포 매니페스트: 네임스페이스, MySQL·Redis, 채팅 서버, HPA, PDB, Ingress, Secret 템플릿 ⚠️ AWS EC2 기반 배포용 — **현재 비활성화, GCP로 이전 예정** | `00-namespace.yaml`, `03-chat-server.yaml`, `04-hpa.yaml`, `ingress.yaml`, `secret-template.yaml`, `README.md` |
| `monitoring/` | Prometheus 메트릭 수집 설정과 Grafana 데이터소스·대시보드 연결 설정 | `prometheus.yml`, `grafana/datasource.yml`, `grafana/dashboard.yml` |
| `grafana/` | 부하 테스트 결과를 보는 Grafana 대시보드(InfluxDB 연동) | `dashboards/k6-massive-chat-dashboard.json`, `provisioning/influxdb.yml` |
| `mysql/` | MySQL Master-Slave 복제 계정 생성·설정·확인 스크립트 | `init/01-create-replication-user.sql`, `scripts/setup-replication.sh`, `scripts/check-replication.sh` |
| `nginx/` | 로컬에서 서버 여러 대(3대)를 띄워 시험할 때 쓰는 로드밸런서 설정 | `nginx-3servers.conf`, `nginx.conf` |
| `scripts/` | 무중단(Rolling Update) 배포 스크립트, K8s CI/CD 초기 설정, 부하 테스트용 사용자 생성 SQL | `deploy.sh`, `setup-k8s-cicd.sh`, `create-test-users.sql` |
| `.github/workflows/` | GitHub Actions CI/CD: 빌드 검사 → Docker 이미지 빌드·푸시(AWS ECR) → Kubernetes 배포 ⚠️ AWS 이미지 빌드·배포 단계는 **현재 비활성화, GCP로 이전 예정** (빌드 검사만 동작) | `cicd.yml` (`cicd.yml.backup`은 이전 버전 백업) |

---

## 문제-해결-성과 TOP10

### 1) 채팅방 목록 조회 N+1 문제
- **문제:** 채팅방 목록 조회 시 N+1 쿼리 31개 발생, P95 응답 6.3초
- **해결:** `@EntityGraph` + `LEFT JOIN FETCH`로 연관 엔티티를 일괄 로딩
- **성과:** 쿼리 31→1~3개(약 90%↓), P95 6.3s→0.4s(약 93%↓), 처리량 183%↑

### 2) 이메일 받은편지함 Full Table Scan
- **문제:** 10만+ 행 Full Scan으로 20건 조회, 응답 지연
- **해결:** `EXPLAIN` 기반 분석 후 복합 인덱스 `(recipient_address, is_deleted, received_at)` 설계
- **성과:** 응답 25ms→0.48ms(97%↓), 스캔 100,000+→2행, 처리량 2.7배↑

### 3) 채팅방 목록 unreadCount/참여자 수 계산 병목
- **문제:** 방 10개 기준 COUNT 쿼리 20개, 평균 200ms 이상
- **해결:** Redis 캐시(Cache-Aside) + `INCR/DECR/DEL` 즉시 갱신 + TTL(10~30분)
- **성과:** COUNT 쿼리 20개→0개, 응답 200ms→20ms(90%↓), 커넥션 풀 100%→40% 이하

### 4) WebSocket 메시지 지연/재연결 문제
- **문제:** 메시지 전송 지연 5–10초, 재연결 빈번
- **해결:** Nginx WebSocket 프록시 최적화 + 세션 관리 개선
- **성과:** 지연 0.1초 수준, 재연결 98.5%↓, 사용자 불만 35건→0건

### 5) 메시지 읽음 처리 동시성 충돌
- **문제:** 다중 디바이스 동시 읽음 처리 시 카운트 음수/불일치
- **해결:** 읽음 업데이트를 단일 트랜잭션으로 묶고 `REQUIRES_NEW`로 이벤트성 후처리 분리
- **성과:** 읽음 수 불일치 0건, 재처리/롤백 이슈 제거

### 6) 읽음 이벤트 폭주로 인한 DB 락 경합
- **문제:** 대량 읽음 이벤트가 동시에 유입되며 DB 락 경합 발생
- **해결:** 읽음 처리 로직 비동기/배치화로 분산
- **성과:** 락 대기 감소, 읽음 반영 지연 감소

### 7) 메시지 저장-알림 전송 정합성 문제
- **문제:** 메시지 저장 실패인데 알림이 먼저 발송되는 “유령 알림”
- **해결:** 메시지 저장 트랜잭션 성공 후 도메인 이벤트 발행, 알림은 비동기 처리
- **성과:** 유령 알림 0건, 메시지-알림 정합성 확보

### 8) WebSocket 멀티 인스턴스 메시지 누락
- **문제:** 서버 확장 시 다른 서버에 연결된 사용자에게 메시지 미전달
- **해결:** Redis Pub/Sub으로 브로드캐스트 중앙화(채널 `chat:pubsub`)
- **성과:** 노드 확장 시에도 모든 사용자에게 동일하게 실시간 전달

### 9) Docker 이미지/배포 시간 최적화
- **문제:** 이미지 1.2GB, 빌드 6분 30초, 배포 다운타임 130초
- **해결:** Docker Multi-Stage Build + GitHub Actions + Nginx WS 프록시
- **성과:** 1.2GB→250MB, 6분30초→1분, 다운타임 0초

### 10) 단일 서버 장애 및 확장 문제
- **문제:** 단일 EC2 장애 시 5~10분 다운타임, 수동 증설 15분
- **해결:** K3s 클러스터 + HPA + Rolling Update + Secret/ConfigMap 분리
- **성과:** 다운타임 0분, 장애 자동 복구 30초 이내, 동시접속 1,000명 k6 검증

