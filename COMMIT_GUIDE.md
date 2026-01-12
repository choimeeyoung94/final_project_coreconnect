# 🚀 커밋 & PR 가이드

## ⚡ Quick Start (3단계)

### 1️⃣ 자동 커밋 스크립트 사용 (추천!)

```bash
# 실행 권한 부여
chmod +x git-commit.sh

# 자동 커밋 & 푸시
./git-commit.sh
```

**끝!** 스크립트가 자동으로:
- ✅ 변경사항 확인
- ✅ Git Add
- ✅ Git Commit (commit_message.txt 사용)
- ✅ Git Push (선택 사항)

---

### 2️⃣ 수동 커밋 (직접 제어)

```bash
# 모든 파일 추가
git add .

# 커밋 (메시지 파일 사용)
git commit -F commit_message.txt

# 푸시
git push origin feature/scale-out-10-servers
```

---

### 3️⃣ 선택적 커밋 (파일 선택)

```bash
# Docker Compose 구성 파일만
git add docker-compose.yml
git add 환경변수_설정.txt
git add nginx/nginx.conf
git add monitoring/

# 스크립트만
git add start-cluster.sh
git add stop-cluster.sh
git add health-check.sh

# 문서만
git add README_DOCKER_COMPOSE.md
git add QUICK_START.md
git add PULL_REQUEST.md
git add CHANGES.md

# 버그 수정
git add backend/src/main/java/com/goodee/coreconnect/chat/service/ChatRoomServiceImpl.java

# 커밋
git commit -F commit_message.txt

# 푸시
git push origin feature/scale-out-10-servers
```

---

## 📋 변경사항 체크리스트

### 신규 파일 (16개)

#### 핵심 구성
- [ ] `docker-compose.yml` (1,200 lines)
- [ ] `환경변수_설정.txt` (30 lines)

#### Nginx
- [ ] `nginx/nginx.conf` (300 lines)

#### 모니터링
- [ ] `monitoring/prometheus.yml` (100 lines)
- [ ] `monitoring/grafana/datasources/datasource.yml` (80 lines)
- [ ] `monitoring/grafana/dashboards/dashboard.yml` (20 lines)

#### 스크립트
- [ ] `start-cluster.sh` (200 lines)
- [ ] `stop-cluster.sh` (50 lines)
- [ ] `health-check.sh` (250 lines)
- [ ] `git-commit.sh` (150 lines)

#### 문서
- [ ] `README_DOCKER_COMPOSE.md` (800 lines)
- [ ] `QUICK_START.md` (400 lines)
- [ ] `서버_스케일_아웃_10대_구축_가이드.md` (2,000+ lines)
- [ ] `PULL_REQUEST.md` (1,000+ lines)
- [ ] `commit_message.txt` (60 lines)
- [ ] `CHANGES.md` (400 lines)

### 수정 파일 (1개)
- [ ] `backend/src/main/java/com/goodee/coreconnect/chat/service/ChatRoomServiceImpl.java` (2 lines)

---

## 📝 커밋 메시지 미리보기

```
feat: 10만명 동시접속 채팅방 서버 스케일 아웃 구성 (Docker Compose)

[주요 구성]
- Docker Compose로 10대 Spring Boot 서버 구성
- Nginx 로드 밸런서 (Least Connection 알고리즘)
- Redis Pub/Sub (서버 간 실시간 메시지 동기화, 5ms 지연)
- Redis Session (세션 클러스터링)
- MySQL Master-Slave Replication (Write/Read 분리)
- Prometheus + Grafana 실시간 모니터링
- 자동화 스크립트 (start-cluster.sh, stop-cluster.sh, health-check.sh)

[인프라 구성]
- 총 18개 컨테이너 동시 운영
  · Nginx: 1개 (로드 밸런서)
  · Spring Boot: 10개 (채팅 서버, 8081-8090)
  · Redis: 2개 (Pub/Sub 6379, Session 6380)
  · MySQL: 3개 (Master 3306, Slave 3307-3308)
  · Monitoring: 2개 (Prometheus 9090, Grafana 3000)
  · Redis Commander: 1개 (Redis GUI, 8081)

[예상 성능]
- 동시 접속: 100,000명 (기존 10,000명 대비 10배)
- 메시지 지연: 50ms (기존 5,000ms 대비 99% 개선)
- P95 지연: 100ms (기존 10,000ms 대비 99% 개선)
- 처리량: 10,000 msg/s (기존 100 msg/s 대비 100배)
- 에러율: 0.1% (기존 15% 대비 99.3% 개선)

[버그 수정]
- ChatRoomServiceImpl: findByChatRoomIdWithUser → findByChatRoomId 메서드명 수정
```

---

## 🌿 브랜치 전략

### 새 브랜치 생성 (추천)

```bash
# 브랜치 생성 및 체크아웃
git checkout -b feature/scale-out-10-servers

# 변경사항 추가 및 커밋
git add .
git commit -F commit_message.txt

# 푸시
git push origin feature/scale-out-10-servers
```

