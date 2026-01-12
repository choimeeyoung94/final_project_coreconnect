# 🔒 [FIX] SecurityConfig에 정적 리소스 경로 추가 (401 Unauthorized 에러 해결)

## 📌 문제 상황
- `coreconnect.io.kr/login` 접속 시 **HTTP 401 Unauthorized** 에러 발생
- Spring Security가 정적 리소스(HTML, CSS, JS) 경로를 차단하여 프론트엔드 파일 접근 불가
- `/api/v1/auth/**` 같은 API 경로만 `permitAll()`로 설정되어 있어 SPA 라우팅 경로가 차단됨

## 🔧 해결 방법
`SecurityConfig.java`의 `permitAll()` 설정에 **프론트엔드 정적 리소스 경로 추가**

### 추가된 경로:
```java
.requestMatchers(
    "/",                      // 루트 경로
    "/login",                 // 로그인 페이지
    "/login/**",              // 로그인 관련 경로
    "/*.html",                // HTML 파일
    "/*.js",                  // JavaScript 파일
    "/*.css",                 // CSS 파일
    "/*.ico",                 // 파비콘
    "/*.png", "/*.jpg", "/*.svg",  // 이미지 파일
    "/static/**",             // 정적 리소스
    "/assets/**",             // React 빌드 assets
    ...기존 경로들
).permitAll()
```

## ✅ 변경 사항
- **파일**: `backend/src/main/java/com/goodee/coreconnect/security/config/SecurityConfig.java`
- **변경 내용**: `configureAuthorization()` 메서드의 `requestMatchers()` 목록에 정적 리소스 경로 추가

## 🧪 테스트 방법
1. **배포 후 확인**:
   ```bash
   curl -I http://coreconnect.io.kr/login
   # 예상 결과: HTTP 200 OK
   ```

2. **브라우저 접속**:
   - `http://coreconnect.io.kr` → 로그인 페이지 정상 표시
   - `http://coreconnect.io.kr/login` → 로그인 페이지 정상 표시

## 📋 관련 이슈
- 10대 서버 스케일 아웃 구축 후 프론트엔드 접근 불가 문제
- Nginx 로드 밸런서 → Spring Boot 프록시 환경에서 정적 리소스 서빙

## 🚀 배포 순서
1. PR 머지 후 `feature_scale-out-10-servers` 브랜치에서 `git pull`
2. Docker 이미지 재빌드: `docker-compose build --no-cache chat-app-1`
3. 서비스 재시작: `docker-compose up -d`
4. 헬스체크 확인: `docker ps` 및 웹사이트 접속 테스트

## 📝 참고사항
- 이 변경은 **인증이 필요 없는 공개 경로**만 추가한 것으로 보안에 영향 없음
- `/api/v1/**` 같은 API 경로는 여전히 JWT 인증 필요
- WebSocket 경로는 기존대로 `WebSocketAuthInterceptor`에서 별도 검증

