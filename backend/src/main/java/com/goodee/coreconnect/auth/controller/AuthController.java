package com.goodee.coreconnect.auth.controller;

import java.time.Duration;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.goodee.coreconnect.account.enums.LogActionType;
import com.goodee.coreconnect.account.service.AccountLogService;
import com.goodee.coreconnect.account.util.IpAddressUtil;
import com.goodee.coreconnect.auth.constants.JwtConstants;
import com.goodee.coreconnect.auth.dto.request.LoginRequestDTO;
import com.goodee.coreconnect.auth.dto.response.LoginResponseDTO;
import com.goodee.coreconnect.security.jwt.JwtProvider;
import com.goodee.coreconnect.security.userdetails.CustomUserDetails;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 로그인, 로그아웃 로직을 수행하는 컨트롤러
 */

/** 이메일/비밀번호를 검증하고 Access Token + Refresh Token을 발급 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Auth API", description = "로그인/토큰재발급/로그아웃 API")
@Slf4j
public class AuthController {
  private final JwtProvider jwt;
  private final UserRepository userRepository;  
  private final PasswordEncoder passwordEncoder;
  private final AccountLogService accountLogService;
  
  @Value("${app.cookie.secure:false}")
  private boolean cookieSecure;
  
  @Value("${app.cookie.same-site:Lax}")
  private String cookieSameSite;

  @Operation(summary = "로그인", 
             description = "이메일/비밀번호로 로그인하여 Access Token과 Refresh Token을 HttpOnly 쿠키로 발급합니다.")
  @PostMapping("/login")
  public ResponseEntity<LoginResponseDTO> login(
      @Valid @RequestBody LoginRequestDTO req,
      HttpServletRequest request,
      HttpServletResponse res) {

      // 요청값 받기
      String email = req.email();
      String password = req.password();
      
      // IPv4와 IPv6 분리 추출
      IpAddressUtil.IpAddressPair ipPair = IpAddressUtil.getClientIpAddressPair(request);
      
      // 이메일로 사용자 조회
      User user = userRepository.findByEmail(email).orElse(null);
      if (user == null) { 
        // 로그인 실패 이력 저장 (사용자가 존재하지 않음)
        accountLogService.saveLoginFailLog(email, ipPair.getIpv4(), ipPair.getIpv6());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build(); 
      }
      // 비밀번호 비교 (BCrypt)
      if (!passwordEncoder.matches(password, user.getPassword())) {
        // 로그인 실패 이력 저장 (비밀번호 오류)
        accountLogService.saveLoginFailLog(email, ipPair.getIpv4(), ipPair.getIpv6());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
      }

      // 사용자 Role 추출
      Role role = user.getRole();

      // 토큰 생성
      String access = jwt.createAccess(email, role, JwtConstants.ACCESS_TOKEN_MINUTES);   
      String refresh = jwt.createRefresh(email, role, JwtConstants.REFRESH_TOKEN_DAYS);        
        
      // Access Token 쿠키 (HttpOnly)
      ResponseCookie accessCookie = ResponseCookie.from("access_token", access)
          .httpOnly(true)
          .secure(cookieSecure) // 환경 변수로 설정 (배포 환경: true, 로컬: false)
          .sameSite(cookieSameSite)
          .path("/")
          .maxAge(Duration.ofMinutes(JwtConstants.ACCESS_TOKEN_MINUTES))
          .build();
      
      // Refresh Token 쿠키 (HttpOnly)
      ResponseCookie refreshCookie = ResponseCookie.from("refresh_token", refresh)
          .httpOnly(true)
          .secure(cookieSecure) // 환경 변수로 설정 (배포 환경: true, 로컬: false)
          .sameSite(cookieSameSite)
          .path("/")
          .maxAge(Duration.ofDays(JwtConstants.REFRESH_TOKEN_DAYS))
          .build();

      res.addHeader(HttpHeaders.SET_COOKIE, accessCookie.toString());
      res.addHeader(HttpHeaders.SET_COOKIE, refreshCookie.toString());

      // 로그인 성공 이력 저장
      accountLogService.saveLog(user, LogActionType.LOGIN, ipPair.getIpv4(), ipPair.getIpv6());

      // 응답 데이터 (사용자 정보)
      LoginResponseDTO response = new LoginResponseDTO(
          user.getEmail(),
          user.getName(),
          user.getRole().name(),
          user.getDepartment() != null ? user.getDepartment().getDeptName() : null,
          user.getJobGrade() != null ? user.getJobGrade().name() : null
      );
      
      return ResponseEntity.ok(response);
  }

  
  /** 쿠키의 Refresh Token을 검증하여 새로운 Access Token을 재발급 */
  @Operation(summary = "Refresh Token", description = "만료된 Access Token을 Refresh Token(쿠키)로 재발급합니다.")
  @PostMapping("/refresh")
  public ResponseEntity<Void> refresh(
      @CookieValue(name = "refresh_token", required = false) String refresh,
      HttpServletRequest request,
      HttpServletResponse res
  ) {
    if (refresh == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }
    try {
      String email = jwt.getSubject(refresh);
      Role role = Role.valueOf(jwt.getRole(refresh));
      String newAccess = jwt.createAccess(email, role, JwtConstants.ACCESS_TOKEN_MINUTES);
      
      // 새 Access Token 쿠키 재발급
      ResponseCookie newAccessCookie = ResponseCookie.from("access_token", newAccess)
          .httpOnly(true)
          .secure(cookieSecure) // 환경 변수로 설정 (배포 환경: true, 로컬: false)
          .sameSite(cookieSameSite)
          .path("/")
          .maxAge(Duration.ofMinutes(JwtConstants.ACCESS_TOKEN_MINUTES))
          .build();
      res.addHeader(HttpHeaders.SET_COOKIE, newAccessCookie.toString());
      
      // 토큰 재발급 이력 저장
      User user = userRepository.findByEmail(email).orElse(null);
      if (user != null) {
        IpAddressUtil.IpAddressPair ipPair = IpAddressUtil.getClientIpAddressPair(request);
        accountLogService.saveLog(user, LogActionType.REFRESH, ipPair.getIpv4(), ipPair.getIpv6());
      }
      
      return ResponseEntity.noContent().build();
    } catch (Exception e) {
      e.printStackTrace();
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }
  }

  
  /** Access Token + Refresh Token 쿠키를 삭제하여 로그아웃 처리 */
  @Operation(summary = "로그아웃", description = "Access/Refresh Token 쿠키를 제거하고 로그아웃 기능을 수행합니다.")
  @PostMapping("/logout")
  public ResponseEntity<Void> logout(
      @AuthenticationPrincipal CustomUserDetails userDetails,
      HttpServletRequest request,
      HttpServletResponse res) {
    // access_token 삭제 쿠키
    ResponseCookie deleteAccess = ResponseCookie.from("access_token", "")
        .httpOnly(true)
        .secure(cookieSecure) // 환경 변수로 설정 (배포 환경: true, 로컬: false)
        .sameSite(cookieSameSite)
        .path("/")
        .maxAge(0)
        .build();
    res.addHeader(HttpHeaders.SET_COOKIE, deleteAccess.toString());

    // refresh_token 삭제 쿠키
    ResponseCookie deleteRefresh = ResponseCookie.from("refresh_token", "")
        .httpOnly(true)
        .secure(cookieSecure) // 환경 변수로 설정 (배포 환경: true, 로컬: false)
        .sameSite(cookieSameSite)
        .path("/")
        .maxAge(0)
        .build();
    res.addHeader(HttpHeaders.SET_COOKIE, deleteRefresh.toString());

    // 로그아웃 이력 저장
    if (userDetails != null) {
      User user = userRepository.findByEmail(userDetails.getEmail()).orElse(null);
      if (user != null) {
        IpAddressUtil.IpAddressPair ipPair = IpAddressUtil.getClientIpAddressPair(request);
        accountLogService.saveLog(user, LogActionType.LOGOUT, ipPair.getIpv4(), ipPair.getIpv6());
      }
    }

    return ResponseEntity.noContent().build();
  }
}