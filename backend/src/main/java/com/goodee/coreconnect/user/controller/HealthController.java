package com.goodee.coreconnect.user.controller;


import org.springframework.web.bind.annotation.*;

import com.goodee.coreconnect.department.dto.response.ApiResponse;

@RestController
@RequestMapping("/api")
public class HealthController {
    @GetMapping("/health")
    public ApiResponse<String> health(){
        return ApiResponse.ok("UP");
    }
}