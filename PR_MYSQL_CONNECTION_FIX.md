# PR: MySQL 연결 설정 수정 (10대 서버 구조 대응)

## 📋 개요
10대 서버 스케일 아웃 구조에서 백엔드가 MySQL에 연결하지 못하는 문제를 해결합니다.

## 🐛 문제 상황
- **증상**: Docker Compose로 10대 서버 구조 실행 시 백엔드가 MySQL 연결 실패
- **에러 메시지**: 
  - `java.net.UnknownHostException: mysql-container: Try again`
  - `com.mysql.cj.exceptions.CJCommunicationsException: Communications link failure`
- **원인**: `application.properties`에 하드코딩된 설정이 10대 서버 구조와 맞지 않음

## 🔧 해결 방법

### 변경 파일
- `backend/src/main/resources/application.properties`

### 변경 내용

#### Before
```properties
spring.datasource.url=jdbc:mysql://mysql-container:3306/db_coreconnect?useSSL=false&serverTimezone=Asia/Seoul&allowPublicKeyRetrieval=true
spring.datasource.username=admin
spring.datasource.password=finalcoreconnect
```

#### After
```properties
spring.datasource.url=jdbc:mysql://mysql-master:3306/db_coreconnect?useSSL=false&serverTimezone=Asia/Seoul&allowPublicKeyRetrieval=true
spring.datasource.username=root
spring.datasource.password=finalcoreconnect
```

### 주요 수정사항
1. **MySQL 호스트 변경**: `mysql-container` → `mysql-master`
   - 10대 서버 구조에서는 MySQL Master-Slave 복제 사용
   - Docker Compose의 서비스 이름과 일치하도록 수정

2. **사용자명 변경**: `admin` → `root`
   - MySQL Master-Slave 구조에서 사용하는 root 계정과 일치

## ✅ 테스트 결과

### 로컬 테스트
```bash
# application.properties 수정 확인
cat backend/src/main/resources/application.properties | grep mysql-master
# 결과: mysql-master로 변경됨 ✅
```

### EC2 배포 테스트 (예상)
```bash
# 1. 최신 코드 받기
git pull origin feature_scale-out-10-servers

# 2. Docker 이미지 재빌드
docker-compose build --no-cache

# 3. 재시작
docker-compose up -d

# 4. MySQL 연결 확인
docker logs chat-app-1 | grep "HikariPool-1 - Start completed"
# 예상 결과: HikariPool-1 연결 성공 ✅

# 5. 테이블 생성 확인
docker exec chat-mysql-master mysql -uroot -pfinalcoreconnect -e "USE db_coreconnect; SHOW TABLES;"
# 예상 결과: JPA가 테이블 자동 생성 ✅
```

## 🎯 기대 효과
1. **MySQL 연결 성공**: 백엔드가 MySQL Master-Slave에 정상 연결
2. **JPA 테이블 자동 생성**: Hibernate가 db_coreconnect에 필요한 테이블 생성
3. **Spring Boot 정상 시작**: 모든 백엔드 서버 (chat-app-1 ~ chat-app-10) healthy 상태
4. **nginx 로드밸런서 정상 작동**: 10대 서버로 트래픽 분산
5. **로그인 페이지 정상 표시**: nginx 기본 페이지 대신 React 애플리케이션 표시

## 📊 아키텍처

### Before (단일 서버 구조)
```
Nginx → boot-container (8080)
        ↓
        mysql-container (3306)
```

### After (10대 서버 + MySQL Master-Slave)
```
Nginx (Load Balancer)
  ↓
  ├─ chat-app-1 (8081) ──┐
  ├─ chat-app-2 (8082)   │
  ├─ chat-app-3 (8083)   │
  ├─ ...                 ├──→ mysql-master (3306) ──→ mysql-slave-1 (3307)
  ├─ chat-app-9 (8089)   │                        └──→ mysql-slave-2 (3308)
  └─ chat-app-10 (8090) ─┘
```

## 🔍 체크리스트

### 배포 전 확인사항
- [x] application.properties 수정 완료
- [x] Git commit 생성
- [ ] Git push (사용자가 직접 실행)
- [ ] EC2에서 git pull
- [ ] Docker 이미지 재빌드
- [ ] 컨테이너 재시작

### 배포 후 확인사항
- [ ] MySQL 연결 성공 확인
- [ ] JPA 테이블 생성 확인
- [ ] 백엔드 서버 healthy 상태 확인
- [ ] nginx healthy 상태 확인
- [ ] 로그인 페이지 정상 표시 확인
- [ ] 부하 테스트 실행

## 📝 관련 이슈
- 10대 서버 스케일 아웃 구조 배포
- MySQL Master-Slave 복제 설정
- nginx 로드밸런서 설정

## 🔗 참고 문서
- `서버_스케일_아웃_10대_구축_가이드.md`
- `EC2_배포_가이드.md`
- `docker-compose.yml`

---

## 💡 리뷰어 참고사항
이 수정은 단순한 설정 변경이지만, **10대 서버 스케일 아웃 구조의 핵심**입니다. 
이 변경 없이는 백엔드가 MySQL에 연결할 수 없어 전체 시스템이 작동하지 않습니다.

## ✅ 완료 조건
- EC2에서 `http://coreconnect.io.kr` 접속 시 nginx 기본 페이지가 아닌 **로그인 페이지** 표시
- 모든 백엔드 서버 (10대) healthy 상태
- MySQL Master-Slave 복제 정상 작동



























