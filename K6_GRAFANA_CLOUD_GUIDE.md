## 목적

EC2에서 k6 테스트를 실행하되, **결과(메트릭)는 Grafana Cloud 대시보드에서 확인**할 수 있도록 구성합니다.

핵심은 **`k6 cloud run --local-execution`** 입니다.
- 요청(트래픽)은 **EC2 로컬에서 발생**
- 결과(메트릭)는 **Grafana Cloud로 업로드**

---

## 사전 조건

- EC2에서 `k6` 설치 완료
- EC2에서 애플리케이션이 접근 가능해야 함  
  - 예: `http://127.0.0.1:18080/actuator/health` 가 200/UP
  - 보통 `kubectl port-forward` 로 `127.0.0.1:18080`을 열어둔 상태
- Grafana Cloud 계정 보유

---

## 1) (EC2) 애플리케이션 로컬 접속 경로 준비 (port-forward)

예시는 `chat-service` 서비스(80)를 로컬 18080으로 포워딩합니다.

```bash
pkill -f "port-forward" || true
nohup kubectl port-forward -n chat-system svc/chat-service 18080:80 > /tmp/pf18080.log 2>&1 &
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:18080/actuator/health
```

- 결과가 `200`이면 OK
- 필요 시 로그 확인: `tail -n 50 /tmp/pf18080.log`

---

## 2) (Grafana Cloud) k6 Project / Token 준비

Grafana Cloud UI에서:

- **Testing & Synthetics → Performance (k6)** 로 이동
- **Project 생성** 후 `Project ID` 확인
- **API Token 생성** (k6 Cloud Token)

> 토큰은 외부에 노출하면 안 됩니다.

---

## 3) (EC2) Grafana Cloud 환경변수 설정

아래 2개를 환경변수로 설정합니다.

```bash
export K6_CLOUD_TOKEN="여기에_토큰"
export K6_CLOUD_PROJECT_ID="여기에_PROJECT_ID"
```

---

## 4) (EC2) k6를 Cloud로 업로드하되, 로컬 실행으로 돌리기 (EOF)

중요 포인트:
- `BASE_URL`은 EC2 로컬(예: `http://127.0.0.1:18080`)을 사용
- `k6 cloud run`에 `--local-execution` 옵션을 붙임

```bash
BASE_URL="http://127.0.0.1:18080" VUS=10 DURATION="30s" \
k6 cloud run --local-execution - <<'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:18080';

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || '30s',
  tags: { test: 'login', env: 'ec2' },
};

export default function () {
  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: 'test@coreconnect.io.kr', password: 'test123!' }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(res, {
    'status is 200': (r) => r.status === 200,
    'sets access_token cookie': (r) => r.cookies?.access_token?.length > 0,
    'sets refresh_token cookie': (r) => r.cookies?.refresh_token?.length > 0,
  });

  sleep(1);
}
EOF
```

---

## 5) (Grafana Cloud) 결과 확인

Grafana Cloud UI에서:
- **Testing & Synthetics → Performance (k6) → Runs/Results** 에서 실행 결과 확인
- Run 상세 화면에서 메트릭/요약/그래프 확인

---

## 자주 발생하는 에러 & 해결

### A) `IP (127.0.0.1) is in a blacklisted range (127.0.0.0/8)`

- 원인: `k6 cloud run`을 **원격 실행**으로 돌리면, Grafana Cloud 쪽에서 `127.0.0.1`에 접근하려 해서 차단됨
- 해결: 반드시 **`--local-execution`** 사용

### B) 로컬 Grafana(EC2:3000) 접속이 안 됨

- 보안그룹에서 3000 포트가 막혔을 수 있음
- 권장: SSH 터널로 로컬 접근
  - `ssh -i "<pem>" -L 3000:127.0.0.1:3000 ubuntu@<EC2_PUBLIC_IP>`
  - 브라우저: `http://localhost:3000`


