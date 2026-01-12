## 3-Tier(MySQL Master–Slave) → Kubernetes 전환 포트폴리오 정리

> 목표: **10만 동시 채팅 부하를 측정/검증**하기 위해, 기존 3-Tier 환경에서 **MySQL Master–Slave(복제) 구조로 운영하던 백엔드**를 **Kubernetes(EKS)** 기반으로 전환하고, 배포/접근/부하테스트까지 가능한 상태로 만들기  
> 전략: 초기에는 **Pod 3개(최소 비용/리스크)** 로 시작 → 성능 병목을 확인하면서 점진적으로 스케일아웃(또는 HPA)로 확장

---

### 1) 문제(Problem)
- **최상위 목표**: “10만 동시 채팅(동시 접속/메시지)” 수준의 부하를 걸고, 병목을 수치로 확인해 개선 포인트를 도출하는 것
- **현실 제약**: 3-Tier를 그대로 확장하면 “서버 대수 증가 = 비용 선형 증가”가 발생하고, 운영 복잡도도 함께 증가
  - EC2 기반 Scale-out은 **트래픽 피크 기준으로 미리 서버를 확보**해야 하므로 유휴 비용이 커짐
  - DB(특히 Master)는 수평 확장이 어렵고, 커넥션/락/IO 병목이 전체 성능을 제한
- 기존 3-Tier 환경(EC2 기반)에서 **MySQL Master–Slave 복제**로 운영되던 구조를 Kubernetes로 옮기는 과정에서,
  - 애플리케이션/DB/캐시 의존성이 분산되어 있어 **환경 변수/네트워크 경로가 일관되지 않음**
  - K8s 배포 후 Pod가 `Pending/CrashLoopBackOff`, HealthCheck `503`, 로그인 `401/500`, DB 커넥션 오류가 발생하여 **서비스 가용성과 테스트 가능성이 떨어짐**
  - 특히 DB는 “기존 Master–Slave”와 “K8s 내부 MySQL”이 혼재되며 **어느 DB를 바라보는지 혼선**이 생김

---

### 2) AS-IS / TO-BE

#### AS-IS (기존 3-Tier)
- **구성**
  - Front/Backend/DB가 분리된 3-Tier
  - DB는 **MySQL Master–Slave 복제**로 운영(읽기/쓰기 분리 가능)
- **운영 방식**
  - 서버 단위(EC2) 스케일링, 배포는 인스턴스 단위로 진행
  - 장애 시 인스턴스/서비스 단위 대응
- **비용/리소스 관점(10만 동시 부하 측정 시 문제)**
  - 부하를 올릴수록 백엔드 인스턴스를 여러 대로 늘려야 하고, 비용이 대수에 비례해 증가
  - **비용 추정 방식(포트폴리오 명시용)**:
    - \(월 비용 \approx \sum(EC2\_타입별\_시간당요금 \times 24 \times 30 \times 대수) + (DB/RDS) + (LB) + (스토리지)\)
    - 3-Tier로 단순 확장 시 “백엔드 서버 N대 + 부하 발생기 + 모니터링”이 **피크 시간 기준으로 고정 비용화**되는 문제가 있음
  - 운영 측면에서도 “배포/확장/장애 복구”를 인스턴스 단위로 반복해야 하므로 작업량이 커짐
- **한계**
  - 배포/스케일/복구가 자동화되지 않으면 운영 부담 증가
  - 환경 의존성이 강해 재현/확장이 어려움

#### TO-BE (Kubernetes 전환)
- **구성**
  - Backend를 Kubernetes Deployment로 운영(멀티 Pod)
  - DB/Redis 등 의존성은 **K8s 내부 Service DNS**로 통일해 연결 일관성 확보
  - 접근은 외부 ELB가 불안정할 때를 대비해 **EC2 로컬 port-forward(127.0.0.1)** 기반 “재현 가능한 접근 루트” 확보