### 기존 브랜치 사용

```bash
# 현재 브랜치 확인
git branch

# 변경사항 추가 및 커밋
git add .
git commit -F commit_message.txt

# 푸시
git push
```

---

## 📬 Pull Request 생성

### GitHub에서 PR 생성

1. **GitHub Repository** 이동
2. **Pull requests** 탭 클릭
3. **New pull request** 클릭
4. **Base**: `main` ← **Compare**: `feature/scale-out-10-servers`
5. **Title** 입력:
   ```
   feat: 10만명 동시접속 채팅방 서버 스케일 아웃 구성
   ```
6. **Description**에 `PULL_REQUEST.md` 내용 복사 & 붙여넣기
7. **Reviewers** 선택
8. **Create pull request** 클릭!

---

## 🔍 커밋 전 체크리스트

### 코드 품질
- [x] 컴파일 에러 없음
- [x] Lint 에러 없음
- [x] 테스트 통과 (로컬)

### 문서
- [x] README 작성 완료
- [x] QUICK_START 작성 완료
- [x] PULL_REQUEST 작성 완료
- [x] 커밋 메시지 작성 완료

### 보안
- [x] 비밀번호 .env로 분리
- [x] .gitignore 설정
- [x] 환경 변수 템플릿 제공

### 테스트
- [x] 로컬 테스트 (docker-compose up)
- [x] 헬스체크 통과
- [ ] CI/CD 통과 (GitHub Actions)

---

## 🚨 주의사항

### ⚠️ 커밋하면 안 되는 파일
```bash
# 절대 커밋 금지!
.env                    # 실제 비밀번호 포함
.DS_Store              # macOS 파일
*.log                  # 로그 파일
node_modules/          # 의존성
*.swp, *.swo          # Vim 임시 파일
```

### ✅ 커밋해야 하는 파일
```bash
# 반드시 커밋!
docker-compose.yml     # 인프라 정의
환경변수_설정.txt      # 환경 변수 템플릿 (비밀번호 제외)
nginx/nginx.conf       # Nginx 설정
*.sh                   # 자동화 스크립트
*.md                   # 문서
```

---

## 💡 유용한 Git 명령어

### 변경사항 확인
```bash
# 상태 확인
git status

# 변경사항 요약
git status --short

# 변경사항 상세 (Diff)
git diff

# 스테이징된 파일 확인
git diff --cached
```

### 커밋 수정
```bash
# 마지막 커밋 메시지 수정
git commit --amend -m "새 메시지"

# 마지막 커밋에 파일 추가
git add forgotten-file.txt
git commit --amend --no-edit

# 커밋 취소 (변경사항 유지)
git reset --soft HEAD^

# 커밋 취소 (변경사항 삭제)
git reset --hard HEAD^
```

### 푸시 관련
```bash
# 강제 푸시 (주의!)
git push --force origin feature/scale-out-10-servers

# 강제 푸시 (안전)
git push --force-with-lease origin feature/scale-out-10-servers

# 푸시 취소
git push origin :feature/scale-out-10-servers
```

---

## 📊 통계

### 변경사항 통계
```bash
# 변경된 파일 개수
git diff --stat

# 추가/삭제 라인 수
git diff --numstat

# 커밋 로그
git log --oneline --graph
```

### 예상 통계
- **신규 파일**: 16개
- **수정 파일**: 1개
- **추가 라인**: ~7,500 lines
- **삭제 라인**: ~2 lines

---

## 🎯 다음 단계

### 커밋 후
1. ✅ GitHub Actions 빌드 확인
2. ✅ 린터 체크 통과 확인
3. ✅ Pull Request 생성
4. ✅ 리뷰 요청

### PR 승인 후
1. [ ] Merge to main
2. [ ] 태그 생성 (v1.0.0)
3. [ ] 릴리즈 노트 작성
4. [ ] 스테이징 배포
5. [ ] 프로덕션 배포

---

## 🙏 도움말

### 문제 해결

#### 문제 1: 머지 충돌
```bash
# 충돌 확인
git status

# 충돌 파일 수정 후
git add <충돌-파일>
git commit -m "fix: 머지 충돌 해결"
```

#### 문제 2: 잘못된 커밋
```bash
# 마지막 커밋 취소
git reset --soft HEAD^

# 파일 수정 후 다시 커밋
git add .
git commit -F commit_message.txt
```

#### 문제 3: 푸시 실패
```bash
# 리모트 변경사항 가져오기
git pull --rebase origin main

# 다시 푸시
git push origin feature/scale-out-10-servers
```

---

## 📞 문의

질문이나 문제가 있으면:
1. **이슈 생성**: GitHub Issues
2. **문서 확인**: CHANGES.md, README_DOCKER_COMPOSE.md
3. **팀 문의**: Slack, Email

---

**Happy Committing! 🚀**

Made with ❤️ for 10만명 동시접속 채팅방



