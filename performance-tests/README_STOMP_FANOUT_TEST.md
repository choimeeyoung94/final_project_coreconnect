## STOMP 팬아웃(브로드캐스트) 부하 테스트 가이드 (멀티 Pod / 브로커 없음)

### 왜 이 테스트가 필요한가
현재 `WebSocketConfig`는 `enableSimpleBroker("/topic")`를 사용합니다. 이 브로커는 **Pod(프로세스) 로컬**이라서,
Pod가 3개면 같은 채팅방(room)이라도 서로 다른 Pod에 붙은 유저끼리는 **메시지를 못 받는 구조적 한계**가 있습니다.

그래서 “몇 명까지 버티나?”를 보기 전에, **메시지 전달(팬아웃)이 제대로 되나**를 수치로 확인하는 게 1순위입니다.

### 전제
- 테스트는 SockJS(`/ws/chat`)가 아니라 **raw WebSocket STOMP**로 수행해야 합니다.
- 백엔드에는 k6용 raw 엔드포인트가 있어야 합니다.
  - `/ws/chat-ws` (권장, k6용)
  - `/ws/chat-raw` (기존)
- WebSocket 핸드셰이크 인증: `access_token` 쿠키 또는 쿼리 파라미터(`access_token` / `accessToken`)

### 테스트 스크립트
- `performance-tests/k6-stomp-fanout-test.js`

### 실행 예시 (Windows / cmd)
1) **BASE_URL / WS_BASE**를 현재 접근 가능한 주소로 지정 (Ingress/포트포워딩/노드포트 등)

```bash
k6 run ^
  -e BASE_URL=http://127.0.0.1:18080 ^
  -e WS_BASE=ws://127.0.0.1:18080 ^
  -e WS_PATH=/ws/chat-ws ^
  -e VUS=60 ^
  -e ROOM_COUNT=3 ^
  -e MESSAGES_PER_USER=1 ^
  -e WAIT_AFTER_SEND_SEC=6 ^
  performance-tests/k6-stomp-fanout-test.js
```

### 실행 예시 (EC2 Linux / bash, k6 Cloud 업로드)
아래 예시는 **EC2에서 로컬 실행 + Cloud 업로드**(`--local-execution`) 방식입니다.

```bash
export K6_CLOUD_TOKEN="YOUR_TOKEN_HERE"

# ⚠️ EC2에서 BASE_URL/WS_BASE에 localhost를 쓰면 EC2 자신을 바라보게 됩니다.
# Ingress/ALB DNS(또는 EC2에서 접근 가능한 주소)로 넣어주세요.
export BASE_URL="http://YOUR_ALB_OR_DOMAIN"
export WS_BASE="ws://YOUR_ALB_OR_DOMAIN"

k6 cloud run --local-execution \
  -e BASE_URL="$BASE_URL" \
  -e WS_BASE="$WS_BASE" \
  -e WS_PATH=/ws/chat-ws \
  -e LOGIN_EMAIL="test@coreconnect.io.kr" \
  -e LOGIN_PASSWORD="test123!" \
  -e VUS=60 \
  -e ROOM_COUNT=3 \
  -e MESSAGES_PER_USER=1 \
  -e WAIT_AFTER_SEND_SEC=6 \
  -e K6_TEST_NAME="fanout-3pod-no-broker" \
  performance-tests/k6-stomp-fanout-test.js
```

### 실행 예시 (옵션 A) 클러스터 내부에서 k6 Pod 실행 (ClusterIP로 분산 테스트)
port-forward는 특정 Pod로 고정되기 쉬워 “멀티 Pod 분산”이 잘 재현되지 않습니다.  
아래 방법은 **k6를 클러스터 내부 Pod(Job)** 로 실행해서 `chat-service`(ClusterIP)로 접속하므로, 실제로 연결이 Pod들로 분산됩니다.

1) k6 Cloud 토큰을 Secret으로 저장:

```bash
kubectl -n chat-system create secret generic k6-cloud-token \
  --from-literal=K6_CLOUD_TOKEN="YOUR_TOKEN_HERE"
```

2) Job 생성(스크립트는 ConfigMap으로 마운트):

```bash
cat > /tmp/k6-stomp-fanout-test.js <<'EOF'
# (여기에 repo의 performance-tests/k6-stomp-fanout-test.js 전체 내용을 붙여넣으세요)
EOF

kubectl -n chat-system create configmap k6-fanout-script \
  --from-file=k6-stomp-fanout-test.js=/tmp/k6-stomp-fanout-test.js \
  --dry-run=client -o yaml | kubectl apply -f -

cat <<'EOF' | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: k6-fanout
  namespace: chat-system
spec:
  backoffLimit: 0
  ttlSecondsAfterFinished: 600
  template:
    spec:
      enableServiceLinks: true
      restartPolicy: Never
      containers:
      - name: k6
        image: grafana/k6:latest
        env:
        - name: K6_CLOUD_TOKEN
          valueFrom:
            secretKeyRef:
              name: k6-cloud-token
              key: K6_CLOUD_TOKEN
        - name: WS_PATH
          value: "/ws/chat-raw"
        - name: LOGIN_EMAIL
          value: "test@coreconnect.io.kr"
        - name: LOGIN_PASSWORD
          value: "test123!"
        - name: VUS
          value: "60"
        - name: ROOM_COUNT
          value: "3"
        - name: MESSAGES_PER_USER
          value: "1"
        - name: WAIT_AFTER_SEND_SEC
          value: "6"
        - name: K6_TEST_NAME
          value: "fanout-incluster-no-broker"
        # NOTE: 일부 환경에서 container env가 k6 __ENV에 기대대로 안 잡히는 경우가 있어
        #       k6의 -e 옵션으로 BASE_URL/WS_BASE를 강제로 주입합니다(가장 확실).
        command:
          - k6
          - cloud
          - run
          - --local-execution
          - -e
          - BASE_URL=http://chat-service
          - -e
          - WS_BASE=ws://chat-service
          - -e
          - WS_PATH=/ws/chat-raw
          - /scripts/k6-stomp-fanout-test.js
        volumeMounts:
        - name: script
          mountPath: /scripts
      volumes:
      - name: script
        configMap:
          name: k6-fanout-script
EOF
```

3) 로그 확인:

```bash
kubectl -n chat-system logs -f job/k6-fanout
```

> NOTE: 위 예시는 “형태”만 제공합니다. 실제로는 ConfigMap의 스크립트 내용을
> `performance-tests/k6-stomp-fanout-test.js` 전체로 채워 넣어야 합니다.

### 결과 해석(중요)
- `stomp_messages_received_from_others`가 **의미 있게 올라가야** “팬아웃이 되는 상태”입니다.
  - 단, 이 값은 **채팅 메시지 + UNREAD_COUNT_UPDATE 같은 시스템 프레임**이 섞일 수 있어 참고용입니다.
  - 더 정확한 팬아웃 판단은 `chat_messages_received_from_others`(채팅 메시지 프레임만 집계)로 보세요.
- 공유 브로커 없이 Pod가 3개라면, 같은 room에 사람이 충분히 많을 때
  - “전체 수신량(타인 메시지 수신)”이 **대략 1/3 수준**으로 떨어지는 패턴이 보통 관측됩니다.
  - 이는 “성능”이 아니라 “아키텍처(브로커) 한계”입니다.

### 다음 단계
- 팬아웃이 1/Pod수로 떨어지는 게 확인되면,
  - Redis Pub/Sub 또는 RabbitMQ STOMP relay 등 **공유 브로커를 붙인 뒤** 동일 스크립트로 재측정해서 한계를 확장합니다.


