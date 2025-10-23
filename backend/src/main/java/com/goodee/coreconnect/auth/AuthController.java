package com.goodee.coreconnect.auth;

import lombok.Data;
import org.springframework.web.bind.annotation.*;
import com.goodee.coreconnect.common.ApiResponse;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @PostMapping("/login")
    public ApiResponse<AuthResult> login(@RequestBody LoginRequest req) {
        // TODO: 실제로는 UserRepository 조회 + password matches + JWT 발급
        // 지금은 더미 데이터 반환
        return ApiResponse.ok(new AuthResult("dummy-access-token", "dummy-refresh-token", "USER"));
    }

    @Data
    public static class LoginRequest {
        private String email;
        private String password;
    }

    @Data
    public static class AuthResult {
        private final String accessToken;
        private final String refreshToken;
        private final String role;
    }
}