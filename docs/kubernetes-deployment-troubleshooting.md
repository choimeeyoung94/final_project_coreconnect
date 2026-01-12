# 📝 Kubernetes 백엔드 배포 트러블슈팅 가이드

## 📌 개요

Spring Boot 백엔드를 Kubernetes에 배포하는 과정에서 발생한 **"Running이지만 Ready 상태가 안 되는"** 문제를 분석하고 해결한 경험을 문서화했습니다. 이 가이드는 유사한 문제를 겪는 팀원들이 빠르게 문제를 진단하고 해결할 수 있도록 작성되었습니다.

---

## 🐛 문제 상황

### 증상

```bash
$ kubectl get pods -n chat-system
NAME                          READY   STATUS    RESTARTS   AGE
chat-server-xxxx-xxxx         0/1     Running   4          5m
```

- Pod는 `Running` 상태이지만 `Ready` 상태가 `0/1`
- 서비스 트래픽을 받을 수 없음
- Pod가 주기적으로 재시작됨

### 비즈니스 영향

- 백엔드 API 서비스 불가
- 프론트엔드에서 502/503 에러 발생
- 부하 테스트 진행 불가

---

## 📚 Kubernetes Pod Lifecycle 이해

```
Pod 생성 → initContainer 실행 → Container 시작 (Running)
           ↓
    readinessProbe 체크 시작
           ↓
    통과 → Ready (1/1) → 트래픽 수신 가능 ✅
    실패 → Not Ready (0/1) → 재시작 또는 대기 ❌
```

**중요: Running ≠ Ready!**

- **Running**: 컨테이너 프로세스가 실행 중
- **Ready**: 애플리케이션이 완전히 시작되어 요청을 처리할 준비 완료

---

## 🔍 근본 원인 4가지

### 문제 1: MySQL Service Discovery 실패

**증상:**

```
com.mysql.cj.jdbc.exceptions.CommunicationsException: Communications link failure
Caused by: java.net.ConnectException: Connection refused
```

**원인:**

- 환경변수에 잘못된 Service 이름 사용: `mysql-service`
- 실제 Service 이름: `mysql`
- Kubernetes DNS 해석 실패

**해결:**

```yaml
env:
- name: SPRING_DATASOURCE_URL
  value: "jdbc:mysql://mysql:3306/db_coreconnect"  # Service 이름 정확히 사용
- name: MYSQL_HOST
  value: "mysql"  # 또는 mysql.chat-system.svc.cluster.local
```

**검증 방법:**

```bash
# 1. Service 이름 확인
kubectl get svc -n chat-system | grep mysql

# 2. DNS 해석 테스트
kubectl exec -it <pod> -n chat-system -- nc -zv mysql 3306

# 3. 연결 테스트
kubectl exec -it <pod> -n chat-system -- mysql -h mysql -u root -p
```

**학습 포인트:**

- Kubernetes DNS 형식: `<service-name>.<namespace>.svc.cluster.local`
- 같은 namespace 내에서는 단순히 `<service-name>` 사용 가능
- Service Discovery는 Kubernetes의 핵심 기능

---

### 문제 2: Database Schema 누락

**증상:**

```
org.hibernate.tool.schema.spi.SchemaManagementException: 
Schema-validation: missing table [account_log]
```

**원인:**

- Hibernate가 `validate` 모드로 실행 (기본값)
- 빈 데이터베이스에 테이블이 존재하지 않음
- Schema 검증 실패로 애플리케이션 시작 중단

**해결:**

```yaml
env:
- name: SPRING_JPA_HIBERNATE_DDL_AUTO
  value: "update"  # 테이블 자동 생성/업데이트
```

**Hibernate DDL-Auto 옵션:**

| 옵션 | 동작 | 사용 환경 |
|------|------|-----------|
| `validate` | 스키마 검증만 (변경 없음) | 프로덕션 |
| `update` | 스키마 없으면 생성, 있으면 업데이트 | 개발/테스트 |
| `create` | 시작 시 스키마 재생성 | 로컬 개발 |
| `create-drop` | 시작 시 생성, 종료 시 삭제 | 테스트 |
| `none` | 아무것도 안 함 | 프로덕션 (Flyway/Liquibase 사용 시) |

