# K6 테스트 HTML 리포트 가이드

## 📋 개요

k6 부하 테스트 결과를 웹 브라우저에서 볼 수 있는 HTML 리포트로 변환하는 완전한 솔루션입니다.

## 🚀 빠른 시작

### 1. 서버에 파일 업로드

```bash
# MobaXterm으로 다음 파일들을 서버에 업로드:
- create-k6-html-report.sh
- run-k6-html.sh
- test.js
- users.csv
```

### 2. 실행 권한 부여

```bash
cd /home/ubuntu/final_project_coreconnect
chmod +x create-k6-html-report.sh
chmod +x run-k6-html.sh
```

### 3. 테스트 실행 (전체 자동화)

```bash
./run-k6-html.sh
```

이 명령 하나로 다음이 모두 자동으로 수행됩니다:
- ✅ k6 테스트 실행
- ✅ JSON 결과 저장
- ✅ HTML 리포트 생성
- ✅ 웹 서버 시작

### 4. 브라우저에서 확인

```
http://54.116.26.182:8000/k6-web-reports/report_YYYYMMDD_HHMMSS.html
```

---

## 📁 파일 구조

```
final_project_coreconnect/
├── test.js                      # k6 테스트 스크립트
├── users.csv                    # 테스트 사용자 데이터
├── create-k6-html-report.sh     # JSON → HTML 변환 스크립트
├── run-k6-html.sh              # 전체 자동화 스크립트
└── k6-web-reports/             # 결과 저장 디렉토리
    ├── result_YYYYMMDD_HHMMSS.json
    └── report_YYYYMMDD_HHMMSS.html
```

---

## 🎯 사용 방법

### 방법 1: 전체 자동화 (권장)

테스트 실행부터 HTML 생성까지 한 번에:

```bash
./run-k6-html.sh
```

### 방법 2: 기존 JSON을 HTML로 변환

이미 테스트를 실행했고 JSON 파일이 있는 경우:

```bash
./create-k6-html-report.sh k6-web-reports/result_20251216_210042.json
```

### 방법 3: 웹 서버만 실행

HTML 파일이 이미 있는 경우:

```bash
python3 -m http.server 8000
```

---

## 📊 HTML 리포트 내용

생성된 HTML 리포트에는 다음 정보가 포함됩니다:

### 1. 주요 메트릭
- 총 HTTP 요청 수
- 총 반복 수 (Iterations)
- 체크 성공률
- 최대 가상 사용자 수 (VUs)

### 2. 테스트 시나리오
- 실행된 모든 시나리오 목록

### 3. 성능 메트릭
- HTTP 요청 응답 시간
  - 평균 (Average)
  - 최소 (Min)
  - 최대 (Max)
  - P95 (95 백분위수)

### 4. 상세 통계
- 모든 메트릭의 요약 정보

---

## 🔧 AWS 보안 그룹 설정

웹 브라우저에서 리포트를 보려면 포트 8000을 열어야 합니다:

**AWS Console → EC2 → 보안 그룹:**

```
유형: Custom TCP
프로토콜: TCP
포트 범위: 8000
소스: 내 IP (또는 0.0.0.0/0)
설명: K6 HTML Report Server
```

---

## 💡 유용한 명령어

### 모든 리포트 목록 보기

```bash
ls -lht k6-web-reports/
```

### 특정 리포트 찾기

```bash
find k6-web-reports/ -name "*.html" -type f
```

### 가장 최근 리포트 찾기

```bash
ls -t k6-web-reports/report_*.html | head -1
```

### 웹 서버를 백그라운드로 실행

```bash
nohup python3 -m http.server 8000 > webserver.log 2>&1 &
```

### 웹 서버 중지

```bash
pkill -f "python3 -m http.server"
```

---

## 🎨 리포트 커스터마이징

`create-k6-html-report.sh` 파일을 수정하여 리포트 디자인을 변경할 수 있습니다:

- CSS 스타일 수정: `<style>` 섹션
- 표시 메트릭 변경: JavaScript 코드
- 레이아웃 수정: HTML 구조

---

## 🐛 문제 해결

### 1. "File not found" 오류

**원인**: 웹 서버가 다른 디렉토리에서 실행됨

**해결**:
```bash
cd /home/ubuntu/final_project_coreconnect
python3 -m http.server 8000
```

### 2. "Connection refused" 오류

**원인**: AWS 보안 그룹에서 포트 8000이 차단됨

**해결**: AWS Console에서 포트 8000 인바운드 규칙 추가

### 3. HTML이 생성되지 않음

**원인**: JSON 파일 경로가 잘못됨

**해결**:
```bash
ls -la k6-web-reports/
./create-k6-html-report.sh k6-web-reports/[실제파일명].json
```

---

## 📝 예제

### 전체 워크플로우

```bash
# 1. 서버 접속
ssh -i your-key.pem ubuntu@54.116.26.182

# 2. 프로젝트 디렉토리로 이동
cd /home/ubuntu/final_project_coreconnect

# 3. users.csv 수정 (실제 사용자 정보)
nano users.csv

# 4. 테스트 실행 및 HTML 생성
./run-k6-html.sh

# 5. 브라우저에서 확인
# http://54.116.26.182:8000/k6-web-reports/report_YYYYMMDD_HHMMSS.html
```

### 여러 테스트 비교

```bash
# 테스트 1 실행
./run-k6-html.sh
# Ctrl+C로 종료

# 테스트 2 실행
./run-k6-html.sh
# Ctrl+C로 종료

# 웹 서버만 실행
python3 -m http.server 8000

# 브라우저에서 k6-web-reports/ 접속하여 여러 리포트 비교
```

---

## 🎯 팁

1. **자동화**: cron으로 주기적 테스트 실행
2. **버전 관리**: 각 배포 후 테스트하여 성능 변화 추적
3. **비교 분석**: 여러 리포트를 저장하여 성능 트렌드 파악
4. **알림**: 성능 저하 시 알림 설정 가능

---

## 📞 지원

문제가 발생하면 다음을 확인하세요:

1. 파일 권한: `chmod +x *.sh`
2. 웹 서버 실행: `python3 -m http.server 8000`
3. AWS 보안 그룹: 포트 8000 개방
4. JSON 파일 존재: `ls -la k6-web-reports/`

---

**버전**: 1.0.0  
**최종 업데이트**: 2025-12-16  
**작성자**: CoreConnect Team
















