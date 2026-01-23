# Hibernate 쿼리 로그 수집 가이드

> **면접 증거 자료로 활용할 Hibernate 로그를 수집하는 방법**

---

## 1. application.yml 설정

### 1-1. 로그 레벨 설정

`backend/src/main/resources/application.yml` 또는 `application-local.yml`에 추가:

```yaml
logging:
  level:
    # SQL 쿼리 출력 (Hibernate가 생성한 SQL)
    org.hibernate.SQL: DEBUG
    
    # 바인딩 파라미터 출력 (?에 들어가는 값)
    org.hibernate.type.descriptor.sql.BasicBinder: TRACE
    
    # Hibernate 통계 정보 (쿼리 수, 실행 시간 등)
    org.hibernate.stat: DEBUG
    
    # 트랜잭션 로그 (선택사항)
    org.springframework.orm.jpa: DEBUG
    org.springframework.transaction: DEBUG

spring:
  jpa:
    properties:
      hibernate:
        # SQL 포맷팅 (가독성 향상)
        format_sql: true
        
        # JPQL 주석 추가 (어떤 JPQL이 실행됐는지 표시)
        use_sql_comments: true
        
        # System.out 대신 Logger 사용 (권장)
        show_sql: false
        
        # Hibernate Statistics 활성화 ⭐ 중요!
        generate_statistics: true
```

### 1-2. Logback 설정 (선택사항, 더 상세한 로그)

`backend/src/main/resources/logback-spring.xml` 생성:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <!-- Console Appender -->
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n</pattern>
        </encoder>
    </appender>
    
    <!-- File Appender (로그를 파일로 저장) -->
    <appender name="FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>logs/hibernate.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
            <fileNamePattern>logs/hibernate.%d{yyyy-MM-dd}.log</fileNamePattern>
            <maxHistory>7</maxHistory>
        </rollingPolicy>
        <encoder>
            <pattern>%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n</pattern>
        </encoder>
    </appender>
    
    <!-- Hibernate SQL -->
    <logger name="org.hibernate.SQL" level="DEBUG" additivity="false">
        <appender-ref ref="CONSOLE" />
        <appender-ref ref="FILE" />
    </logger>
    
    <!-- Hibernate Type (바인딩 파라미터) -->
    <logger name="org.hibernate.type.descriptor.sql.BasicBinder" level="TRACE" additivity="false">
        <appender-ref ref="CONSOLE" />
        <appender-ref ref="FILE" />
    </logger>
    
    <!-- Hibernate Statistics -->
    <logger name="org.hibernate.stat" level="DEBUG" additivity="false">
        <appender-ref ref="CONSOLE" />
        <appender-ref ref="FILE" />
    </logger>
    
    <root level="INFO">
        <appender-ref ref="CONSOLE" />
    </root>
</configuration>
```

---

## 2. 로그 수집 방법

### 2-1. 로컬 환경에서 실행

#### **1단계: 서버 실행**

```bash
cd backend
./gradlew bootRun --args='--spring.profiles.active=local'
```

#### **2단계: API 호출**

```bash
# 채팅방 목록 조회 (N+1 문제 재현)
curl -X GET "http://localhost:8080/api/chatrooms" \
  -H "Cookie: access_token=YOUR_JWT_TOKEN"
```

#### **3단계: 콘솔 로그 확인**

터미널에 다음과 같은 로그가 출력됩니다:

```sql
15:23:45.123 [http-nio-8080-exec-1] DEBUG org.hibernate.SQL - 
    /* SELECT cr FROM ChatRoom cr JOIN cr.chatRoomMembers crm WHERE crm.user.id = :userId */
    select
        cr1_0.chat_room_id,
        cr1_0.chat_room_name,
        cr1_0.created_at 
    from
        chat_room cr1_0 
    join
        chat_room_member crm1_0 
            on cr1_0.chat_room_id=crm1_0.chat_room_id 
    where
        crm1_0.user_id=?
        
15:23:45.124 [http-nio-8080-exec-1] TRACE org.hibernate.type.descriptor.sql.BasicBinder - 
    binding parameter [1] as [INTEGER] - [1]