**프로덕션 권장사항:**

```yaml
# 프로덕션 환경
env:
- name: SPRING_JPA_HIBERNATE_DDL_AUTO
  value: "validate"  # 검증만 수행

# 별도로 Flyway/Liquibase 사용
- name: SPRING_FLYWAY_ENABLED
  value: "true"
```

---

### 문제 3: Mail Service Bean 생성 실패

**증상:**

```
jakarta.mail.AuthenticationFailedException: 
failed to connect, no password specified?

Caused by: org.springframework.beans.factory.BeanCreationException: 
Error creating bean with name 'mailSenderImpl'
```

**원인:**

- Spring Boot가 `JavaMailSender` 빈 자동 생성 시도
- Mail 인증 정보 미제공
- 의존성 주입 실패로 애플리케이션 컨텍스트 로딩 실패

**해결 방법 1: 환경변수로 Mail 설정 제공**

```yaml
env:
- name: SPRING_MAIL_HOST
  value: "smtp.gmail.com"
- name: SPRING_MAIL_PORT
  value: "587"
- name: SPRING_MAIL_USERNAME
  value: "your-email@gmail.com"
- name: SPRING_MAIL_PASSWORD
  value: "your-app-password"
- name: SPRING_MAIL_PROPERTIES_MAIL_SMTP_AUTH
  value: "true"
- name: SPRING_MAIL_PROPERTIES_MAIL_SMTP_STARTTLS_ENABLE
  value: "true"
```

**해결 방법 2: Kubernetes Secret 사용 (권장)**

```yaml
# Secret 생성
apiVersion: v1
kind: Secret
metadata:
  name: mail-secret
  namespace: chat-system
type: Opaque
stringData:
  username: "yoochun8128@gmail.com"
  password: "bgmydykazrjtohv"  # Gmail 앱 비밀번호

---
# Deployment에서 사용
env:
- name: SPRING_MAIL_USERNAME
  valueFrom:
    secretKeyRef:
      name: mail-secret
      key: username
- name: SPRING_MAIL_PASSWORD
  valueFrom:
    secretKeyRef:
      name: mail-secret
      key: password
```

**Gmail 앱 비밀번호 생성:**

1. Google 계정 → 보안
2. 2단계 인증 활성화
3. 앱 비밀번호 생성
4. 생성된 16자리 비밀번호 사용

---

### 문제 4: Readiness Probe Timeout

**증상:**

```
Warning  Unhealthy  2m (x18 over 8m)  kubelet  
Readiness probe failed: Get "http://10.42.0.52:8080/actuator/health": 
context deadline exceeded (Client.Timeout exceeded while awaiting headers)
```

**원인:**

- `/actuator/health` 엔드포인트 응답 시간 > 1초 (기본 timeout)
- Spring Actuator가 모든 의존성 health check (Mail, DB, Redis)
- Mail health check가 특히 느림 (SMTP 연결 시도)

**해결:**

```yaml
readinessProbe:
  httpGet:
    path: /actuator/health
    port: 8080
  initialDelaySeconds: 150  # 애플리케이션 시작 시간 확보
  periodSeconds: 20         # 20초마다 체크
  timeoutSeconds: 30        # 응답 대기 시간 증가 ⭐
  failureThreshold: 10      # 10번 실패까지 허용
```

**Health Check 최적화:**

```yaml
env:
# Mail health check 비활성화 (느린 원인)
- name: MANAGEMENT_HEALTH_MAIL_ENABLED
  value: "false"

# 디버깅용 상세 정보 표시
- name: MANAGEMENT_ENDPOINT_HEALTH_SHOW_DETAILS
  value: "always"
```

**Readiness vs Liveness Probe 비교:**

