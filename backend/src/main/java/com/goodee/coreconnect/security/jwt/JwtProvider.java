package com.goodee.coreconnect.security.jwt;

import java.security.Key;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.goodee.coreconnect.user.enums.Role;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;

/**
 * JwtProvider 
 * JWT(Json Web Token)을 제공(발급)하고 검증하는 역할을 수행한다.
 * 로그인 시 사용자 정보를 기반으로 JWT Access Token과 Refresh Token을 생성
 * 클라이언트 요청 시 전달된 토큰에서 사용자 정보(email, role 등)를 추출 
 * 토큰이 위조되거나 만료되지 않았는지 검증
 */
@Component
public class JwtProvider {

    // 환경변수에서 @Value로 JWT_SECRET_KEY 불러오기
    @Value("${jwt.secret}")
    private String SECRET;
    private Key key;
    
    /** @PostConstruct는 Spring의 모든 주입이 끝난 뒤 실행됨 */
    @PostConstruct
    public void init() {
        // JWT secret key 검증
        if (SECRET == null || SECRET.trim().isEmpty()) {
            throw new IllegalStateException(
                "JWT secret key is not configured. Please set JWT_SECRET_KEY environment variable. " +
                "The key must be at least 256 bits (32 characters) long."
            );
        }
        
        byte[] secretBytes = SECRET.getBytes();
        // 최소 256 bits (32 bytes) 필요
        if (secretBytes.length < 32) {
            throw new IllegalStateException(
                String.format(
                    "JWT secret key is too short. Current length: %d bytes. " +
                    "The key must be at least 256 bits (32 bytes) long for HMAC-SHA256. " +
                    "Please set JWT_SECRET_KEY environment variable with a longer key.",
                    secretBytes.length
                )
            );
        }
        
        this.key = Keys.hmacShaKeyFor(secretBytes);
    }
    
    /** Access 토큰 발급 */
    public String createAccess(String email, Role role, int minutes) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("role", role.name()); 

        return Jwts.builder()
                .setSubject(email) 
                .addClaims(claims) 
                .setIssuedAt(new Date())
                .setExpiration(Date.from(Instant.now().plus(Duration.ofMinutes(minutes))))
                //.setExpiration(Date.from(Instant.now().plus(Duration.ofSeconds(minutes))))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    /** Refresh 토큰 발급 */
    public String createRefresh(String subject, Role role, long days) {
      Map<String, Object> claims = new HashMap<>();
      claims.put("role", role.name()); 
        return Jwts.builder()
                .setSubject(subject)
                .addClaims(claims) 
                .setIssuedAt(new Date())
                .setExpiration(Date.from(Instant.now().plus(Duration.ofDays(days))))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    /** 토큰에서 사용자 이메일 추출 */
    public String getSubject(String token) {
    	if (token == null || token.trim().isEmpty()) {
            throw new IllegalArgumentException("JWT token must not be null or empty");
        }
        return getAllClaims(token).getSubject();
    }

    /** 토큰에서 사용자 역할 추출 */
    public String getRole(String token) {
        return getAllClaims(token).get("role", String.class);
    }

    /** 토큰을 복호화해서 본문(Claims)을 반환 */
    private Claims getAllClaims(String token) {
    	if (token == null || token.trim().isEmpty()) {
            throw new IllegalArgumentException("JWT token must not be null or empty");
        }
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    /** 
     * 유효성 검사
     * 파싱에 성공하면 true
     * 만료되었거나 서명이 잘못된 경우 false 반환
     */
    public boolean isValid(String token) {
        try {
            getAllClaims(token); 
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
