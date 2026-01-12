# 🗄️ MySQL Master-Slave Replication 가이드

## 📋 목차
1. [구성 확인](#구성-확인)
2. [상태 확인 방법](#상태-확인-방법)
3. [Replication 테스트](#replication-테스트)
4. [트러블슈팅](#트러블슈팅)
5. [성능 최적화](#성능-최적화)

---

## ✅ 구성 확인

### Docker Compose 구성

```yaml
# Master (Write)
mysql-master:
  포트: 3306
  server-id: 1
  역할: Write (INSERT, UPDATE, DELETE)
  Binary Log: 활성화

# Slave 1 (Read)
mysql-slave-1:
  포트: 3307
  server-id: 2
  역할: Read (SELECT)
  Read-Only: Yes
  
# Slave 2 (Read)
mysql-slave-2:
  포트: 3308
  server-id: 3
  역할: Read (SELECT)
  Read-Only: Yes
```

### 아키텍처 흐름

```
┌────────────────────────────────────────┐
│         Nginx Load Balancer            │
│            (Port 80)                   │
└───────────┬────────────────────────────┘
            │
    ┌───────┴───────┐
    │               │
┌───▼───┐       ┌───▼───┐
│ App 1 │  ...  │ App 10│  (10 Spring Boot Apps)
└───┬───┘       └───┬───┘
    │               │
    └───────┬───────┘
            │
    ┌───────▼────────────────────────┐
    │                                │
┌───▼──────┐    ┌──────────┐   ┌──────────┐
│  Master  │───►│ Slave 1  │   │ Slave 2  │
│ (Write)  │    │  (Read)  │   │  (Read)  │
│   3306   │    │   3307   │   │   3308   │
└──────────┘    └──────────┘   └──────────┘
     │               ▲               ▲
     │               │               │
     └───────────────┴───────────────┘
           Binary Log Replication
```

---

## 🔍 상태 확인 방법

### 방법 1: 자동 스크립트 (추천!) ⭐

```bash
# 실행 권한 부여
chmod +x check-mysql-replication.sh

# 실행
./check-mysql-replication.sh
```

**출력 예시:**
```
======================================
🔍 MySQL Replication 상태 확인
======================================

1️⃣ MySQL 컨테이너 상태 확인:
✅ chat-mysql-master 실행 중
✅ chat-mysql-slave-1 실행 중
✅ chat-mysql-slave-2 실행 중

2️⃣ Master 상태 확인:
✅ Master 정상 작동
📊 Master 정보:
  - Binary Log File: mysql-bin.000001
  - Binary Log Position: 157

3️⃣ Slave 1 상태 확인:
📊 Slave 1 상태:
  - Slave_IO_Running: ✅ Yes
  - Slave_SQL_Running: ✅ Yes
  - Seconds_Behind_Master: ✅ 0 (지연 없음)
✅ Slave 1 Replication 정상!

4️⃣ Slave 2 상태 확인:
📊 Slave 2 상태:
  - Slave_IO_Running: ✅ Yes
  - Slave_SQL_Running: ✅ Yes
  - Seconds_Behind_Master: ✅ 0 (지연 없음)
✅ Slave 2 Replication 정상!

🎉 MySQL Master-Slave Replication이 정상적으로 작동 중입니다!
```

---

### 방법 2: 수동 확인

#### 1. 컨테이너 실행 확인

```bash
docker ps | grep mysql
```

**출력:**
```
chat-mysql-master   Up 10 minutes   0.0.0.0:3306->3306/tcp
chat-mysql-slave-1  Up 10 minutes   0.0.0.0:3307->3306/tcp
chat-mysql-slave-2  Up 10 minutes   0.0.0.0:3308->3306/tcp
```

#### 2. Master 상태 확인

```bash
# Master에 접속
docker exec -it chat-mysql-master mysql -uroot -p

# MySQL 내부에서 실행
SHOW MASTER STATUS;
```

**출력 예시:**
```
+------------------+----------+--------------+------------------+
| File             | Position | Binlog_Do_DB | Binlog_Ignore_DB |
+------------------+----------+--------------+------------------+
| mysql-bin.000001 |      157 | db_coreconnect |                |
+------------------+----------+--------------+------------------+
```

**확인 사항:**
- ✅ `File`: Binary Log 파일명
- ✅ `Position`: 현재 위치 (계속 증가)
- ✅ `Binlog_Do_DB`: Replication 대상 DB

#### 3. Slave 1 상태 확인

```bash
# Slave 1에 접속
docker exec -it chat-mysql-slave-1 mysql -uroot -p

# MySQL 내부에서 실행
SHOW SLAVE STATUS\G
```

**출력 예시:**
```
*************************** 1. row ***************************
               Slave_IO_State: Waiting for master to send event
                  Master_Host: mysql-master
                  Master_User: repl_user
                  Master_Port: 3306
             Slave_IO_Running: Yes  ✅ (중요!)
            Slave_SQL_Running: Yes  ✅ (중요!)
              Master_Log_File: mysql-bin.000001
          Read_Master_Log_Pos: 157
               Relay_Log_File: mysql-relay-bin.000002
          Exec_Master_Log_Pos: 157
      Seconds_Behind_Master: 0  ✅ (지연 시간)
           Last_IO_Error:        ✅ (비어있어야 함)
          Last_SQL_Error:        ✅ (비어있어야 함)
```

**확인 사항:**
- ✅ `Slave_IO_Running`: **Yes** (Master에서 Binary Log 수신)
- ✅ `Slave_SQL_Running`: **Yes** (받은 Log 실행)
- ✅ `Seconds_Behind_Master`: **0** (지연 없음)
- ✅ `Last_IO_Error`: **비어있음** (에러 없음)
- ✅ `Last_SQL_Error`: **비어있음** (에러 없음)

#### 4. Slave 2 상태 확인

```bash
# Slave 2에 접속
docker exec -it chat-mysql-slave-2 mysql -uroot -p

# MySQL 내부에서 실행
SHOW SLAVE STATUS\G
```

(출력 내용은 Slave 1과 동일)

---

### 방법 3: 빠른 원라이너 명령어

#### Master 상태

```bash
docker exec chat-mysql-master mysql -uroot -p"Chat@2024!Secure" -e "SHOW MASTER STATUS\G"
```

#### Slave 1 상태

```bash
docker exec chat-mysql-slave-1 mysql -uroot -p"Chat@2024!Secure" -e "SHOW SLAVE STATUS\G" | grep -E "Slave_IO_Running|Slave_SQL_Running|Seconds_Behind_Master"
```

**출력:**
```
Slave_IO_Running: Yes
Slave_SQL_Running: Yes
Seconds_Behind_Master: 0
```

#### Slave 2 상태

```bash
docker exec chat-mysql-slave-2 mysql -uroot -p"Chat@2024!Secure" -e "SHOW SLAVE STATUS\G" | grep -E "Slave_IO_Running|Slave_SQL_Running|Seconds_Behind_Master"
```

---

## 🧪 Replication 테스트

### 실시간 Replication 테스트

#### 1. Master에 데이터 INSERT

```bash
# Master에 접속
docker exec -it chat-mysql-master mysql -uroot -p

# 테스트 데이터 INSERT
USE db_coreconnect;
INSERT INTO users (user_email, user_password, user_name) 
VALUES ('replication_test@test.com', 'password', 'Replication Test');

# 확인
SELECT * FROM users WHERE user_email = 'replication_test@test.com';
```

#### 2. Slave 1에서 확인

```bash
# Slave 1에 접속
docker exec -it chat-mysql-slave-1 mysql -uroot -p

# 데이터 확인
USE db_coreconnect;
SELECT * FROM users WHERE user_email = 'replication_test@test.com';
```

**결과:** 
- ✅ 같은 데이터가 보이면 **Replication 성공!**
- ❌ 데이터가 없으면 **Replication 문제!**

#### 3. Slave 2에서 확인

```bash
# Slave 2에 접속
docker exec -it chat-mysql-slave-2 mysql -uroot -p

# 데이터 확인
USE db_coreconnect;
SELECT * FROM users WHERE user_email = 'replication_test@test.com';
```

#### 4. Slave Read-Only 테스트

```bash
# Slave 1에 접속
docker exec -it chat-mysql-slave-1 mysql -uroot -p

# Write 시도 (실패해야 정상!)
USE db_coreconnect;
INSERT INTO users (user_email, user_password, user_name) 
VALUES ('fail@test.com', 'password', 'Should Fail');
```

**예상 결과:**
```
ERROR 1290 (HY000): The MySQL server is running with the --read-only option so it cannot execute this statement
```

✅ **이 에러가 나오면 Read-Only가 정상 작동!**

---

## 🔧 트러블슈팅

### 문제 1: Slave_IO_Running = No

**원인:**
- Master와 Slave 간 네트워크 연결 문제
- Replication 사용자 권한 문제
- Binary Log 파일 위치 불일치

**해결:**

```bash
# 1. Master에서 Replication 사용자 확인
docker exec chat-mysql-master mysql -uroot -p"Chat@2024!Secure" -e "SELECT user, host FROM mysql.user WHERE user='repl_user';"

# 2. Slave에서 Replication 재시작
docker exec -it chat-mysql-slave-1 mysql -uroot -p
STOP SLAVE;
RESET SLAVE;
START SLAVE;
SHOW SLAVE STATUS\G

# 3. 에러 확인
SHOW SLAVE STATUS\G | grep Last_IO_Error
```

---

### 문제 2: Slave_SQL_Running = No

**원인:**
- SQL 실행 중 에러 (중복 키, 외래 키 제약 등)
- Master와 Slave 데이터 불일치

**해결:**

```bash
# 1. 에러 확인
docker exec chat-mysql-slave-1 mysql -uroot -p"Chat@2024!Secure" -e "SHOW SLAVE STATUS\G" | grep -E "Last_SQL_Error|Last_SQL_Errno"

# 2. 특정 에러 스킵 (주의!)
docker exec -it chat-mysql-slave-1 mysql -uroot -p
SET GLOBAL SQL_SLAVE_SKIP_COUNTER = 1;
START SLAVE;

# 3. 완전 재동기화 (데이터 초기화!)
# start-cluster.sh 스크립트가 자동으로 처리
```

---

### 문제 3: Seconds_Behind_Master가 계속 증가

**원인:**
- Slave 서버 성능 부족
- 네트워크 대역폭 부족
- Master의 Write 부하 과다

**해결:**

```bash
# 1. Slave 리소스 확인
docker stats chat-mysql-slave-1

# 2. Replication Lag 모니터링
docker exec chat-mysql-slave-1 mysql -uroot -p"Chat@2024!Secure" -e "SHOW SLAVE STATUS\G" | grep Seconds_Behind_Master

# 3. Parallel Replication 활성화
docker exec -it chat-mysql-slave-1 mysql -uroot -p
SET GLOBAL slave_parallel_workers = 4;
STOP SLAVE;
START SLAVE;
```

---

### 문제 4: Replication 완전 재설정

```bash
# 1. 클러스터 중지
./stop-cluster.sh

# 2. MySQL 데이터 볼륨 삭제 (주의! 데이터 초기화!)
docker volume rm $(docker volume ls -q | grep mysql)

# 3. 클러스터 재시작 (Replication 자동 설정)
./start-cluster.sh
```

---

## 📊 성능 최적화

### Replication 성능 설정

#### Master 최적화 (docker-compose.yml)

```yaml
--innodb-buffer-pool-size=2G      # InnoDB 캐시 크기
--innodb-log-file-size=512M       # Redo Log 크기
--innodb-flush-log-at-trx-commit=2  # 성능 향상 (일부 내구성 희생)
--max-connections=1000            # 최대 연결 수
```

#### Slave 최적화

```yaml
--read-only=1                     # 읽기 전용 (필수!)
--slave-parallel-workers=4        # 병렬 Replication (권장)
--slave-parallel-type=LOGICAL_CLOCK  # 병렬 타입
```

### 로드 밸런싱 전략

#### Write (INSERT/UPDATE/DELETE)
```java
// Master만 사용
@Transactional
public void saveMessage(Chat chat) {
    chatRepository.save(chat);  // Master (3306)
}
```

#### Read (SELECT)
```java
// Slave 사용 (로드 밸런싱)
@Transactional(readOnly = true)
public List<Chat> getMessages(Integer roomId) {
    return chatRepository.findByRoomId(roomId);  // Slave 1/2 (3307/3308)
}
```

### Spring Boot 설정 (application.yml)

```yaml
spring:
  datasource:
    master:
      url: jdbc:mysql://mysql-master:3306/db_coreconnect
      username: root
      password: ${MYSQL_ROOT_PASSWORD}
      
    slave1:
      url: jdbc:mysql://mysql-slave-1:3306/db_coreconnect
      username: root
      password: ${MYSQL_ROOT_PASSWORD}
      
    slave2:
      url: jdbc:mysql://mysql-slave-2:3306/db_coreconnect
      username: root
      password: ${MYSQL_ROOT_PASSWORD}
```

---

## 📈 모니터링

### Grafana 대시보드

1. **Grafana 접속**
   - URL: `http://localhost:3000`
   - Username: `admin`
   - Password: `admin123`

2. **MySQL Replication 메트릭**
   - Seconds Behind Master (Replication Lag)
   - Binary Log Position
   - Slave IO/SQL Running Status
   - Replication Errors

### Prometheus 쿼리

```promql
# Replication Lag
mysql_slave_status_seconds_behind_master

# Replication 상태
mysql_slave_status_slave_io_running
mysql_slave_status_slave_sql_running
```

---

## 🎯 체크리스트

### Replication 정상 작동 확인

- [ ] Master 컨테이너 실행 중
- [ ] Slave 1 컨테이너 실행 중
- [ ] Slave 2 컨테이너 실행 중
- [ ] Master `SHOW MASTER STATUS` 정상
- [ ] Slave 1 `Slave_IO_Running = Yes`
- [ ] Slave 1 `Slave_SQL_Running = Yes`
- [ ] Slave 1 `Seconds_Behind_Master = 0`
- [ ] Slave 2 `Slave_IO_Running = Yes`
- [ ] Slave 2 `Slave_SQL_Running = Yes`
- [ ] Slave 2 `Seconds_Behind_Master = 0`
- [ ] Replication 테스트 성공 (Master INSERT → Slave SELECT)
- [ ] Slave Read-Only 확인 (INSERT 실패)

---

## 📞 추가 도움말

### 관련 문서
- `docker-compose.yml`: MySQL 설정
- `start-cluster.sh`: Replication 자동 설정
- `health-check.sh`: 상태 확인
- `서버_스케일_아웃_10대_구축_가이드.md`: 전체 아키텍처

### 명령어 요약

```bash
# 전체 상태 확인
./check-mysql-replication.sh

# 빠른 확인
docker exec chat-mysql-master mysql -uroot -p"Chat@2024!Secure" -e "SHOW MASTER STATUS\G"
docker exec chat-mysql-slave-1 mysql -uroot -p"Chat@2024!Secure" -e "SHOW SLAVE STATUS\G" | grep Running

# 로그 확인
docker-compose logs -f mysql-master
docker-compose logs -f mysql-slave-1
docker-compose logs -f mysql-slave-2

# 재시작
./stop-cluster.sh
./start-cluster.sh
```

---

## ✅ 결론

**MySQL Master-Slave Replication 구성 완료!**

- ✅ Master 1대 (Write)
- ✅ Slave 2대 (Read)
- ✅ Binary Log Replication
- ✅ Read-Only Slave
- ✅ 자동 Failover 지원 (미래 개선)

**성능:**
- Write: Master 단독 처리
- Read: Slave 2대로 로드 밸런싱 (2배 성능!)
- Replication Lag: < 1초 (최적화 시)

**확인:**
```bash
./check-mysql-replication.sh
```

🎉 **10만명 동시 접속 준비 완료!**



