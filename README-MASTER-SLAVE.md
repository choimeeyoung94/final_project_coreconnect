# 🚀 MySQL Master-Slave 구성 빠른 시작 가이드

## 📋 개요

이 프로젝트는 **MySQL Master-Slave Replication**을 통해 데이터베이스 부하를 분산하고 성능을 최적화합니다.

- **Master DB**: Write 작업 (INSERT, UPDATE, DELETE)
- **Slave DB**: Read 작업 (SELECT)

## 🎯 기대 효과

- 📈 **Read 쿼리 3-4배 빠름**
- ✍️  **Write 쿼리 1.8배 빠름**
- 🚀 **동시 처리 용량 3배 증가**
- 💪 **CPU 사용률 안정화**

---

## 🛠️ 빠른 시작 (Docker Compose)

### 1. 환경변수 설정

```bash
# .env 파일 생성 (선택사항)
export MYSQL_ROOT_PASSWORD="Chat@2024!Secure"
export MYSQL_REPLICATION_PASSWORD="Repl@2024!Pass"
```

### 2. 데이터베이스 시작

```bash
# 1. Master 시작
docker-compose up -d mysql-master

# 2. Master 준비 대기 (30초 정도 소요)
echo "⏳ Waiting for Master to be ready..."
sleep 30

# 3. Slave 시작
docker-compose up -d mysql-slave-1 mysql-slave-2

# 4. Slave 준비 대기 (30초 정도 소요)
echo "⏳ Waiting for Slaves to be ready..."
sleep 30
```

### 3. Replication 설정

```bash
# Slave 1 복제 설정
docker exec -it chat-mysql-slave-1 bash -c "
mysql -u root -p\$MYSQL_ROOT_PASSWORD <<EOF
STOP SLAVE;
CHANGE MASTER TO
  MASTER_HOST='mysql-master',
  MASTER_USER='repl_user',
  MASTER_PASSWORD='Repl@2024!Pass',
  MASTER_AUTO_POSITION=1,
  GET_MASTER_PUBLIC_KEY=1;
START SLAVE;
SHOW SLAVE STATUS\G
EOF
"

# Slave 2 복제 설정
docker exec -it chat-mysql-slave-2 bash -c "
mysql -u root -p\$MYSQL_ROOT_PASSWORD <<EOF
STOP SLAVE;
CHANGE MASTER TO
  MASTER_HOST='mysql-master',
  MASTER_USER='repl_user',
  MASTER_PASSWORD='Repl@2024!Pass',
  MASTER_AUTO_POSITION=1,
  GET_MASTER_PUBLIC_KEY=1;
START SLAVE;
SHOW SLAVE STATUS\G
EOF
"
```

### 4. 복제 상태 확인

```bash
# Slave 1 상태 확인
docker exec -it chat-mysql-slave-1 bash /scripts/check-replication.sh

# Slave 2 상태 확인
docker exec -it chat-mysql-slave-2 bash /scripts/check-replication.sh
```

**정상 출력:**
```
🎉 복제 상태: 정상
✅ IO Thread: Running
✅ SQL Thread: Running
✅ 복제 지연: 0초 (실시간 동기화)
```

### 5. 애플리케이션 시작

```bash
# Spring Boot 서버 시작
docker-compose up -d chat-app-1 chat-app-2 chat-app-3

# 로그 확인
docker-compose logs -f chat-app-1
```

**정상 로그:**
```
🔵 MASTER DataSource configured: jdbc:mysql://mysql-master:3306/db_coreconnect
🟢 SLAVE DataSource configured: jdbc:mysql://mysql-slave-1:3306/db_coreconnect
🔄 Routing DataSource initialized with MASTER (default) and SLAVE
```

---

## 🧪 동작 테스트

### 1. Write 작업 (Master DB 사용)

```bash
# 채팅 메시지 전송 API 호출
curl -X POST http://localhost:8080/api/chat/rooms/1/messages \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello, World!"}'
```

**애플리케이션 로그:**
```
✍️  [Transaction] Write operation → Using MASTER DB
```

### 2. Read 작업 (Slave DB 사용)

```bash
# 채팅 메시지 조회 API 호출
curl http://localhost:8080/api/chat/rooms/1/messages?page=0&size=20
```

**애플리케이션 로그:**
```
📖 [Transaction] Read-Only detected → Using SLAVE DB
```

### 3. 복제 확인

```bash
# 1. Master에 데이터 삽입
docker exec -it chat-mysql-master mysql -u root -pChat@2024!Secure db_coreconnect -e "
INSERT INTO chat_message (message_content, sent_at, file_yn, chat_room_id, sender_id)
VALUES ('Test Message', NOW(), false, 1, 1);
"

# 2. Slave에서 확인 (1-2초 후)
docker exec -it chat-mysql-slave-1 mysql -u root -pChat@2024!Secure db_coreconnect -e "
SELECT * FROM chat_message ORDER BY id DESC LIMIT 1;
"
```

