package com.goodee.coreconnect.security.jwt;

import java.security.Key;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;

import org.springframework.stereotype.Component;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;

@Component
public class JwtProvider {
  
  //Base64 인코딩 필요 없음
  private static final String SECRET = "this_is_a_very_long_secret_key_for_jwt_example_12345678901234567890";
  private final Key key = Keys.hmacShaKeyFor(SECRET.getBytes());


  public String createAccess(String subject, long minutes) {
    return Jwts.builder()
        .setSubject(subject)
        .setIssuedAt(new Date())
        .setExpiration(Date.from(Instant.now().plus(Duration.ofMinutes(minutes))))
        .signWith(key, SignatureAlgorithm.HS256)
        .compact();
  }
  public String createRefresh(String subject, long days) {
    return Jwts.builder()
        .setSubject(subject)
        .setIssuedAt(new Date())
        .setExpiration(Date.from(Instant.now().plus(Duration.ofDays(days))))
        .signWith(key, SignatureAlgorithm.HS256)
        .compact();
  }
  public String getSubject(String token){
    return Jwts.parserBuilder().setSigningKey(key).build()
        .parseClaimsJws(token).getBody().getSubject();
  }
}
