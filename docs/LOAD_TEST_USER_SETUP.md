# 부하 테스트 사용자 생성 가이드

## 📋 개요

부하 테스트를 위한 가상 사용자 10,000명을 MySQL에 생성하고, k6 테스트에서 활용하는 방법을 설명합니다.

---

## 🎯 필요한 사용자 수

### **시나리오별 요구사항**

| 시나리오 | 필요 인원 | 비고 |
|---------|----------|------|
| **시나리오 1: 일반 채팅** | 1,000명 | Baseline 측정 |
| **시나리오 2: 스트레스** | 5,000명 | 점진적 증가 |
| **시나리오 3: 스파이크** | 5,000명 | 급격한 증가 |
| **시나리오 4: 지속성** | 2,000명 | 4시간 유지 |
| **시나리오 5: 대규모 그룹** | 1,500명 | 500명 단체방 |
| **시나리오 6: 알림 폭주** | 10,000명 | 전체 공지 |

**권장: 10,000명 생성** (모든 시나리오 대응)

---

## 🚀 사용자 생성 방법

### **방법 1: MySQL Workbench 사용**

1. **MySQL Workbench 실행**

2. **데이터베이스 연결**
   - Host: `your-host`
   - Port: `3306`
   - Username: `admin`
   - Password: `finalcoreconnect`
   - Database: `db_coreconnect`

3. **SQL 스크립트 실행**
   ```sql
   -- scripts/create-test-users.sql 파일 열기
   -- 또는 아래 명령어 실행
   
   USE db_coreconnect;
   
   -- 10,000명 생성 (약 30-60초 소요)
   CALL CreateLoadTestUsers(10000);
   ```

4. **생성 확인**
   ```sql
   SELECT COUNT(*) 
   FROM users 
   WHERE user_email LIKE 'testuser%@loadtest.com';
   
   -- 결과: 10000
   ```

---

### **방법 2: 명령줄(CLI) 사용**

#### **Windows (CMD)**
```cmd
cd C:\dev\final_project_coreconnect

mysql -h your-host -u admin -p db_coreconnect < scripts\create-test-users.sql
```

#### **Linux/Mac (Terminal)**
```bash
cd /path/to/final_project_coreconnect

mysql -h your-host -u admin -p db_coreconnect < scripts/create-test-users.sql
```

#### **Kubernetes Pod 내부에서**
```bash
# MySQL Pod에 접속
kubectl exec -it mysql-pod-name -n chat-system -- bash

# MySQL 로그인
mysql -u root -p db_coreconnect

# SQL 실행
source /path/to/create-test-users.sql
```

---

### **방법 3: Port-Forward 활용 (로컬에서)**

```bash
# 1. Port-Forward 설정 (백그라운드)
kubectl port-forward -n chat-system svc/mysql 3306:3306 &

# 2. 로컬에서 MySQL 접속
mysql -h 127.0.0.1 -u admin -p db_coreconnect < scripts/create-test-users.sql

# 3. Port-Forward 종료
fg  # Ctrl+C로 종료
```

---

## 📊 생성된 사용자 정보

### **기본 정보**

```yaml
총 사용자 수: 10,000명

이메일 형식:
  - testuser00001@loadtest.com
  - testuser00002@loadtest.com
  - ...
  - testuser10000@loadtest.com

비밀번호:
  - 모든 사용자 동일: "password"
  - BCrypt 암호화: $2a$10$dXJ3SW6G7P50lGmMkkmwe.20cyhwhwNSqIfPkAFMJqsWL/tGHqMOa

사용자명:
  - 테스트유저00001
  - 테스트유저00002
  - ...
  - 테스트유저10000

사번:
  - EMP00001
  - EMP00002
  - ...
  - EMP10000

권한: USER
상태: ACTIVE
직급: STAFF
부서: NULL (미지정)
```

---

### **데이터 확인 쿼리**

```sql
-- 1. 처음 10명 확인
SELECT 
    user_id,
    user_name,
    user_email,
    user_employee_number,
    user_status
FROM users 
WHERE user_email LIKE 'testuser%@loadtest.com'
ORDER BY user_id ASC
LIMIT 10;

-- 2. 마지막 10명 확인
SELECT 
    user_id,
    user_name,
    user_email,
    user_employee_number,
    user_status
FROM users 
WHERE user_email LIKE 'testuser%@loadtest.com'
ORDER BY user_id DESC
LIMIT 10;

-- 3. 통계 정보
SELECT 
    '테스트 사용자' AS 구분,
    COUNT(*) AS 총개수,
    MIN(user_id) AS 최소ID,
    MAX(user_id) AS 최대ID,
    MIN(user_email) AS 첫이메일,
    MAX(user_email) AS 마지막이메일
FROM users 
WHERE user_email LIKE 'testuser%@loadtest.com';
```

