# Git 워크플로우 가이드

## 📋 작업 순서 (체크리스트)

- [ ] 1. 브랜치 생성
- [ ] 2. 코드 수정
- [ ] 3. 로컬 테스트
- [ ] 4. 커밋
- [ ] 5. 푸시
- [ ] 6. Pull Request 생성
- [ ] 7. 리뷰 및 머지
- [ ] 8. 배포

---

## 1️⃣ 브랜치 생성

```bash
# 1. 최신 main 브랜치로 전환
git checkout main

# 2. 최신 코드 받기
git pull origin main

# 3. 새 브랜치 생성
git checkout -b feature/optimize-email-query

# 확인
git branch
# * feature/optimize-email-query
#   main
```

---

## 2️⃣ 코드 수정

**수정한 파일**:
- `backend/src/main/java/com/goodee/coreconnect/email/repository/EmailRecipientRepository.java`

**주요 변경 사항**:
- LEFT JOIN FETCH 추가
- NOT IN → = 변경
- IS NULL OR 제거

---

## 3️⃣ 로컬 테스트

```bash
# 1. Gradle 빌드
cd backend
./gradlew clean build

# 확인 항목:
# [ ] 빌드 성공
# [ ] 테스트 통과

# 2. 애플리케이션 실행
./gradlew bootRun

# 3. API 테스트
curl "http://localhost:8080/api/v1/email/inbox?userEmail=admin@coreconnect.io.kr&page=0&size=20"

# 확인 항목:
# [ ] 응답 성공 (200 OK)
# [ ] 응답 시간 개선 확인
# [ ] 데이터 정합성 확인

# 4. k6 부하테스트 (선택)
cd ../../
k6 run test.js

# 확인 항목:
# [ ] 평균 응답시간: 2-3ms
# [ ] 성공률: 100%
```

---

## 4️⃣ 커밋

### 방법 1: 간단한 커밋 메시지

```bash
git add backend/src/main/java/com/goodee/coreconnect/email/repository/EmailRecipientRepository.java

git commit -m "perf: 이메일 받은편지함 쿼리 최적화 (25-30ms → 2-3ms)"
```

### 방법 2: 상세한 커밋 메시지 (권장)

```bash
git add backend/src/main/java/com/goodee/coreconnect/email/repository/EmailRecipientRepository.java

git commit -m "perf(email): 이메일 받은편지함 조회 쿼리 최적화 (88-90% 성능 개선)

- Fetch Join 추가로 N+1 쿼리 해결 (21개 → 1개, 95% 감소)
- NOT IN → = 변경으로 인덱스 활용 최적화
- IS NULL OR → 단순 조건으로 쿼리 최적화
- 응답시간: 25-30ms → 2-3ms (88-90% 단축)

Related: #123"
```

### 방법 3: 에디터로 작성 (가장 상세)

```bash
git add backend/src/main/java/com/goodee/coreconnect/email/repository/EmailRecipientRepository.java

git commit
# 에디터가 열리면 아래 내용 붙여넣기:
```

```
perf(email): 이메일 받은편지함 조회 쿼리 최적화

## 문제
- k6 부하테스트 결과 이메일 받은편지함 조회가 25-30ms로 가장 느림
- EXPLAIN 분석 결과 Full Table Scan (50,000 rows) 발생
- N+1 쿼리 문제로 21개 쿼리 실행

## 해결
1. LEFT JOIN FETCH 추가
   - EmailRecipient 조회 시 Email 엔티티를 한 번에 가져옴
   - N+1 쿼리 방지: 21개 → 1개 (95% 감소)

2. NOT IN → = 변경
   - WHERE email_status NOT IN (...) → WHERE email_status = 'SENT'
   - MySQL 옵티마이저가 인덱스 직접 사용

3. IS NULL OR 제거
   - WHERE (deleted IS NULL OR deleted = false) → WHERE deleted = false
   - 단순 조건으로 인덱스 최적화 가능

## 성능 개선 결과
- 응답시간: 25-30ms → 2-3ms (88-90% 단축)
- 쿼리 수: 21개 → 1개 (95% 감소)
- 스캔 행수: 50,000 → 100 (99% 감소)

## 테스트
- k6 부하테스트 통과 (45 VU, 2분)
- EXPLAIN 검증 완료 (type: ALL → ref)
- MySQL PROFILING 검증 (28ms → 3ms)

Related: #123
```