15:23:45.135 [http-nio-8080-exec-1] DEBUG org.hibernate.SQL - 
    select
        c1_0.chat_message_id,
        c1_0.message_content,
        c1_0.sent_at,
        c1_0.sender_id 
    from
        chat_message c1_0 
    where
        c1_0.chat_room_id=? 
    order by
        c1_0.sent_at desc limit ?
        
15:23:45.136 [http-nio-8080-exec-1] TRACE org.hibernate.type.descriptor.sql.BasicBinder - 
    binding parameter [1] as [INTEGER] - [1]
    binding parameter [2] as [INTEGER] - [1]

... (이하 29개 쿼리 생략)
```

#### **4단계: Hibernate Statistics 확인**

```
15:23:46.500 [http-nio-8080-exec-1] DEBUG org.hibernate.stat.internal.StatisticsImpl - 
    Session Metrics {
        31 JDBC statements sent
        15.2 ms average execution time
        620 ms total database time
    }
```

---

## 3. 로그 캡처 및 정리

### 3-1. 파일로 저장

```bash
# 터미널 로그를 파일로 저장
./gradlew bootRun > logs/before-optimization.log 2>&1

# API 호출
curl -X GET "http://localhost:8080/api/chatrooms" -H "Cookie: access_token=..."

# Ctrl+C로 종료 후 로그 확인
cat logs/before-optimization.log | grep "org.hibernate.SQL"
```

### 3-2. 스크린샷 촬영

**Before (N+1 문제 발생 시):**
1. 터미널 전체 화면 캡처
2. 31개 쿼리가 보이도록 스크롤
3. `docs/images/hibernate-log-before.png` 저장

**After (Fetch Join 적용 후):**
1. 코드 수정 (`LEFT JOIN FETCH` 추가)
2. 서버 재시작
3. 동일 API 호출
4. 1-3개 쿼리만 실행되는 것 캡처
5. `docs/images/hibernate-log-after.png` 저장

---

## 4. Before/After 비교표 작성

### 4-1. 쿼리 수 카운팅

```bash
# Before: 쿼리 수 카운팅
cat logs/before-optimization.log | grep "org.hibernate.SQL" | wc -l
# 출력: 31

# After: 쿼리 수 카운팅
cat logs/after-optimization.log | grep "org.hibernate.SQL" | wc -l
# 출력: 1
```

### 4-2. 실행 시간 측정

```bash
# Statistics 로그에서 실행 시간 추출
cat logs/before-optimization.log | grep "Session Metrics" -A 5
```

**출력 예시:**
```
Session Metrics {
    31 JDBC statements sent
    10-20 ms average execution time per statement
    620 ms total database time
    5,300 ms total processing time
}
```

---

## 5. GitHub README 작성 예시

### 5-1. Before/After 비교 섹션

````markdown
## N+1 문제 해결 과정

### 문제 발견: Hibernate 로그 분석

#### Before (N+1 문제 발생):

```sql
-- 1번째 쿼리: 채팅방 목록 조회
Hibernate: 
    select cr1_0.chat_room_id, cr1_0.chat_room_name, cr1_0.created_at 
    from chat_room cr1_0 
    where cr1_0.user_id = ?

-- 2번째 쿼리: 첫 번째 채팅방의 최신 메시지
Hibernate: 
    select c1_0.chat_message_id, c1_0.message_content 
    from chat_message c1_0 
    where c1_0.chat_room_id = ?

-- 3번째 쿼리: 첫 번째 메시지의 발신자 (Lazy Loading)
Hibernate: 
    select u1_0.user_id, u1_0.name 
    from user u1_0 
    where u1_0.user_id = ?

... (총 31개 쿼리)
```

**Hibernate Statistics:**
```
Session Metrics {
    31 JDBC statements sent
    620 ms total database time
}
```

![Hibernate Log Before](docs/images/hibernate-log-before.png)

#### After (Fetch Join 적용):

```sql
-- ✅ 단 1개의 쿼리로 모든 데이터 조회!
Hibernate: 
    select 
        c1_0.chat_message_id,
        c1_0.message_content,
        s1_0.user_id,           -- ← sender 정보 (LEFT JOIN)
        s1_0.name,
        cr1_0.chat_room_id,     -- ← chatRoom 정보 (LEFT JOIN)
        cr1_0.chat_room_name
    from chat_message c1_0 
    left join user s1_0 on s1_0.user_id=c1_0.sender_id 
    left join chat_room cr1_0 on cr1_0.chat_room_id=c1_0.chat_room_id 
    where c1_0.chat_room_id in (?,?,?,?,?,?,?,?,?,?)