- **운영 방식**
  - 롤링 배포/레플리카 확장/장애 복구를 K8s 컨트롤 플레인으로 표준화
  - k6 부하테스트를 수행하고, Grafana(Cloud/Local)로 메트릭 가시화
- **왜 Kubernetes인가(비용/확장 관점의 의사결정)**
  - **점진 확장**: 처음부터 다수의 EC2 인스턴스를 고정으로 늘리는 대신, **Pod 3개로 시작**해 병목 확인 후 단계적으로 확장
  - **오토스케일링 가능성**: 향후 HPA/Cluster Autoscaler 도입 시 “필요한 순간에만” 리소스를 늘리는 방식으로 유휴 비용을 줄일 수 있음
  - **운영 자동화**: 롤링 배포/셀프힐링/스케일이 선언적으로 관리되어, 대규모 부하 실험을 반복하기 위한 운영 비용(시간/실수)을 감소

> NOTE: 본 작업에서는 비용 최적화의 1단계로 “고정 서버 증설” 대신 “K8s 기반 Pod 3개 → 점진 확장”을 선택했고, 이후 성능 병목 지점이 확인되면 HPA/리소스 튜닝/DB 확장 전략을 붙이는 방향으로 설계했다.

---

### 3) 해결과정(How we solved)

#### 3-1. “DB가 어디인가?” 문제부터 정리 (Master–Slave ↔ K8s MySQL 혼선)
- 증상: 테이블이 “있는 것처럼 보이는데” 접속하면 비어있거나, 로그인 401/500이 반복
- 원인: `DB_HOST`가 외부 IP(기존 3-Tier/Legacy DB)와 K8s 내부 MySQL Service가 섞여 있어,
  - 애플리케이션은 A DB에 쓰고
  - 운영자는 B DB를 확인하는 식의 **관측/운영 혼선**이 발생
- 해결:
  - ConfigMap/Deployment 환경변수를 점검하고 **DB_HOST를 단일 경로로 정리**
  - K8s 내부 운영 시에는 `mysql.chat-system.svc.cluster.local`(또는 `mysql`)로 고정

#### 3-2. MySQL 배포 이슈(Pending) 해결 → 즉시 기동 가능한 형태로 전환
- 증상: MySQL StatefulSet이 `PVC Pending`로 멈춰 `mysql-0`이 생성되지 않음
- 원인: 스토리지 프로비저닝/노드 상태(WaitForFirstConsumer, Node not-ready 등)로 EBS 볼륨 바인딩 지연
- 해결(부하테스트 목적 우선):
  - PersistentVolume 기반이 아닌 **emptyDir 기반 MySQL Deployment**로 전환하여 즉시 기동
  - (포트폴리오 포인트) “운영 영속성”이 아닌 “부하테스트/기능 검증” 목적에 맞는 합리적 트레이드오프 선택

#### 3-3. DB 연결/인증(JDBC) 안정화
- 증상: `Public Key Retrieval is not allowed` 및 JDBC 연결 실패로 CrashLoopBackOff
- 해결:
  - `SPRING_DATASOURCE_URL`에 `allowPublicKeyRetrieval=true` 등 필수 옵션을 반영하여 안정화

#### 3-4. 멀티 Pod 백엔드 배포 & 접근 경로 표준화
- Deployment 레플리카를 유지하며 `rollout restart/status`로 롤링 배포 확인
- 외부 접근(ELB DNS/NXDOMAIN, 보안그룹/포트 문제)이 불안정할 때,
  - EC2에서 **`kubectl port-forward`를 표준 접근 루트**로 확정
  - “프로세스/리스닝/헬스” 3단계로 포워딩 상태 점검 절차를 고정

#### 3-5. 로그인/부하테스트 파이프라인 구성
- 로그인은 HttpOnly 쿠키(Set-Cookie) 기반이므로, k6에서도 쿠키 발급을 체크하도록 테스트를 구성
- Grafana Cloud로 결과를 올릴 때 “127.0.0.1 블랙리스트” 이슈를 해결하기 위해
  - `k6 cloud run --local-execution` 방식 채택

