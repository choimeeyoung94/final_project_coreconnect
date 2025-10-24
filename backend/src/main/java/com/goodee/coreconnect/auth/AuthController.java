package com.goodee.coreconnect.auth;

import java.time.Duration;
import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.goodee.coreconnect.security.jwt.JwtProvider;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.repository.UserRepository;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
  private final JwtProvider jwt;
  private final UserRepository userRepository;  
  private final PasswordEncoder passwordEncoder;

  @PostMapping("/login")
  public ResponseEntity<Map<String, Object>> login(
      @RequestBody Map<String, String> body,
      HttpServletResponse res) {

      // ✅ 요청값 받기
      String email = body.get("email");
      String password = body.get("password");

      // ✅ 1. 이메일로 사용자 조회
      User user = userRepository.findByEmail(email)
              .orElse(null);
      if (user == null) {
          return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
      }

      // ✅ 2. 비밀번호 비교 (BCrypt)
      if (!passwordEncoder.matches(password, user.getPassword())) {
          return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
      }

      // ✅ 3. 토큰 생성
      String access = jwt.createAccess(email, 10);   // 10분짜리 Access Token
      String refresh = jwt.createRefresh(email, 7);  // 7일짜리 Refresh Token

      // ✅ 4. HttpOnly Refresh Token 쿠키 설정
      ResponseCookie cookie = ResponseCookie.from("refresh_token", refresh)
          .httpOnly(true)
          .secure(false)       // 로컬 개발 환경은 false (배포 시 true)
          .sameSite("Lax")     // 로컬일 땐 Lax, 도메인 분리 시 None + secure(true)
          .path("/")
          .maxAge(Duration.ofDays(7))
          .build();

      res.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

      // ✅ 5. 응답 데이터 (AccessToken + 사용자 정보)
      Map<String, Object> result = Map.of(
          "accessToken", access,
          "user", Map.of(
              "email", user.getEmail(),
              "name", user.getName(),
              "role", user.getRole().name()
          )
      );

      return ResponseEntity.ok(result);
  }


  @PostMapping("/refresh")
  public ResponseEntity<Map<String,String>> refresh(
      @CookieValue(name="refresh_token", required=false) String refresh) {
    if (refresh == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    try {
      String username = jwt.getSubject(refresh);
      String newAccess = jwt.createAccess(username, 10);
      return ResponseEntity.ok(Map.of("accessToken", newAccess));
    } catch (Exception e) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }
  }

  @PostMapping("/logout")
  public ResponseEntity<Void> logout(HttpServletResponse res) {
    ResponseCookie delete = ResponseCookie.from("refresh_token", "")
        .httpOnly(true).secure(true).sameSite("Lax").path("/").maxAge(0).build();
    res.addHeader(HttpHeaders.SET_COOKIE, delete.toString());
    return ResponseEntity.noContent().build();
  }
}