```

**Hibernate Statistics:**
```
Session Metrics {
    1 JDBC statement sent          (90.3% 감소)
    5 ms total database time       (97.6% 단축)
}
```

![Hibernate Log After](docs/images/hibernate-log-after.png)

### 성능 개선 결과

| 메트릭 | Before | After | 개선율 |
|--------|--------|-------|--------|
| 쿼리 수 | 31개 | 1개 | **90.3%** ↓ |
| DB 시간 | 620ms | 5ms | **97.6%** ↓ |
| 응답시간 (P95) | 6,300ms | 400ms | **93.6%** ↓ |
````

---

## 6. 면접에서 활용하는 방법

### 6-1. 면접관에게 보여줄 자료

**준비물:**
1. ✅ GitHub README (Before/After 로그)
2. ✅ Hibernate Statistics 스크린샷
3. ✅ k6 Grafana Cloud 대시보드 링크

**면접 시나리오:**
```
면접관: "N+1 문제를 어떻게 발견했나요?"

지원자: "네, Hibernate 로그를 보여드리겠습니다.
         (노트북 화면 공유 또는 GitHub README 링크 공유)
         
         이 스크린샷을 보시면,
         채팅방 10개를 조회할 때 31개의 쿼리가 실행됩니다.
         
         Hibernate Statistics에서
         620ms의 DB 시간이 소요됐습니다.
         
         Fetch Join 적용 후,
         쿼리 1개, DB 시간 5ms로 개선됐습니다."

면접관: "증거 자료가 확실하네요. 인상적입니다." ✅
```

---

## 7. 트러블슈팅

### 문제 1: 로그가 출력되지 않음

**원인:**
- `show_sql: true`로 설정했지만 로거 레벨이 INFO

**해결:**
```yaml
logging:
  level:
    org.hibernate.SQL: DEBUG  # ← 반드시 DEBUG
```

### 문제 2: 바인딩 파라미터가 ?로 표시됨

**원인:**
- `BasicBinder` 로거가 비활성화

**해결:**
```yaml
logging:
  level:
    org.hibernate.type.descriptor.sql.BasicBinder: TRACE  # ← TRACE 레벨
```

### 문제 3: Statistics가 출력되지 않음

**원인:**
- `generate_statistics: false`

**해결:**
```yaml
spring:
  jpa:
    properties:
      hibernate:
        generate_statistics: true  # ← 반드시 true
```

---

## 8. 로그 정리 스크립트

### 8-1. 쿼리 수만 추출

```bash
#!/bin/bash
# count-queries.sh

LOG_FILE="logs/hibernate.log"

echo "=== Hibernate 쿼리 분석 ==="
echo ""
echo "총 쿼리 수:"
grep "org.hibernate.SQL" "$LOG_FILE" | wc -l
echo ""
echo "SELECT 쿼리:"
grep "select" "$LOG_FILE" -i | wc -l
echo ""
echo "INSERT 쿼리:"
grep "insert" "$LOG_FILE" -i | wc -l
echo ""
echo "UPDATE 쿼리:"
grep "update" "$LOG_FILE" -i | wc -l
```

### 8-2. Statistics만 추출

```bash
#!/bin/bash
# extract-statistics.sh

LOG_FILE="logs/hibernate.log"

echo "=== Hibernate Statistics ==="
grep "Session Metrics" "$LOG_FILE" -A 5
```

---

## 9. 최종 체크리스트

면접 전 반드시 확인:

- [ ] application.yml에 로그 설정 추가
- [ ] 로컬에서 API 호출 테스트
- [ ] Before 로그 스크린샷 촬영
- [ ] Fetch Join 적용
- [ ] After 로그 스크린샷 촬영
- [ ] GitHub README에 Before/After 추가
- [ ] Hibernate Statistics 수치 암기
- [ ] 면접관에게 보여줄 링크 준비

---

**작성자**: 최미영  
**작성일**: 2026-01-21  
**GitHub**: https://github.com/choimeeyoung94/final_project_coreconnect