---

### 4) 성과(Results) — 수치화 & 측정 방법

#### 4-1. K8s 전환 후 배포/운영 성과
- **성과(수치)**
  - Backend Pod **3개 이상 Running** 운영(트래픽 분산 기반 확보)
  - 롤링 배포 성공(`deployment/chat-service successfully rolled out`)
- **측정 방법**
  - `kubectl get pods -n chat-system | grep chat-service` 로 Running/Ready Pod 수 확인
  - `kubectl -n chat-system rollout status deployment/chat-service` 로 배포 성공 확인

#### 4-1a. 비용/리소스 관점 성과(“점진 확장”으로 비용 통제)
- **성과(수치화 가능한 형태)**
  - “피크 기준 서버 N대 고정”이 아니라, **초기 Pod 3개로 시작**해 부하 실험을 진행(최소 비용으로 검증 시작)
  - 확장 단위가 “인스턴스 단위”에서 “Pod/Replica 단위”로 바뀌어, 실험 반복 시 리소스 조절이 더 빠름
- **측정 방법(포트폴리오용)**
  - 리소스 변경 이력: `kubectl get deploy -n chat-system chat-service -o=jsonpath='{.spec.replicas}'`
  - (선택) 비용 추정은 아래 산식으로 산출해 비교:
    - 3-Tier: \(EC2\_대수 \times 월단가 + DB + LB + 기타\)
    - K8s: \(노드\_대수 \times 월단가 + (EBS 등) + LB + 기타\)  
    - 즉, “필요 시 확장/평소 축소”를 전제로 유휴 비용을 줄일 수 있는 구조로 전환

#### 4-2. 접근성/재현성(로컬 접근 루트) 성과
- **성과(수치)**
  - `127.0.0.1:18080/actuator/health` **HTTP 200(UP)** 확인 → 접근 루트 안정화
  - 포트포워딩을 “프로세스/리스닝/기능” 3단계로 점검해 장애 시 즉시 복구 가능
- **측정 방법**
  - 프로세스: `ps aux | grep "kubectl.*port-forward"`
  - 리스닝: `ss -ltnp | grep :18080`
  - 기능 검증: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18080/actuator/health`

#### 4-3. 부하테스트(로그인) 성과
- **성과(수치)**
  - k6 로그인 테스트에서 **HTTP 200 + Set-Cookie(access_token/refresh_token) 발급 성공**
  - 10 VUs / 30s 기준 **체크 성공률 100%** (로그인 성공/쿠키 발급 모두 통과)
  - p95 지연이 1초를 초과하는 구간(예: ~1.15s)을 발견하여, 성능 개선 대상 지점을 수치로 확보
- **측정 방법**
  - k6 결과의 `checks_succeeded`, `http_req_failed`, `http_req_duration p(95)` 확인
  - 검증 항목: “status=200”, “access_token/refresh_token 쿠키 존재” 체크

#### 4-4. Grafana Cloud 관측 성과
- **성과(수치)**
  - EC2 로컬에서 트래픽 발생 + Grafana Cloud에 결과 업로드(대시보드에서 실행 결과 확인)까지 파이프라인 완성
- **측정 방법**
  - `k6 cloud run --local-execution` 실행 후 Grafana Cloud → Performance(k6) → Runs/Results에서 실행 로그/메트릭 확인

---

## 한 줄 요약(포트폴리오)
기존 3-Tier의 MySQL Master–Slave 운영 경험을 바탕으로, Kubernetes 전환 과정에서 발생한 DB 경로 혼선/스토리지 Pending/DB 인증/외부 접근 불안정 문제를 단계적으로 해결해 **멀티 Pod 백엔드 운영 + 로컬 접근 표준화 + k6 부하테스트 + Grafana Cloud 관측**까지 연결했습니다.


