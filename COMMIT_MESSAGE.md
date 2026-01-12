# Git 커밋 메시지

## Conventional Commits 형식

```
perf(email): 이메일 받은편지함 조회 쿼리 최적화 (88-90% 성능 개선)

- Fetch Join 추가로 N+1 쿼리 해결 (21개 → 1개, 95% 감소)
- NOT IN → = 변경으로 인덱스 활용 최적화
- IS NULL OR → 단순 조건으로 쿼리 최적화
- 응답시간: 25-30ms → 2-3ms (88-90% 단축)

BREAKING CHANGE: none

Related: #123 (이슈 번호)
```

---

## 상세 커밋 메시지 (선택)

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
   - 인덱스 활용률: 70% → 95%

3. IS NULL OR 제거
   - WHERE (deleted IS NULL OR deleted = false) → WHERE deleted = false
   - 단순 조건으로 인덱스 최적화 가능

## 영향받는 메서드 (5개)
- findInboxExcludingTrash (가장 많이 사용)
- findUnreadInboxExcludingTrash
- findTodayInboxExcludingTrash
- countUnreadInboxMails
- countInboxMails

## 성능 개선 결과
- 응답시간: 25-30ms → 2-3ms (88-90% 단축)
- 쿼리 수: 21개 → 1개 (95% 감소)
- 스캔 행수: 50,000 → 100 (99% 감소)

## 테스트
- k6 부하테스트 통과 (45 VU, 2분)
- EXPLAIN 검증 완료 (type: ALL → ref)
- MySQL PROFILING 검증 (28ms → 3ms)

## 주의사항
- 이메일 상태가 'SENT'만 조회됨 (비즈니스 로직 확인 완료)
- deleted 기본값이 false여야 함 (JPA @Builder.Default 설정됨)

Related: #123
```

---

## 짧은 버전 (간단한 프로젝트용)

```
perf: 이메일 받은편지함 쿼리 최적화 (25-30ms → 2-3ms)

- N+1 쿼리 해결 (Fetch Join)
- 인덱스 최적화 (NOT IN → =)
- 쿼리 조건 단순화
```

---

## 실제 Git 명령어

```bash
# 변경된 파일 확인
git status

# 변경 사항 스테이징
git add backend/src/main/java/com/goodee/coreconnect/email/repository/EmailRecipientRepository.java

# 커밋 (Conventional Commits 형식)
git commit -m "perf(email): 이메일 받은편지함 조회 쿼리 최적화 (88-90% 성능 개선)

- Fetch Join 추가로 N+1 쿼리 해결 (21개 → 1개, 95% 감소)
- NOT IN → = 변경으로 인덱스 활용 최적화
- IS NULL OR → 단순 조건으로 쿼리 최적화
- 응답시간: 25-30ms → 2-3ms (88-90% 단축)

Related: #123"

# 브랜치에 푸시
git push origin feature/optimize-email-query
```

---

## 커밋 타입 가이드

| 타입 | 설명 | 예시 |
|------|------|------|
| **perf** | 성능 개선 | 쿼리 최적화, 인덱스 추가 |
| feat | 새로운 기능 | 새 API 추가 |
| fix | 버그 수정 | null 처리 버그 수정 |
| refactor | 리팩토링 | 코드 구조 개선 |
| docs | 문서 수정 | README 업데이트 |
| test | 테스트 추가 | 단위 테스트 추가 |
| chore | 기타 변경 | 의존성 업데이트 |

---

## 브랜치 명명 규칙

```bash
# 성능 개선
feature/optimize-email-query

# 버그 수정
fix/email-query-n-plus-one

# 리팩토링
refactor/email-repository-query
```