| 항목 | Readiness Probe | Liveness Probe |
|------|-----------------|----------------|
| 목적 | 트래픽 수신 준비 여부 | 애플리케이션 살아있는지 |
| 실패 시 | 트래픽 차단 (재시작 X) | Pod 재시작 |
| 체크 시작 | initialDelaySeconds 후 | initialDelaySeconds 후 |
| 사용 예 | 의존성 준비 대기 | Deadlock 감지 |

---

## ✅ 최종 해결 방법

### 완전한 Deployment YAML

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chat-server
  namespace: chat-system
spec:
  replicas: 2
  selector:
    matchLabels:
      app: chat-server
  template:
    metadata:
      labels:
        app: chat-server
    spec:
      # 1. initContainer로 MySQL 대기
      initContainers:
      - name: wait-for-mysql
        image: busybox:1.28
        command:
          - 'sh'
          - '-c'
          - 'until nc -z mysql 3306; do echo waiting for mysql; sleep 5; done; sleep 10'
      
      containers:
      - name: chat-server
        image: chat-server:latest
        imagePullPolicy: Never
        ports:
        - containerPort: 8080
        
        env:
        # Profile
        - name: SPRING_PROFILES_ACTIVE
          value: "dev"
        
        # 2. Database 설정 (올바른 Service 이름)
        - name: SPRING_DATASOURCE_URL
          value: "jdbc:mysql://mysql:3306/db_coreconnect?useSSL=false&serverTimezone=Asia/Seoul"
        - name: SPRING_DATASOURCE_USERNAME
          value: "root"
        - name: SPRING_DATASOURCE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mysql-secret
              key: root-password
        - name: SPRING_DATASOURCE_DRIVER_CLASS_NAME
          value: "com.mysql.cj.jdbc.Driver"
        
        # 3. Hibernate DDL Auto (스키마 자동 생성)
        - name: SPRING_JPA_HIBERNATE_DDL_AUTO
          value: "update"
        - name: SPRING_JPA_SHOW_SQL
          value: "false"
        
        # Redis
        - name: SPRING_DATA_REDIS_HOST
          value: "redis-pubsub"
        - name: SPRING_DATA_REDIS_PORT
          value: "6379"
        
        # 4. Mail 설정 (Bean 생성을 위해 필수)
        - name: SPRING_MAIL_HOST
          value: "smtp.gmail.com"
        - name: SPRING_MAIL_PORT
          value: "587"
        - name: SPRING_MAIL_USERNAME
          valueFrom:
            secretKeyRef:
              name: mail-secret
              key: username
        - name: SPRING_MAIL_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mail-secret
              key: password
        - name: SPRING_MAIL_PROPERTIES_MAIL_SMTP_AUTH
          value: "true"
        - name: SPRING_MAIL_PROPERTIES_MAIL_SMTP_STARTTLS_ENABLE
          value: "true"
        
        # Actuator 최적화
        - name: MANAGEMENT_HEALTH_MAIL_ENABLED
          value: "false"
        - name: MANAGEMENT_ENDPOINT_HEALTH_SHOW_DETAILS
          value: "always"
        
        # Resource 제한
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        
        # Liveness Probe
        livenessProbe:
          httpGet:
            path: /actuator/health
            port: 8080
          initialDelaySeconds: 180
          periodSeconds: 30
          timeoutSeconds: 30
          failureThreshold: 10
        
        # 5. Readiness Probe (충분한 timeout)
        readinessProbe:
          httpGet:
            path: /actuator/health
            port: 8080
          initialDelaySeconds: 150
          periodSeconds: 20
          timeoutSeconds: 30
          failureThreshold: 10
```

---

## 🧪 테스트 및 검증

### 1. 배포 확인

```bash
# Pod 상태 확인
kubectl get pods -n chat-system
# 예상 결과: chat-server-xxxx  1/1  Running  0  3m

# 상세 정보 확인
kubectl describe pod <pod-name> -n chat-system