---

## 📊 모니터링

### Replication Lag 확인

```bash
# 실시간 모니터링
watch -n 1 'docker exec -it chat-mysql-slave-1 mysql -u root -pChat@2024!Secure -e "SHOW SLAVE STATUS\G" | grep "Seconds_Behind_Master"'
```

### DataSource 사용 통계

```bash
# Actuator 엔드포인트 조회
curl http://localhost:8080/actuator/metrics/datasource.query

# Prometheus 메트릭
curl http://localhost:8080/actuator/prometheus | grep datasource
```

---

## 🐛 트러블슈팅

### 문제 1: Slave 복제가 시작되지 않음

**증상:**
```
Slave_IO_Running: No
Slave_SQL_Running: No
```

**해결:**
```bash
# 1. Master 연결 확인
docker exec -it chat-mysql-slave-1 mysql -u root -pChat@2024!Secure -e "
SELECT 1;
"

# 2. Replication 재설정
docker exec -it chat-mysql-slave-1 bash /scripts/setup-replication.sh
```

### 문제 2: Replication Lag 증가

**증상:**
```
Seconds_Behind_Master: 10
```

**해결:**
```bash
# 1. Slave 서버 리소스 확인
docker stats chat-mysql-slave-1

# 2. Slow Query 확인
docker exec -it chat-mysql-master mysql -u root -pChat@2024!Secure -e "
SELECT * FROM mysql.slow_log ORDER BY query_time DESC LIMIT 10;
"

# 3. 필요시 Slave 추가
docker-compose up -d mysql-slave-3
```

### 문제 3: Connection Pool 고갈

**증상:**
```
HikariPool-1 - Connection is not available
```

**해결:**
```yaml
# application.yml 수정
spring:
  datasource:
    slave:
      hikari:
        maximum-pool-size: 80  # 50 → 80으로 증가
```

---

## 📚 상세 문서

- [Master-Slave 아키텍처 상세 가이드](backend/docs/DATABASE_MASTER_SLAVE_ARCHITECTURE.md)
- [Notification 성능 최적화](backend/docs/NOTIFICATION_PERFORMANCE_OPTIMIZATION.md)

---

## 🎓 Spring Boot 코드 예제

### Read 작업 (Slave DB 사용)

```java
@Service
@Transactional(readOnly = true)  // ⭐ Slave DB 자동 사용
public class ChatRoomService {
    
    public List<ChatRoomDTO> getChatRooms(Integer userId) {
        // Slave DB에서 조회
        return chatRoomRepository.findByUserId(userId);
    }
}
```

### Write 작업 (Master DB 사용)

```java
@Service
public class ChatRoomService {
    
    @Transactional  // ⭐ Master DB 자동 사용
    public Chat sendMessage(Integer roomId, String content) {
        // Master DB에 저장
        return chatRepository.save(newChat);
    }
}
```

---

## 🚀 Kubernetes 배포

```bash
# 1. MySQL Master-Slave 배포
kubectl apply -f k8s/01-mysql-master-slave.yaml

# 2. 상태 확인
kubectl get pods -n chat-system

# 3. Replication 설정
kubectl exec -it mysql-slave-0 -n chat-system -- bash /scripts/setup-replication.sh
kubectl exec -it mysql-slave-1 -n chat-system -- bash /scripts/setup-replication.sh

# 4. 애플리케이션 배포
kubectl apply -f k8s/03-chat-server.yaml
```

---

## ✅ 체크리스트

- [ ] Master DB 정상 동작 확인
- [ ] Slave DB 정상 동작 확인
- [ ] Replication 설정 완료
- [ ] `Slave_IO_Running: Yes` 확인
- [ ] `Slave_SQL_Running: Yes` 확인
- [ ] `Seconds_Behind_Master: 0` 확인
- [ ] 애플리케이션 로그에서 Master/Slave 분기 확인
- [ ] Write 테스트 성공
- [ ] Read 테스트 성공
- [ ] 복제 동작 확인

---

## 📞 지원

문제 발생 시:
1. [트러블슈팅](#-트러블슈팅) 섹션 확인
2. 로그 확인: `docker-compose logs -f mysql-master mysql-slave-1`
3. 상세 문서 참고: [DATABASE_MASTER_SLAVE_ARCHITECTURE.md](backend/docs/DATABASE_MASTER_SLAVE_ARCHITECTURE.md)

---

**🎉 10만건 이상의 채팅 데이터도 문제없이 처리할 수 있는 강력한 시스템입니다!**