---

## 🧪 k6 테스트에서 사용하기

### **방법 1: 코드에서 직접 생성**

```javascript
// tests/k6/scenario1-baseline-test.js

function getTestUser(userId) {
    const userNumber = String(userId).padStart(5, '0');
    return {
        email: `testuser${userNumber}@loadtest.com`,
        password: 'password',
        name: `테스트유저${userNumber}`
    };
}

export default function() {
    // VU (Virtual User) 번호 기반 사용자 선택
    const userId = (__VU % 10000) + 1;  // 1-10000 범위
    const user = getTestUser(userId);
    
    // 로그인
    const loginRes = http.post(`${BASE_URL}/api/auth/login`, 
        JSON.stringify({
            email: user.email,
            password: user.password
        })
    );
    
    // ... 나머지 테스트 로직
}
```

---

### **방법 2: CSV 파일 사용**

#### **1단계: CSV 파일 생성**

```sql
-- MySQL에서 CSV 추출
SELECT 
    user_id,
    user_email,
    'password' AS password,
    user_name
FROM users 
WHERE user_email LIKE 'testuser%@loadtest.com'
ORDER BY user_id ASC
INTO OUTFILE '/tmp/test-users.csv'
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"'
LINES TERMINATED BY '\n';
```

#### **2단계: k6에서 CSV 로드**

```javascript
import papaparse from 'https://jslib.k6.io/papaparse/5.1.1/index.js';
import { SharedArray } from 'k6/data';

// CSV 파일에서 사용자 로드
const users = new SharedArray('users', function() {
    const csvData = open('./test-users.csv');
    return papaparse.parse(csvData, { header: true }).data;
});

export default function() {
    // 랜덤 사용자 선택
    const user = users[Math.floor(Math.random() * users.length)];
    
    // 로그인
    const loginRes = http.post(`${BASE_URL}/api/auth/login`, 
        JSON.stringify({
            email: user.email,
            password: user.password
        })
    );
}
```

---

### **방법 3: JSON 파일 사용**

#### **1단계: JSON 파일 생성**

```sql
-- MySQL에서 JSON 추출
SELECT JSON_ARRAYAGG(
    JSON_OBJECT(
        'userId', user_id,
        'email', user_email,
        'password', 'password',
        'name', user_name
    )
) AS test_users
FROM users 
WHERE user_email LIKE 'testuser%@loadtest.com'
ORDER BY user_id ASC;

-- 결과를 test-users.json 파일로 저장
```

#### **2단계: k6에서 JSON 로드**

```javascript
import { SharedArray } from 'k6/data';

// JSON 파일에서 사용자 로드
const users = new SharedArray('users', function() {
    return JSON.parse(open('./test-users.json'));
});

export default function() {
    const user = users[__VU % users.length];
    
    // 로그인 및 테스트 진행
}
```

---

## 🧹 테스트 완료 후 정리

### **사용자 삭제 방법**

```sql
-- 1. 삭제 전 백업 (선택적)
CREATE TABLE users_backup AS 
SELECT * FROM users 
WHERE user_email LIKE 'testuser%@loadtest.com';

-- 2. 테스트 사용자 삭제
DELETE FROM users 
WHERE user_email LIKE 'testuser%@loadtest.com';

-- 3. 삭제 확인
SELECT COUNT(*) 
FROM users 
WHERE user_email LIKE 'testuser%@loadtest.com';

-- 결과: 0
```

### **프로시저 사용**

```sql
-- 삭제 프로시저 생성
DELIMITER $$

CREATE PROCEDURE DeleteLoadTestUsers()
BEGIN
    DECLARE deleted_count INT;
    
    -- 삭제 전 개수 확인
    SELECT COUNT(*) INTO deleted_count 
    FROM users 
    WHERE user_email LIKE 'testuser%@loadtest.com';
    
    -- 삭제 실행
    DELETE FROM users 
    WHERE user_email LIKE 'testuser%@loadtest.com';
    
    -- 결과 출력
    SELECT CONCAT('✅ 테스트 사용자 삭제 완료: ', deleted_count, '명') AS Result;
END$$

DELIMITER ;

-- 프로시저 실행
CALL DeleteLoadTestUsers();
```

---

## 📌 시나리오별 사용자 할당

### **시나리오 1: 일반 채팅 (1,000명)**

```javascript
// k6 스크립트
export let options = {
    vus: 1000,
    duration: '10m',
};

export default function() {
    const userId = (__VU % 1000) + 1;  // 1-1000
    const user = getTestUser(userId);
    // ...
}
```

---

### **시나리오 2: 스트레스 테스트 (1,000-5,000명)**