# 로그 확인
kubectl logs -n chat-system -l app=chat-server | grep "Started"
# 예상 결과: Started BackendApplication in 136.9 seconds
```

### 2. Health Check 테스트

```bash
# Port Forward
kubectl port-forward -n chat-system svc/chat-service 8080:80

# Health Check (새 터미널)
curl http://localhost:8080/actuator/health

# 예상 응답
{
  "status": "UP",
  "components": {
    "db": {"status": "UP"},
    "diskSpace": {"status": "UP"},
    "ping": {"status": "UP"}
  }
}
```

### 3. 연결 테스트

```bash
# MySQL 연결 확인
kubectl exec -it <pod-name> -n chat-system -- sh -c "nc -zv mysql 3306"

# Redis 연결 확인
kubectl exec -it <pod-name> -n chat-system -- sh -c "nc -zv redis-pubsub 6379"

# 환경변수 확인
kubectl exec -it <pod-name> -n chat-system -- env | grep SPRING
```

---

## 📊 트러블슈팅 플로우차트

```
Pod 상태 확인: 0/1 Ready
    ↓
kubectl describe pod <pod-name>
    ↓
┌──────────────────────┬──────────────────────┬────────────────────┬──────────────────┐
│                      │                      │                    │                  │
Connection Refused     Schema Validation      Bean Creation       Readiness Probe
(MySQL 연결 실패)       (테이블 없음)          (Mail Bean 실패)     Timeout
│                      │                      │                    │
Service 이름 확인       DDL auto=update       Mail 설정 추가       timeout 증가
kubectl get svc        Flyway 고려           Secret 생성          health 최적화
DNS 테스트             테이블 초기화          앱 비밀번호 생성      Mail check 비활성화
```

---

## 📈 성능 개선 결과

| 지표 | 이전 | 이후 | 개선율 |
|------|------|------|--------|
| Pod 시작 성공률 | 0% (계속 실패) | 100% | +100% |
| Ready 전환 시간 | N/A | ~2.5분 | - |
| 재시작 횟수 | 5+ | 0 | -100% |
| Health Check 응답 | Timeout | <1초 | - |
| 배포 소요 시간 | N/A | 3분 | - |

---

## 🎓 학습 포인트

### Kubernetes 전문성

1. **Pod Lifecycle 완전 이해**
   - Pending → Running → Ready 전환 과정
   - initContainer의 역할과 활용
   - Container, Readiness, Liveness 구분

2. **Service Discovery**
   - Kubernetes DNS: `<service-name>.<namespace>.svc.cluster.local`
   - 단축형: `<service-name>` (같은 namespace)
   - CoreDNS를 통한 이름 해석

3. **Health Check 메커니즘**
   - Readiness Probe: 트래픽 수신 여부 결정
   - Liveness Probe: Pod 재시작 여부 결정
   - 적절한 timeout과 threshold 설정의 중요성

4. **Secrets 관리**
   - 민감 정보의 안전한 저장
   - 환경변수로 주입
   - RBAC 권한 관리

### Spring Boot 전문성

1. **외부 설정 (Externalized Configuration)**
   - 환경변수 우선순위 이해
   - Spring Boot property binding
   - Profile별 설정 관리

2. **Auto-Configuration**
   - JavaMailSender 자동 구성 메커니즘
   - Bean lifecycle과 의존성 주입
   - Conditional annotation 활용

3. **Actuator 활용**
   - Health indicator 커스터마이징
   - 프로덕션 준비 기능
   - Metrics와 모니터링

4. **Hibernate 설정**
   - DDL Auto 옵션 이해
   - Entity 매핑과 스키마 관리
   - 프로덕션 마이그레이션 전략

### DevOps 역량

1. **체계적인 트러블슈팅**
   - 로그 분석 (kubectl logs)
   - 이벤트 확인 (kubectl describe)
   - 근본 원인 분석 (5 Whys)

2. **Infrastructure as Code**
   - YAML로 선언적 배포
   - GitOps 워크플로우
   - 재현 가능한 환경 구성

3. **관찰 가능성 (Observability)**
   - 로그 수집 및 분석
   - Metrics 모니터링
   - Health check 설계

---

## 🔐 보안 고려사항

### 현재 구현

✅ **구현됨:**
- Kubernetes Secret 사용
- 환경변수로 민감 정보 주입
- Gmail 앱 비밀번호 사용 (2FA)
- STARTTLS로 암호화된 Mail 전송

### 개선 권장사항

🔒 **프로덕션 강화:**

```yaml
# 1. Sealed Secrets 사용
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: mail-secret
spec:
  encryptedData:
    username: AgB...  # 암호화된 값
    password: AgC...

