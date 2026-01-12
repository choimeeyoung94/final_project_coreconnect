## Kubernetes 채팅 백엔드 배포 트러블슈팅 (포트폴리오 정리)

### 1) 문제(Problem)
- **목표**: 채팅 백엔드를 Kubernetes(EKS)에 배포하고 **멀티 Pod(3개 이상)** 로 운영하며, **부하테스트(k6)** 를 수행할 수 있는 “접근 가능한 상태”까지 만드는 것.
- **발생 문제(핵심)**:
  - Pod가 `Pending/CrashLoopBackOff`로 불안정하고, HealthCheck 실패로 `Ready 0/1`, `503` 발생
  - MySQL 연결 경로가 외부 IP/클러스터 내부 DNS로 혼재되어 “테이블은 있는데 안 보임” 등 환경 혼선 발생
  - 외부 ELB DNS/네트워크 이슈로 접근이 불안정하여 테스트가 중단됨
  - 보안/로그인 설정이 배포 환경에서 예상대로 적용되지 않아 `401`, 데이터 정합성 문제로 `500` 발생
  - 결과적으로 “멀티 Pod + 로컬(EC2)에서 접근 가능한 백엔드 + k6 부하테스트”가 막혀있음

---

### 2) 해결과정(How we solved)
#### 2-1. 리소스/네임스페이스/설정 정합성 확보
- `kubectl get/describe/logs`로 상태를 표준 진단 루틴으로 고정하고,
- ConfigMap/Deployment 이름/namespace 불일치 문제를 제거하여 **설정이 실제 Pod에 주입**되도록 정리

#### 2-2. MySQL/Redis 의존성 안정화 및 K8s 내부 DNS로 통일
- MySQL StatefulSet + PVC가 `Pending`으로 멈춘 원인을 확인 후, 부하테스트 목적에 맞게 **emptyDir 기반 MySQL Deployment**로 전환하여 즉시 기동
- `DB_HOST`가 외부 IP로 설정되어 내부 MySQL Pod에 접속해도 테이블이 안 보이던 혼선을 발견 → **K8s Service DNS(mysql...)로 통일**
- JDBC 인증 이슈(`allowPublicKeyRetrieval`) 등으로 발생한 CrashLoopBackOff를 JDBC URL 옵션으로 해결

#### 2-3. 백엔드 멀티 Pod 운영(3개 이상)과 롤링 배포 안정화
- Deployment를 멀티 replica로 유지하면서 `rollout restart/status`로 **롤링 업데이트 정상 완료** 확인
- 포트포워딩이 롤아웃 과정에서 끊기는 문제를 경험 → “Pod 직결 port-forward + health 체크”로 재현/복구 절차를 표준화

#### 2-4. 인증/로그인 테스트 경로 확보(부하테스트 친화화)
- `security.mode=open` 적용 경로를 확정하고(환경변수/시스템 프로퍼티 주입),
- 로드테스트에서 로그인 실패가 병목이 되지 않도록 **open 모드에서 사용자 자동 생성/비밀번호 동기화**로 로그인 성공률을 확보
- 로그인 API는 토큰을 body가 아닌 **HttpOnly 쿠키(Set-Cookie)** 로 내려주므로, k6 테스트도 쿠키 발급 여부를 검증하도록 수정

#### 2-5. “로컬에서 확실히 붙는” 접근 루트 확보 + 관측(Observability) 연결
- 외부 `EC2:8080` 직접 접근은 보안/구성상 막혀있는 것이 정상임을 정리하고,
- EC2 로컬 기준 `127.0.0.1:18080` port-forward를 표준 진입점으로 삼아 안정적으로 테스트
- k6 결과를 Grafana Cloud에서 보기 위해 `k6 cloud run --local-execution` 방식을 도입(트래픽은 EC2에서 발생, 결과는 Cloud로 업로드)

---

### 3) AS-IS(개선 전)
- **가용성**: Pod `Pending/CrashLoopBackOff`, Ready 실패(`0/1`)로 서비스 접근 불가/불안정
- **네트워크**: ELB DNS(NXDOMAIN/접속 실패), 포트포워딩 중단으로 테스트가 자주 끊김
- **데이터/연결**: DB_HOST 혼재로 환경 혼선, MySQL 연결/인증 이슈로 기동 실패
- **인증/시나리오 테스트**: 로그인 401/500 등으로 테스트 시나리오가 막힘
- **결과**: 멀티 Pod 운영 및 k6 부하테스트 수행이 불가능