---

## 5️⃣ 푸시

```bash
# 원격 브랜치에 푸시
git push origin feature/optimize-email-query

# 또는 (처음 푸시 시 upstream 설정)
git push -u origin feature/optimize-email-query

# 결과 확인:
# remote: Create a pull request for 'feature/optimize-email-query' on GitHub by visiting:
# remote:   https://github.com/yourusername/final_project_coreconnect/pull/new/feature/optimize-email-query
```

---

## 6️⃣ Pull Request 생성

### GitHub 웹에서

1. **GitHub 저장소로 이동**
   - https://github.com/yourusername/final_project_coreconnect

2. **"Pull requests" 탭 클릭**

3. **"Compare & pull request" 버튼 클릭**
   (또는 "New pull request" 버튼 클릭)

4. **브랜치 선택**
   - base: `main`
   - compare: `feature/optimize-email-query`

5. **PR 제목 입력**
   ```
   perf(email): 이메일 받은편지함 조회 쿼리 최적화 (88-90% 성능 개선)
   ```

6. **PR 본문 입력**
   
   `PR_DESCRIPTION.md` 파일의 "짧은 버전" 또는 "중간 버전"을 복사-붙여넣기

7. **우측 사이드바 설정**
   - **Reviewers**: @backend-lead 선택
   - **Assignees**: 본인 선택
   - **Labels**: 
     - `performance`
     - `database`
     - `high-priority`
   - **Projects**: (해당 프로젝트 선택)
   - **Milestone**: (해당 마일스톤 선택)

8. **"Create pull request" 버튼 클릭**

---

## 7️⃣ 리뷰 및 머지

### 리뷰 중 수정 요청이 온 경우

```bash
# 1. 코드 수정
# (파일 수정)

# 2. 추가 커밋
git add .
git commit -m "fix: 리뷰 피드백 반영 - deleted 기본값 처리 개선"

# 3. 푸시 (같은 브랜치에)
git push origin feature/optimize-email-query

# → PR이 자동으로 업데이트됨!
```

### 리뷰 승인 후 머지

**방법 1: Squash and merge (권장)**
- 여러 커밋을 하나로 합침
- 히스토리가 깔끔함

**방법 2: Rebase and merge**
- 커밋을 main 위에 재배치
- 선형 히스토리 유지

**방법 3: Create a merge commit**
- 일반 머지 커밋 생성
- 모든 커밋 히스토리 보존

```
GitHub 웹에서 "Merge pull request" 버튼 클릭
→ "Squash and merge" 선택 (권장)
→ "Confirm squash and merge" 클릭
```

---

## 8️⃣ 배포

### 로컬 main 브랜치 업데이트

```bash
# 1. main 브랜치로 전환
git checkout main

# 2. 최신 코드 받기 (머지된 내용 포함)
git pull origin main

# 3. 작업 브랜치 삭제 (선택)
git branch -d feature/optimize-email-query

# 4. 원격 브랜치 삭제 (선택)
git push origin --delete feature/optimize-email-query
```

### 프로덕션 배포

**자동 배포 (CI/CD)**
- GitHub Actions 또는 Jenkins가 자동으로 배포
- main 브랜치에 머지되면 자동 트리거