# 2. External Secrets Operator (AWS Secrets Manager)
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: mail-secret
spec:
  secretStoreRef:
    name: aws-secrets-manager
  target:
    name: mail-secret
  data:
  - secretKey: username
    remoteRef:
      key: prod/mail/username
  - secretKey: password
    remoteRef:
      key: prod/mail/password
```

🔒 **추가 보안 계층:**
- Network Policy로 Pod 간 통신 제한
- RBAC로 권한 최소화
- Pod Security Standards 적용
- Image 취약점 스캔 (Trivy)

---

## 🚀 배포 체크리스트

배포 전 반드시 확인:

- [ ] MySQL Service가 Ready 상태인가?
  ```bash
  kubectl get pods -n chat-system | grep mysql
  ```

- [ ] Redis Service가 Ready 상태인가?
  ```bash
  kubectl get pods -n chat-system | grep redis
  ```

- [ ] Kubernetes Secret이 생성되었는가?
  ```bash
  kubectl get secrets -n chat-system
  ```

- [ ] 환경변수가 올바르게 설정되었는가?
  ```bash
  kubectl describe pod <pod> -n chat-system | grep -A 20 "Environment:"
  ```

- [ ] initContainer가 성공했는가?
  ```bash
  kubectl logs <pod> -n chat-system -c wait-for-mysql
  ```

- [ ] Readiness Probe 설정이 적절한가?
  ```bash
  kubectl describe pod <pod> -n chat-system | grep -A 5 "Readiness:"
  ```

- [ ] AWS 보안 그룹에서 필요한 포트가 열려있는가?
  - NodePort 범위: 30000-32767
  - 또는 LoadBalancer 사용

- [ ] 리소스 제한이 적절한가?
  ```bash
  kubectl top pods -n chat-system
  ```

---

## 📚 참고 자료

### Kubernetes 공식 문서
- [Pod Lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)
- [Configure Liveness, Readiness and Startup Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Init Containers](https://kubernetes.io/docs/concepts/workloads/pods/init-containers/)
- [Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)

### Spring Boot 공식 문서
- [Spring Boot Actuator](https://docs.spring.io/spring-boot/docs/current/reference/html/actuator.html)
- [Externalized Configuration](https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features.external-config)
- [Working with SQL Databases](https://docs.spring.io/spring-boot/docs/current/reference/html/data.html#data.sql)
- [Sending Email](https://docs.spring.io/spring-boot/docs/current/reference/html/io.html#io.email)

### 추가 학습 자료
- [12 Factor App](https://12factor.net/) - 클라우드 네이티브 앱 설계 원칙
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
- [Spring Boot on Kubernetes](https://spring.io/guides/gs/spring-boot-kubernetes/)

---

## 🤝 기여자

- **작성자**: @choimeeyoung5
- **배포 환경**: AWS EC2 (t3.2xlarge) + k3s
- **프로젝트**: CoreConnect - 실시간 채팅 시스템

---

## 📝 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|-----------|
| 2026-01-11 | 1.0.0 | 초기 트러블슈팅 가이드 작성 |

---

## 💬 피드백

이 문서에 대한 피드백이나 추가 질문이 있으시면 이슈를 생성해주세요!

**이 가이드를 통해 팀원들이 동일한 문제를 빠르게 해결하고, 프로덕션 배포 시 안정성을 높일 수 있기를 바랍니다.** 🚀
