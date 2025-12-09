# 배포 스크립트 가이드

## 📋 개요

Rolling Update 방식의 무중단 배포 스크립트입니다.
**Health Check 실패 시 이전 버전으로 자동 롤백됩니다.**

---

## 🚀 사용 방법

### **1. 스크립트 실행 권한 부여** (최초 1회만)

```bash
chmod +x scripts/deploy.sh
```

### **2. 배포 실행**

```bash
# 프로젝트 루트 디렉토리에서 실행
./scripts/deploy.sh
```

또는

```bash
# 어느 디렉토리에서든 실행 가능
bash /path/to/final_project_coreconnect/scripts/deploy.sh
```

---

## 🔄 배포 프로세스

```
1. Git Pull (최신 코드 가져오기)
   ↓
2. 현재 버전 백업 (이미지 정보 저장)
   ↓
3. Docker 이미지 빌드 (기존 서비스 계속 실행)
   ↓
4. Backend Rolling Update
   - 기존 컨테이너를 백업 이름으로 변경
   - 새 컨테이너 시작
   - Health Check (최대 90초)
   ┌─ ✅ 성공 → 백업 컨테이너 제거
   └─ ❌ 실패 → 자동 롤백 (새 컨테이너 제거 + 백업 컨테이너 복구)
   ↓
5. Frontend Rolling Update
   - 기존 컨테이너를 백업 이름으로 변경
   - 새 컨테이너 시작
   - Health Check (최대 30초)
   ┌─ ✅ 성공 → 백업 컨테이너 제거
   └─ ❌ 실패 → 자동 롤백 (새 컨테이너 제거 + 백업 컨테이너 복구)
   ↓
6. 사용하지 않는 이미지 정리
   ↓
7. 배포 완료! ✅
```

### **🔐 자동 롤백 메커니즘**

Health Check 실패 시 즉시 이전 버전으로 롤백:
1. 실패한 새 컨테이너 중지 및 제거
2. 백업해둔 이전 컨테이너 복구 및 시작
3. 복구 후 Health Check 재확인
4. 서비스 연속성 보장 (다운타임 최소화)

---

## ⏱️ 예상 소요 시간

| 단계 | 소요 시간 | 다운타임 |
|------|----------|---------|
| Git Pull | 5초 | 0초 |
| 이미지 빌드 | 1~2분 | 0초 |
| Backend 업데이트 | 30~90초 | **5~10초** |
| Frontend 업데이트 | 10~30초 | **5~10초** |
| 총 소요 시간 | 2~4분 | **10~20초** |

**다운타임**: 새 컨테이너가 시작되고 기존 컨테이너가 종료되는 짧은 순간만 발생 (약 10~20초)

---

## 🔍 Health Check

### **Backend Health Check**
```bash
curl -f http://localhost:8080/actuator/health
```

**응답 예시** (정상):
```json
{
  "status": "UP",
  "components": {
    "diskSpace": {"status": "UP"},
    "db": {"status": "UP"},
    "ping": {"status": "UP"}
  }
}
```

### **Frontend Health Check**
```bash
curl -f http://localhost:80
```

**응답**: HTML 페이지 (200 OK)

---

## 🛑 롤백 방법

### **✅ 자동 롤백 (권장)**

Health Check 실패 시 **자동으로 이전 버전으로 롤백**됩니다.
별도 조치 불필요!

```bash
# 배포 중 Health Check 실패 시:
❌ Backend Health Check 실패!
🔄 이전 버전으로 자동 롤백 시작...
🗑️  실패한 컨테이너 제거 중...
♻️  이전 버전 복구 중...
✅ 이전 버전으로 롤백 완료!
   서비스가 정상 운영 중입니다.
```

---

### **수동 롤백 (자동 롤백 실패 시)**

배포 중 예상치 못한 문제 발생 시:

#### **방법 1: 이전 이미지로 롤백**
```bash
# 이전 이미지 확인
docker images | grep final_project_coreconnect

# 특정 이미지로 컨테이너 재시작
docker-compose down
docker run -d --name boot-container <이전_이미지_ID>
```

