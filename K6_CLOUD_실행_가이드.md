# K6 Cloud 실행 가이드

## ❌ 문제 상황

```bash
k6 cloud login --token <토큰>
# ERROR[0000] unknown flag: --token
```

`--token` 플래그를 지원하지 않는 k6 버전입니다.

---

## ✅ 해결 방법

### 방법 1: 환경 변수 사용 (권장)

```bash
# 1. SSH로 K6 서버 접속
ssh ubuntu@3.38.141.119

# 2. K6 테스트 디렉토리로 이동
cd ~/k6-loadtest

# 3. 환경 변수로 토큰 설정 후 실행 (한 줄로)
K6_CLOUD_TOKEN="ce099a2f38a7cD556688c4a969614b793834e379cc70a3d0d6df1356342c0504" k6 run --out cloud test.js
```

**가장 간단하고 빠른 방법입니다!**

---

### 방법 2: export로 환경 변수 설정

```bash
# 1. SSH로 K6 서버 접속
ssh ubuntu@3.38.141.119

# 2. K6 테스트 디렉토리로 이동
cd ~/k6-loadtest

# 3. 환경 변수 설정 (현재 세션에서만 유효)
export K6_CLOUD_TOKEN="ce099a2f38a7cD556688c4a969614b793834e379cc70a3d0d6df1356342c0504"

# 4. Cloud 로그인
k6 cloud login

# 5. 테스트 실행
k6 run --out cloud test.js
```

---

### 방법 3: .bashrc에 영구 설정

```bash
# 1. SSH로 K6 서버 접속
ssh ubuntu@3.38.141.119

# 2. .bashrc에 추가
echo 'export K6_CLOUD_TOKEN="ce099a2f38a7cD556688c4a969614b793834e379cc70a3d0d6df1356342c0504"' >> ~/.bashrc

# 3. 설정 적용
source ~/.bashrc

# 4. Cloud 로그인
k6 cloud login

# 5. 테스트 실행
k6 run --out cloud test.js
```

**영구적으로 설정하고 싶다면 이 방법을 사용하세요!**

---

### 방법 4: Interactive 로그인

```bash
# 1. SSH로 K6 서버 접속
ssh ubuntu@3.38.141.119

# 2. K6 테스트 디렉토리로 이동
cd ~/k6-loadtest

# 3. Interactive 로그인 시작
k6 cloud login

# 4. 토큰 입력 프롬프트가 나오면 붙여넣기
# Token: [여기에 토큰 붙여넣기]
ce099a2f38a7cD556688c4a969614b793834e379cc70a3d0d6df1356342c0504

# 5. 테스트 실행
k6 run --out cloud test.js
```

---

## 📊 실행 후 결과 확인

테스트가 실행되면 터미널에 Grafana Cloud URL이 출력됩니다:

```
execution: cloud
output: https://choimeeyoung2.grafana.net/a/k6-app/runs/XXXXXX
```

해당 URL로 접속하거나, 아래 링크에서 확인하세요:

**Grafana Cloud K6 대시보드**:
https://choimeeyoung2.grafana.net/a/k6-app/

---

## 🎯 추천 방법

**지금 당장 테스트하려면**: 방법 1 (환경 변수 한 줄)

```bash
ssh ubuntu@3.38.141.119
cd ~/k6-loadtest
K6_CLOUD_TOKEN="ce099a2f38a7cD556688c4a969614b793834e379cc70a3d0d6df1356342c0504" k6 run --out cloud test.js
```

**자주 사용할 예정이라면**: 방법 3 (.bashrc 영구 설정)

---

## 🔍 토큰 작동 확인

```bash
# 환경 변수가 설정되었는지 확인
echo $K6_CLOUD_TOKEN

# 로그인 상태 확인
k6 cloud login --show
```

---

## ⚠️ 주의사항

1. **토큰 보안**
   - 토큰은 API 키와 같으므로 절대 GitHub에 올리지 마세요
   - 공개 문서에 포함하지 마세요
   - 사용 후 만료 또는 재생성 권장

2. **만료일 확인**
   - 현재 토큰: 2025년 12월 30일까지 유효
   - Grafana Cloud 메시지: "You have uncapped usage until 2025년 12월 30일"
   - 만료 전에 새 토큰 발급 받으세요

3. **무료 플랜 제한**
   - 동시 실행: 1개
   - VU(Virtual Users): 최대 50개
   - 테스트 시간: 최대 10분
   - 초과 시 업그레이드 필요

---

**작성일**: 2025-12-17  
**서버**: 3.38.141.119 (K6 전용)  
**Grafana Cloud**: https://choimeeyoung2.grafana.net

