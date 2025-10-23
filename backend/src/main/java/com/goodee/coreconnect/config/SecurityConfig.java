package com.goodee.coreconnect.config;

import org.springframework.boot.autoconfigure.security.servlet.PathRequest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

  @Bean
  SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    http.csrf(csrf -> csrf.disable());
    http.cors(cors -> {}); // WebConfig의 CORS 설정 사용

    http.authorizeHttpRequests(auth -> auth
        // 정적 리소스 허용 (css/js/img 등)
        .requestMatchers(PathRequest.toStaticResources().atCommonLocations()).permitAll()
        // 루트/에러/파비콘
        .requestMatchers("/", "/index.html", "/error", "/favicon.ico").permitAll()
        // 테스트/헬스 API
        .requestMatchers("/api/hello", "/api/health").permitAll()
        // 그 외는 인증 필요
        .anyRequest().authenticated()
    );

    return http.build();
  }
}