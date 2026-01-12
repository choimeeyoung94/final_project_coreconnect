fix: SecurityConfig에 정적 리소스 경로 추가 (401 에러 해결)

- /, /login, /*.html, /*.js, /*.css 등 정적 리소스 경로를 permitAll()에 추가
- 프론트엔드 정적 파일 접근 시 401 Unauthorized 에러 해결
- /static/**, /assets/** 경로 추가로 React 빌드 파일 서빙 가능
- SPA 라우팅 경로(/login 등)에 대한 Spring Security 인증 우회 설정

변경 파일:
- backend/src/main/java/com/goodee/coreconnect/security/config/SecurityConfig.java


