#### **방법 2: Git 리버트 후 재배포**
```bash
# 이전 커밋으로 되돌리기
git revert HEAD
git push origin main

# 재배포 (자동 롤백 포함)
./scripts/deploy.sh
```

#### **방법 3: 백업 컨테이너 수동 복구**
```bash
# 백업 컨테이너 확인
docker ps -a | grep backup

# 백업 컨테이너 복구
docker stop boot-container
docker rm boot-container
docker rename boot-container-backup boot-container
docker start boot-container
```

---

## 📊 배포 후 확인

### **1. 컨테이너 상태 확인**
```bash
docker ps
```

### **2. 로그 확인**
```bash
# Backend 로그
docker logs boot-container --tail 100 -f

# Frontend 로그
docker logs nginx-container --tail 100 -f
```

### **3. Health Check 확인**
```bash
# Backend
curl http://localhost:8080/actuator/health

# Frontend
curl http://localhost:80
```

### **4. 웹사이트 접속 확인**
- http://coreconnect.io.kr
- 로그인 → 채팅/이메일 기능 테스트

---

## ⚠️ 주의사항

1. **환경 변수 확인**: `.env` 파일 또는 EC2 환경 변수가 설정되어 있는지 확인
2. **디스크 용량**: Docker 이미지가 쌓이므로 주기적으로 정리 필요
3. **네트워크**: `my-network` 도커 네트워크가 존재해야 함
4. **권한**: `docker` 명령어 실행 권한 필요 (sudo 또는 docker 그룹 소속)

---

## 🐛 트러블슈팅

### **문제 1: Health Check 실패 (자동 롤백 발생)**
```bash
# 1. 실패 원인 확인
docker logs boot-container --tail 100

# 2. 컨테이너 내부 접속하여 확인
docker exec -it boot-container sh

# 3. Health Check 수동 실행
curl http://localhost:8080/actuator/health

# 4. 데이터베이스 연결 확인
# application.properties의 DB 설정 확인
```

**일반적인 원인:**
- 데이터베이스 연결 실패
- 환경 변수 누락 (`.env` 파일)
- 메모리 부족
- 포트 충돌

### **문제 2: 자동 롤백 실패**
```bash
# 백업 컨테이너 확인
docker ps -a | grep backup

# 수동 복구
docker stop boot-container
docker rm boot-container
docker rename boot-container-backup boot-container
docker start boot-container

# 백업이 없는 경우 이전 이미지로 복구
docker images | grep final_project_coreconnect
docker-compose down
docker run -d --name boot-container <이전_이미지_ID>
```

### **문제 3: 포트 충돌**
```bash
# 8080 포트 사용 중인 프로세스 확인
sudo lsof -i :8080

# 해당 프로세스 종료
sudo kill -9 <PID>
```

### **문제 4: 디스크 공간 부족**
```bash
# Docker 정리
docker system prune -a -f

# 사용하지 않는 볼륨 삭제
docker volume prune -f

# 백업 컨테이너 정리 (배포 실패 후 남은 경우)
docker rm boot-container-backup nginx-container-backup
```

---

## 📝 로그 파일

배포 로그를 파일로 저장하려면:

```bash
./scripts/deploy.sh 2>&1 | tee deploy-$(date +%Y%m%d-%H%M%S).log
```

---

## 🔗 관련 문서

- [Docker Compose 문서](https://docs.docker.com/compose/)
- [Spring Boot Actuator](https://docs.spring.io/spring-boot/docs/current/reference/html/actuator.html)
- [Nginx 공식 문서](https://nginx.org/en/docs/)

---

## 💡 팁

### **빠른 재배포** (코드 변경이 거의 없을 때)
```bash
# 캐시 사용하여 빠르게 빌드
docker-compose build
docker-compose up -d --no-deps backend frontend
```

### **특정 서비스만 업데이트**
```bash
# Backend만 업데이트
docker-compose up -d --no-deps --build backend

# Frontend만 업데이트
docker-compose up -d --no-deps --build frontend
```

### **배포 전 테스트**
```bash
# 로컬에서 먼저 테스트
docker-compose -f docker-compose.yml up --build

# 정상 동작 확인 후 배포
./scripts/deploy.sh
```