```javascript
export let options = {
    stages: [
        { duration: '5m', target: 1000 },
        { duration: '5m', target: 2000 },
        { duration: '5m', target: 3000 },
        { duration: '5m', target: 5000 },
    ],
};

export default function() {
    const userId = (__VU % 5000) + 1;  // 1-5000
    const user = getTestUser(userId);
    // ...
}
```

---

### **시나리오 3: 스파이크 테스트 (500 → 5,000명)**

```javascript
export let options = {
    stages: [
        { duration: '2m', target: 500 },
        { duration: '1m', target: 5000 },  // 급증
        { duration: '2m', target: 5000 },
        { duration: '1m', target: 500 },
    ],
};

export default function() {
    const userId = (__VU % 5000) + 1;  // 1-5000
    const user = getTestUser(userId);
    // ...
}
```

---

### **시나리오 6: 알림 폭주 (10,000명)**

```javascript
export let options = {
    vus: 10000,
    duration: '5m',
};

export default function() {
    const userId = (__VU % 10000) + 1;  // 1-10000
    const user = getTestUser(userId);
    // ...
}
```

---

## ⚠️ 주의사항

### **보안**
- ⚠️ **프로덕션 DB에서 절대 실행하지 마세요!**
- ⚠️ 테스트 환경에서만 사용하세요!
- ⚠️ 실제 사용자 이메일과 겹치지 않도록 `@loadtest.com` 도메인 사용

### **성능**
- 10,000명 생성 시간: 약 30-60초
- 생성 중 DB 부하 발생 (CPU, Memory 사용 증가)
- 1,000명씩 배치 처리로 안정성 확보

### **정리**
- ⚠️ **테스트 완료 후 반드시 삭제하세요!**
- 불필요한 데이터로 DB 용량 낭비 방지
- 실제 사용자 데이터와 혼동 방지

---

## 🔍 트러블슈팅

### **문제 1: 프로시저 생성 실패**

**증상:**
```
ERROR 1419 (HY000): You do not have the SUPER privilege
```

**해결:**
```sql
-- 글로벌 변수 설정
SET GLOBAL log_bin_trust_function_creators = 1;

-- 또는 권한 부여
GRANT SUPER ON *.* TO 'admin'@'%';
FLUSH PRIVILEGES;
```

---

### **문제 2: 중복 이메일 에러**

**증상:**
```
ERROR 1062 (23000): Duplicate entry 'testuser00001@loadtest.com' for key 'uk_user_email'
```

**해결:**
```sql
-- 기존 테스트 사용자 삭제 후 재생성
DELETE FROM users WHERE user_email LIKE 'testuser%@loadtest.com';

-- 다시 생성
CALL CreateLoadTestUsers(10000);
```

---

### **문제 3: 디스크 공간 부족**

**증상:**
```
ERROR 1114 (HY000): The table 'users' is full
```

**해결:**
```sql
-- 불필요한 데이터 삭제
DELETE FROM users WHERE user_status = 'INACTIVE';

-- 또는 생성 개수 줄이기
CALL CreateLoadTestUsers(5000);  -- 10,000 → 5,000
```

---

## 📊 예상 DB 용량

```yaml
사용자 1명당 데이터 크기: 약 500 bytes

10,000명 예상 용량:
  - users 테이블: 약 5MB
  - 인덱스: 약 2MB
  - 총 용량: 약 7MB

참고:
  - 일반적인 MySQL에서 무리 없이 처리 가능
  - SSD 기준 생성 시간: 30-60초
  - HDD 기준 생성 시간: 1-2분
```

---

## ✅ 체크리스트

### **생성 전**
- [ ] 테스트 환경인지 확인 (프로덕션 ❌)
- [ ] DB 백업 완료
- [ ] 충분한 디스크 공간 확인 (최소 100MB)
- [ ] DB 연결 정보 확인

### **생성 중**
- [ ] SQL 스크립트 실행
- [ ] 진행 상황 모니터링
- [ ] 에러 발생 시 즉시 중단

### **생성 후**
- [ ] 생성 개수 확인 (10,000명)
- [ ] 샘플 사용자 로그인 테스트
- [ ] k6 스크립트 연동 테스트

### **테스트 완료 후**
- [ ] 테스트 사용자 삭제
- [ ] DB 용량 확인
- [ ] 백업 파일 정리

---

## 🚀 빠른 시작

```bash
# 1. MySQL 접속
mysql -h your-host -u admin -p db_coreconnect

# 2. 사용자 생성
CALL CreateLoadTestUsers(10000);

# 3. 확인
SELECT COUNT(*) FROM users WHERE user_email LIKE 'testuser%@loadtest.com';

# 4. k6 테스트 실행
k6 run tests/k6/scenario1-baseline-test.js

# 5. 테스트 완료 후 삭제
CALL DeleteLoadTestUsers();
```

---

**이제 10,000명의 가상 사용자로 체계적인 부하 테스트를 수행할 수 있습니다!** 📊✨