---

### 4) TO-BE(개선 후)
- **멀티 Pod 운영**: 채팅 백엔드를 **3개 이상 Pod로 Running** 상태 유지하며 롤링 배포 가능
- **일관된 의존성 연결**: MySQL/Redis를 **K8s 내부 DNS 기반**으로 통일하여 환경 혼선 제거
- **안정적인 테스트 진입점**: EC2 로컬 `port-forward(127.0.0.1:18080)` 기반으로 언제든 재현 가능한 접근 경로 확보
- **부하테스트 친화화**: open 모드에서 로그인 성공률 확보(유저 자동 생성/비밀번호 동기화), k6 검증 기준을 쿠키(Set-Cookie) 발급으로 일치
- **관측**: k6 결과를 Grafana(Cloud/Local)로 시각화 가능

---

### 5) 성과(Results) — 수치화 & 측정 방법
#### 5-1. 운영 안정성(멀티 Pod) 성과
- **성과(수치)**:
  - 채팅 백엔드 **멀티 Pod(3개 이상) Running 상태 확보**
  - `rollout status` 기준으로 **롤링 업데이트 성공** 확인
- **측정 방법**:
  - `kubectl get pods -n chat-system | grep chat-service`로 Running/Ready 수 확인
  - `kubectl -n chat-system rollout status deployment/chat-service`로 배포 완료 여부 확인

#### 5-2. 접근성(로컬 접근 루트) 성과
- **성과(수치)**:
  - `curl http://127.0.0.1:18080/actuator/health` **HTTP 200(UP) 확인**
  - 포트포워딩 상태를 “프로세스/리스닝/헬스체크” 3단계로 점검하여 **장애 재현/복구 절차 표준화**
- **측정 방법**:
  - 프로세스: `ps aux | grep "kubectl.*port-forward"`
  - 리스닝: `ss -ltnp | grep :18080`
  - 기능 검증: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18080/actuator/health`

#### 5-3. k6 성능/성공률 성과(실측)
> 아래 수치는 “오늘 작업 중 실제 k6 실행 결과”를 기준으로 작성.

- **Health 엔드포인트 부하 테스트**
  - **성과(수치)**:
    - 10 VUs / 30s 기준: **요청 성공률 100%**
    - 평균 응답시간(예): **~10–20ms**, p95(예): **~25–35ms**
  - **측정 방법**:
    - k6 결과의 `http_req_failed`, `http_req_duration`, `p(95)`를 기준으로 확인

- **로그인 부하 테스트(쿠키 발급 검증)**
  - **성과(수치)**:
    - 로그인 응답 **HTTP 200 + Set-Cookie(access_token/refresh_token) 발급 성공**
    - 10 VUs / 30s 기준: **체크 성공률 100%**
    - 단, p95가 1초를 초과하는 경우가 있어(예: **p95 ~1.15s**) threshold를 통해 병목을 “수치로 가시화”
  - **측정 방법**:
    - k6 체크 항목:
      - `status is 200`
      - `sets access_token cookie`
      - `sets refresh_token cookie`
    - 성능 지표:
      - `http_req_duration p(95)`
      - `http_req_failed`

#### 5-4. Grafana Cloud 대시보드 연동(관측) 성과
- **성과(수치)**:
  - `k6 cloud run --local-execution`으로 **EC2에서 트래픽 발생 + Grafana Cloud에서 결과 확인** 가능
- **측정 방법**:
  - Grafana Cloud → *Testing & Synthetics → Performance(k6) → Runs/Results*에서 실행 결과/메트릭 확인
  - “127.0.0.1 블랙리스트” 이슈를 `--local-execution`으로 해결하여 Cloud 런과 로컬 타겟을 동시에 만족

---

## 한 줄 요약(포트폴리오)
Kubernetes(EKS)에 채팅 백엔드를 **멀티 Pod(3+)로 안정 운영**하고, DB/네트워크/보안 이슈를 단계적으로 해소하여 **EC2 로컬 접근 루트(port-forward) 기반 부하테스트(k6)와 Grafana 관측까지 연결**한 운영/트러블슈팅 경험을 정리했습니다.