**수동 배포**
```bash
# 1. 프로덕션 서버 접속
ssh ubuntu@54.116.26.182

# 2. 최신 코드 받기
cd ~/final_project_coreconnect
git pull origin main

# 3. Docker 이미지 재빌드
cd backend
docker build -t coreconnect-backend:v1.1 .

# 4. 컨테이너 재시작
docker stop boot-container
docker rm boot-container
docker run -d \
  --name boot-container \
  --restart always \
  -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=secure \
  coreconnect-backend:v1.1

# 5. Health Check
curl http://localhost:8080/actuator/health
# { "status": "UP" }

# 6. k6 재테스트
k6 run test.js
```

---

## 🚨 문제 해결 (Troubleshooting)

### 1. Push가 거부됨

```bash
# 에러: ! [rejected] feature/optimize-email-query -> feature/optimize-email-query (fetch first)

# 해결: 원격 변경사항 먼저 받기
git pull origin feature/optimize-email-query --rebase
git push origin feature/optimize-email-query
```

### 2. 충돌(Conflict) 발생

```bash
# main 브랜치의 최신 변경사항 가져오기
git checkout main
git pull origin main

# 작업 브랜치로 돌아가기
git checkout feature/optimize-email-query

# main 브랜치 변경사항 병합
git merge main

# 충돌 해결
# (충돌 파일 수정)

git add .
git commit -m "chore: 충돌 해결"
git push origin feature/optimize-email-query
```

### 3. 잘못된 커밋 메시지 수정

```bash
# 마지막 커밋 메시지 수정 (푸시 전)
git commit --amend -m "perf(email): 수정된 커밋 메시지"

# 강제 푸시 (주의!)
git push origin feature/optimize-email-query --force
```

### 4. 파일을 잘못 추가함

```bash
# 마지막 커밋에서 파일 제거 (푸시 전)
git reset HEAD~1
# 필요한 파일만 다시 add
git add backend/src/main/java/com/goodee/coreconnect/email/repository/EmailRecipientRepository.java
git commit -m "perf(email): 이메일 받은편지함 쿼리 최적화"
```

---

## 📝 Git 명령어 요약

### 기본 워크플로우

```bash
# 1. 브랜치 생성
git checkout -b feature/optimize-email-query

# 2. 파일 수정 후 스테이징
git add .

# 3. 커밋
git commit -m "perf(email): 이메일 받은편지함 쿼리 최적화"

# 4. 푸시
git push origin feature/optimize-email-query

# 5. PR 생성 (GitHub 웹)

# 6. 머지 후 로컬 업데이트
git checkout main
git pull origin main
git branch -d feature/optimize-email-query
```

### 유용한 명령어

```bash
# 현재 상태 확인
git status

# 변경 내용 확인
git diff

# 커밋 히스토리
git log --oneline

# 브랜치 목록
git branch -a

# 원격 저장소 확인
git remote -v

# 마지막 커밋 취소 (코드는 유지)
git reset --soft HEAD~1

# 변경사항 임시 저장
git stash
git stash pop
```

---

## 🎯 체크리스트 (전체)

### 코딩
- [x] 코드 수정 완료
- [x] 로컬 빌드 성공
- [x] 단위 테스트 통과
- [x] 통합 테스트 통과

### Git
- [x] 브랜치 생성
- [x] 커밋 메시지 작성 (Conventional Commits)
- [x] 푸시 완료

### GitHub
- [x] PR 생성
- [x] PR 본문 작성 (요약, 문제, 해결, 테스트)
- [x] 리뷰어 지정
- [x] 레이블 추가

### 리뷰
- [ ] 코드 리뷰 완료
- [ ] 승인 받음
- [ ] CI 통과

### 머지
- [ ] Squash and merge
- [ ] 브랜치 삭제
- [ ] 로컬 main 업데이트

### 배포
- [ ] 스테이징 배포
- [ ] 스테이징 테스트
- [ ] 프로덕션 배포
- [ ] 프로덕션 모니터링

---

**작성일**: 2025-12-17  
**버전**: 1.0  
**프로젝트**: CoreConnect

