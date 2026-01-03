package com.goodee.coreconnect.security.config;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.goodee.coreconnect.security.jwt.JwtAuthFilter;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
@Slf4j
public class SecurityConfig {

    /*
     * @Value
     * Spring에서 설정 파일(application.properties 등)에 있는 값을 
     * 자바 코드에 주입(Injection)할 때 쓰는 애너테이션이다. 
     * 즉 설정 파일의 값을 읽어서 변수에 자동으로 넣어주는 역할이다. 
     */
    @Value("${security.mode:secure}")
    private String securityMode; // 개발용 or 배포용
    private final JwtAuthFilter jwtAuthFilter;

    /**
     * Spring Security의 전체 보안 규칙을 설정하는 Bean.
     * 인증/인가, 세션 정책, 예외 처리, JWT 필터 등을 구성한다.
     */
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            // CORS 설정을 먼저 적용 (필터 체인 순서 중요)
            .cors(cors -> cors.configurationSource(corsConfigurationSource())) 
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(ex -> ex
              .authenticationEntryPoint((req, res, e) -> {
                log.info("[SECURITY] 401 AuthenticationEntryPoint: " + e.getMessage());
                res.sendError(HttpServletResponse.SC_UNAUTHORIZED);
              })
              .accessDeniedHandler((req, res, e) -> {
                log.info("[SECURITY] 403 AccessDeniedHandler: " + e.getMessage());
                res.sendError(HttpServletResponse.SC_FORBIDDEN);
              })
            );
      
        configureAuthorization(http);
        return http.build();
    }
    
    /**
     * HTTP 요청 인가 규칙을 설정하는 메서드
     * 개발 모드와 배포 모드에 따라 다른 인가 규칙을 적용함.
     */
    private void configureAuthorization(HttpSecurity http) throws Exception {
        if("open".equalsIgnoreCase(securityMode)) {
            log.info("프로필: 개발용");
            http.authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        } else {
            log.info("프로필: 배포용");
            http.authorizeHttpRequests(auth -> auth
                // 공개 경로: 인증 없이 접근 가능
                // 주의: OPTIONS 요청은 CORS 필터가 자동으로 처리하므로 permitAll()에서 제외
                .requestMatchers(
                    "/",                                  // 루트 경로
                    "/login",                             // 로그인 페이지
                    "/login/**",                          // 로그인 관련 경로
                    "/*.html",                            // HTML 파일
                    "/*.js",                              // JavaScript 파일
                    "/*.css",                             // CSS 파일
                    "/*.ico",                             // 파비콘
                    "/*.png",                             // 이미지
                    "/*.jpg",                             // 이미지
                    "/*.svg",                             // SVG 이미지
                    "/static/**",                         // 정적 리소스
                    "/assets/**",                         // React 빌드 assets
                    "/v3/api-docs/**",                    // Swagger API 문서
                    "/swagger-ui/**",                     // Swagger UI
                    "/swagger-ui.html",                   // Swagger UI (구버전)
                    "/swagger-resources/**",              // Swagger 리소스
                    "/webjars/**",                        // WebJars 리소스
                    "/ws/chat/**",                        // WebSocket 채팅 (SockJS info 엔드포인트 접근용, 실제 연결은 WebSocketAuthInterceptor에서 검증)
                    "/ws/chat-raw/**",                    // WebSocket 부하 테스트용 (인증 없음)
                    "/ws/notification/**",                // WebSocket 알림
                    "/api/v1/auth/**",                    // 인증 관련 API
                    "/api/v1/password-reset/requests",    // 비밀번호 초기화 요청
                    "/api/health",                        // AWS ELB 헬스체크 (기본)
                    "/api/health/**",                     // AWS ELB 헬스체크 (상세, liveness, readiness)
                    "/actuator/health",                   // Docker Health Check
                    "/actuator/health/**"                 // Docker Health Check (상세)
                ).permitAll()
                // 나머지 경로는 로그인 필요
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter,
                org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter.class);
        }
    }

    @Value("${app.cors.allowed-origins:http://localhost:5173}")
    private String corsAllowedOrigins;

    /**
     * Cors 허용 규칙을 정의하는 Bean.
     * 프론트엔드에서 오는 요청을 허용할 도메인, 메서드, 헤더를 지정한다.
     * HTTPS 환경에서도 정상 작동하도록 설정.
     */
    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        
        // 환경 변수에서 직접 읽기 (CORS_ALLOWED_ORIGINS)
        String envCorsOrigins = System.getenv("CORS_ALLOWED_ORIGINS");
        String originsToUse = (envCorsOrigins != null && !envCorsOrigins.isEmpty()) 
            ? envCorsOrigins 
            : corsAllowedOrigins;
        
        // 허용할 Origin 목록을 읽어서 쉼표로 분리하고 공백 제거
        List<String> allowedOrigins = List.of(originsToUse.split(","))
            .stream()
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .toList();
        
        log.info("[CORS] 환경 변수 CORS_ALLOWED_ORIGINS: {}", envCorsOrigins);
        log.info("[CORS] 사용할 Origins: {}", allowedOrigins);
        
        // setAllowedOriginPatterns 사용 (Spring Boot 2.4+ 권장, credentials와 함께 사용 가능)
        // HTTPS와 HTTP 모두 지원하도록 패턴 사용
        config.setAllowedOriginPatterns(allowedOrigins);
        
        // 모든 HTTP 메서드 허용 (OPTIONS preflight 요청 포함)
        config.setAllowedMethods(List.of("GET","POST","PUT","PATCH","DELETE","OPTIONS","HEAD"));
        
        // CORS 요청에 필요한 모든 헤더 허용
        config.setAllowedHeaders(List.of(
            "Authorization",
            "Content-Type",
            "Cookie",
            "X-Requested-With",
            "Accept",
            "Origin",
            "Access-Control-Request-Method",
            "Access-Control-Request-Headers"
        ));
        
        // credentials 허용 (쿠키 전송을 위해 필수)
        config.setAllowCredentials(true);
        
        // 브라우저가 접근할 수 있는 응답 헤더 노출
        config.setExposedHeaders(List.of(
            "Set-Cookie",
            "Authorization",
            "Content-Type"
        ));
        
        // Preflight 요청 캐시 시간 (24시간)
        config.setMaxAge(86400L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    /**
     * 비밀번호를 암호화하기 위한 Bean.
     * BCrypt 알고리즘을 사용하여 안전하게 비밀번호를 해시 처리한다.
     */
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}