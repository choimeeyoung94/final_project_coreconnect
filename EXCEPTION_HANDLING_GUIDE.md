# 🚀 CoreConnect 예외 처리 가이드

## 📋 목차
1. [Checked vs Unchecked Exception](#checked-vs-unchecked-exception)
2. [CI/CD에서의 예외 처리](#cicd에서의-예외-처리)
3. [애플리케이션 예외 처리](#애플리케이션-예외-처리)
4. [스타트업 수준 베스트 프랙티스](#스타트업-수준-베스트-프랙티스)

---

## 🔍 Checked vs Unchecked Exception

### Checked Exception (복구 가능한 예외)
**언제 사용?**
- 외부 시스템 연동 (DB, API, 파일 시스템)
- 복구 가능한 상황
- 재시도 로직이 필요한 경우

**예시:**
```java
// ❌ 나쁜 예: Checked Exception을 그냥 던지기
public void uploadFile(MultipartFile file) throws IOException {
    s3Client.putObject(file);  // IOException 발생 가능
}

// ✅ 좋은 예: Checked Exception을 잡아서 비즈니스 예외로 변환 + 재시도
public void uploadFile(MultipartFile file) {
    int maxRetries = 3;
    int attempt = 0;

    while (attempt < maxRetries) {
        try {
            s3Client.putObject(file);
            log.info("파일 업로드 성공: {}", file.getOriginalFilename());
            return;

        } catch (IOException e) {
            attempt++;
            log.warn("파일 업로드 실패 ({}회 시도): {}", attempt, e.getMessage());

            if (attempt >= maxRetries) {
                throw new ExternalServiceException(
                    "파일 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.",
                    "AWS_S3",
                    e
                );
            }

            // 지수 백오프 (exponential backoff)
            try {
                Thread.sleep((long) Math.pow(2, attempt) * 1000);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
            }
        }
    }
}
```

### Unchecked Exception (프로그래밍 오류)
**언제 사용?**
- 비즈니스 규칙 위반
- 잘못된 입력값
- 데이터 없음 (404)
- 권한 없음 (403)

**예시:**
```java
// ✅ Unchecked Exception 사용 - GlobalExceptionHandler가 처리
public User getUser(Long userId) {
    return userRepository.findById(userId)
        .orElseThrow(() -> new ResourceNotFoundException("사용자", userId));
}

public void approveDocument(Long docId, Long userId) {
    Document doc = documentRepository.findById(docId)
        .orElseThrow(() -> new ResourceNotFoundException("문서", docId));

    if (doc.getStatus() != DocumentStatus.PENDING) {
        throw new InvalidStateException(
            "대기 중인 문서만 승인할 수 있습니다. 현재 상태: " + doc.getStatus()
        );
    }

    if (!doc.canApprove(userId)) {
        throw new BusinessException("이 문서를 승인할 권한이 없습니다.");
    }

    doc.approve(userId);
    documentRepository.save(doc);
}
```

---

## 🔧 CI/CD에서의 예외 처리

### 1. 빌드 실패 처리
```yaml
- name: Build with Gradle
  working-directory: ./backend
  run: |
    chmod +x ./gradlew
    ./gradlew clean build -x test
  continue-on-error: false  # ⚠️ 빌드 실패 시 파이프라인 중단
```

**핵심 포인트:**
- `continue-on-error: false` → 빌드 실패 시 즉시 중단
- 빌드 성공해야만 다음 단계 진행

### 2. 테스트 실패 처리
```yaml
- name: Run Backend Tests
  working-directory: ./backend
  run: ./gradlew test
  continue-on-error: false  # ⚠️ 테스트 실패 시 파이프라인 중단

- name: Publish Test Results
  if: always()  # 테스트 실패해도 결과는 업로드
  uses: actions/upload-artifact@v4
  with:
    name: test-results
    path: backend/build/test-results/
```

**핵심 포인트:**
- 테스트 실패 시 배포하지 않음
- `if: always()` → 실패해도 결과는 저장

### 3. 배포 실패 시 롤백
```bash
# 🔖 현재 이미지 백업
docker tag app:latest app:backup

# 🚀 새 버전 배포
if ! docker compose up --build -d; then
  echo "❌ 배포 실패! 롤백 시작..."
  docker tag app:backup app:latest
  docker compose up -d
  exit 1
fi

# 🏥 헬스체크
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -f http://localhost/api/health; then
    echo "✅ 배포 성공!"
    exit 0
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  sleep 2
done

# 헬스체크 실패 → 롤백
echo "❌ 헬스체크 실패! 롤백..."
docker compose down
docker tag app:backup app:latest
docker compose up -d
exit 1
```

**핵심 포인트:**
- 배포 전 이미지 백업
- 배포 실패 시 자동 롤백
- 헬스체크로 실제 동작 확인

### 4. 실패 알림 (Slack/Discord)
```yaml
- name: Notify deployment failure
  if: failure()
  run: |
    curl -X POST -H 'Content-type: application/json' \
      --data '{"text":"❌ 배포 실패! Commit: ${{ github.sha }}"}' \
      ${{ secrets.SLACK_WEBHOOK_URL }}
```

**설정 방법:**
1. Slack Webhook URL 생성: https://api.slack.com/messaging/webhooks
2. GitHub Secrets에 `SLACK_WEBHOOK_URL` 추가
3. 주석 제거하고 사용

---

## 🏥 애플리케이션 예외 처리

### 1. 헬스체크 엔드포인트
```java
// GET /api/health
@GetMapping
public ResponseEntity<ResponseDTO<Map<String, Object>>> health() {
    Map<String, Object> healthInfo = new HashMap<>();
    healthInfo.put("status", "UP");
    healthInfo.put("timestamp", LocalDateTime.now());
    return ResponseEntity.ok(ResponseDTO.success(healthInfo));
}

// GET /api/health/detailed (DB 연결 확인)
@GetMapping("/detailed")
public ResponseEntity<ResponseDTO<Map<String, Object>>> detailedHealth() {
    boolean dbStatus = checkDatabaseConnection();
    // ...
}
```

**CI/CD에서 사용:**
```bash
# 배포 후 헬스체크
curl -f http://localhost/api/health || exit 1
```

### 2. Custom Exception 사용 예시

#### ResourceNotFoundException (404)
```java
User user = userRepository.findById(userId)
    .orElseThrow(() -> new ResourceNotFoundException("사용자", userId));
```

#### DuplicateResourceException (409)
```java
if (userRepository.existsByEmail(email)) {
    throw new DuplicateResourceException("사용자", "이메일", email);
}
```

#### InvalidStateException (400)
```java
if (order.getStatus() != OrderStatus.PENDING) {
    throw new InvalidStateException(
        "결제 대기 중인 주문만 취소할 수 있습니다."
    );
}
```

#### ExternalServiceException (502)
```java
try {
    emailService.send(email);
} catch (Exception e) {
    throw new ExternalServiceException("이메일 전송 실패", "SENDGRID", e);
}
```

### 3. GlobalExceptionHandler
모든 예외는 자동으로 처리됩니다:
- `BusinessException` → 비즈니스 로직 오류
- `ResourceNotFoundException` → 404
- `DuplicateResourceException` → 409
- `InvalidStateException` → 400
- `ExternalServiceException` → 502
- `Exception` → 500 (예상치 못한 오류)

---

## 🎯 스타트업 수준 베스트 프랙티스

### 1. CI/CD 필수 단계
```
✅ 빌드 → ✅ 테스트 → ✅ 배포 → ✅ 헬스체크 → ✅ 알림
```

**실패 시:**
- 빌드 실패 → 파이프라인 중단
- 테스트 실패 → 배포 안 함
- 배포 실패 → 롤백 + 알림
- 헬스체크 실패 → 롤백 + 알림

### 2. 예외 처리 원칙

#### ❌ 하지 말아야 할 것
```java
// 1. 빈 catch 블록
try {
    riskyOperation();
} catch (Exception e) {
    // 무시 - 절대 금지!
}

// 2. 예외를 먹어버리기
try {
    riskyOperation();
} catch (Exception e) {
    log.error("Error");  // 로그만 찍고 끝
}

// 3. 너무 포괄적인 예외
public void doSomething() throws Exception {  // 너무 포괄적
    // ...
}
```

#### ✅ 올바른 방법
```java
// 1. 구체적인 예외 처리
try {
    s3Client.upload(file);
} catch (IOException e) {
    log.error("S3 업로드 실패: {}", file.getName(), e);
    throw new ExternalServiceException("파일 업로드 실패", "AWS_S3", e);
}

// 2. 재시도 로직
public void uploadWithRetry(File file) {
    int maxRetries = 3;
    for (int i = 0; i < maxRetries; i++) {
        try {
            s3Client.upload(file);
            return;
        } catch (IOException e) {
            if (i == maxRetries - 1) {
                throw new ExternalServiceException("업로드 실패", "S3", e);
            }
            sleep(1000 * (i + 1));  // 지수 백오프
        }
    }
}

// 3. 의미 있는 에러 메시지
throw new ResourceNotFoundException(
    String.format("사용자를 찾을 수 없습니다. ID: %d, 요청자: %s", userId, requesterId)
);
```

### 3. 로깅 레벨

| 레벨 | 용도 | 예시 |
|------|------|------|
| **ERROR** | 즉시 조치 필요 | DB 연결 실패, 결제 실패 |
| **WARN** | 주의 필요 | 비즈니스 규칙 위반, 리소스 없음 |
| **INFO** | 중요 이벤트 | 사용자 로그인, 주문 완료 |
| **DEBUG** | 디버깅 정보 | 메서드 진입, 변수 값 |

```java
log.error("결제 실패 - 주문: {}, 금액: {}", orderId, amount, exception);
log.warn("재고 부족 - 상품: {}, 요청: {}, 재고: {}", productId, qty, stock);
log.info("주문 완료 - 주문번호: {}, 사용자: {}", orderId, userId);
log.debug("상품 조회 - ID: {}", productId);
```

### 4. 모니터링 체크리스트

#### CI/CD
- [ ] 빌드 실패 시 알림 받음
- [ ] 테스트 실패 시 배포 안 됨
- [ ] 배포 실패 시 자동 롤백
- [ ] 헬스체크 엔드포인트 동작
- [ ] Slack/Discord 알림 설정

#### 애플리케이션
- [ ] GlobalExceptionHandler 동작
- [ ] 모든 예외에 로깅 추가
- [ ] 외부 서비스 재시도 로직
- [ ] 헬스체크 API 응답
- [ ] 에러 응답 통일 (ResponseDTO)

---

## 📚 참고 자료

### CI/CD 헬스체크
- 엔드포인트: `GET /api/health`
- 상세 헬스체크: `GET /api/health/detailed`
- Readiness: `GET /api/health/ready`
- Liveness: `GET /api/health/live`

### Exception 클래스 위치
- `BusinessException.java` - 모든 비즈니스 예외의 부모
- `ResourceNotFoundException.java` - 404
- `DuplicateResourceException.java` - 409
- `InvalidStateException.java` - 400
- `UnauthorizedException.java` - 401
- `ExternalServiceException.java` - 502

### GlobalExceptionHandler
- 위치: `backend/src/main/java/com/goodee/coreconnect/common/exception/GlobalExceptionHandler.java`
- 모든 예외를 일관된 형식으로 처리
- 로깅 및 에러 응답 통일

---

## 🚀 다음 단계 (선택사항)

### 1. Sentry 연동 (에러 추적)
```gradle
implementation 'io.sentry:sentry-spring-boot-starter:6.x.x'
```

### 2. Prometheus + Grafana (메트릭)
- 에러 발생률 모니터링
- 응답 시간 추적
- 헬스체크 대시보드

### 3. ELK Stack (로그 수집)
- Elasticsearch + Logstash + Kibana
- 중앙화된 로그 관리

---

**작성일:** 2025-11-28
**버전:** 1.0
**작성자:** CoreConnect Team
