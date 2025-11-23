package com.goodee.coreconnect.security.jwt;

import java.io.IOException;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.goodee.coreconnect.security.userdetails.CustomUserDetails;
import com.goodee.coreconnect.security.userdetails.CustomUserDetailsService;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * JwtAuthFilter
 * - 모든 HTTP 요청마다 한 번씩 실행되는 JWT 인증 필터.
 * - 요청의 HTTP-only 쿠키(access_token)를 확인하고 토큰이 유효하면 SecurityContext에 인증 정보를 등록.
 *
 * 변경된 안전 패턴 요약:
 * 1) 토큰이 없으면 아무것도 등록하지 않음(기존 SecurityContext 유지하지 않음).
 * 2) 토큰이 있으면 먼저 jwtProvider.isValid(token) 으로 유효성 검사 수행.
 * 3) 유효한 토큰에 대해서만 subject(email)을 꺼내 사용자 로드 후 Authentication 등록.
 * 4) 예외 또는 유효하지 않은 토큰인 경우 SecurityContextHolder.clearContext()를 호출하여
 *    이전 인증 정보가 남아있지 않도록 보장.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtProvider jwtProvider;
    private final CustomUserDetailsService customUserDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {

        final String uri = req.getRequestURI();
        final String method = req.getMethod();
        log.debug("[JWT] 요청 URI: {}, Method: {}", uri, method);
        
        // restore-from-trash 엔드포인트에 대한 요청은 INFO 레벨로 로깅
        if (uri.contains("/restore-from-trash")) {
            log.info("[JWT] restore-from-trash 요청 감지 - URI: {}, Method: {}", uri, method);
        }

        // 예외 경로(문서/웹소켓/리프레시 등)는 토큰 검사 생략
        if (uri.startsWith("/ws/chat") ||
            uri.equals("/swagger-ui.html") ||
            uri.startsWith("/swagger-ui/") ||
            uri.startsWith("/v3/api-docs") ||
            uri.startsWith("/swagger-resources") ||
            uri.startsWith("/webjars") ||
            uri.startsWith("/api/v1/auth/refresh")) {
            chain.doFilter(req, res);
            return;
        }

        // SecurityContext를 안전하게 초기화하지 않음(요청 처리 중 기존 값이 유지되어야 하는 경우가 있으므로)
        // 다만, 토큰 검증 실패 시에는 명확히 정리하도록 아래에서 처리합니다.

        String token = resolveTokenFromCookie(req);

        if (token == null) {
            log.warn("[JWT] 요청에 access_token 쿠키가 없습니다. URI: {}", uri);
            // 토큰이 없으면 인증을 설정하지 않고 다음 필터로 진행
            // (인증이 필요한 엔드포인트라면 이후에 AuthenticationEntryPoint가 401 처리)
            chain.doFilter(req, res);
            return;
        }

        // 토큰이 존재하는 경우 안전하게 검증 및 인증 처리
        try {
            // 1) 토큰 유효성 검사: 만료/서명 등 검증
            if (!jwtProvider.isValid(token)) {
                // 유효하지 않은 토큰: 컨텍스트 정리 및 로깅
                SecurityContextHolder.clearContext();
                log.warn("[JWT] 토큰 유효성 검사 실패(만료 또는 서명 불일치). 요청URI={}", uri);
                chain.doFilter(req, res);
                return;
            }

            // 2) 토큰에서 subject(이메일) 추출
            final String email = jwtProvider.getSubject(token);
            if (email == null || email.isBlank()) {
                SecurityContextHolder.clearContext();
                log.warn("[JWT] 토큰에서 subject(email)를 추출할 수 없음. 요청URI={}", uri);
                chain.doFilter(req, res);
                return;
            }

            // 3) User 조회 및 Authentication 생성 (필요시 UserDetailsService에서 권한 포함)
            CustomUserDetails userDetails = (CustomUserDetails) customUserDetailsService.loadUserByUsername(email);
            if (userDetails == null) {
                SecurityContextHolder.clearContext();
                log.warn("[JWT] 사용자 조회 실패: email={}", email);
                chain.doFilter(req, res);
                return;
            }

            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(req));

            // 4) SecurityContext에 인증 등록
            SecurityContextHolder.getContext().setAuthentication(authentication);
            log.debug("[JWT] SecurityContext 인증 등록 완료: principal={}, authorities={}",
                    userDetails.getUsername(), userDetails.getAuthorities());

            // 요청 계속 처리
            chain.doFilter(req, res);
        } catch (Exception ex) {
            // 예외 발생 시 SecurityContext 정리하여 인증 정보가 누수되지 않도록 함
            SecurityContextHolder.clearContext();
            log.warn("[JWT] 인증 처리 중 예외 발생: {}", ex.getMessage());
            // 선택: 여기서 바로 401 응답을 보내고 체인을 중단할 수도 있음.
            // 현재는 후속 필터/핸들러에서 처리가 일어나도록 chain.doFilter 호출.
            chain.doFilter(req, res);
        }
    }

    /**
     * HttpOnly 쿠키에서 access_token 값을 추출하는 메서드
     */
    private String resolveTokenFromCookie(HttpServletRequest req) {
        Cookie[] cookies = req.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if ("access_token".equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }
}