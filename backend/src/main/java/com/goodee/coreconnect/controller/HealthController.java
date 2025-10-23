package com.goodee.coreconnect.controller;


import org.springframework.web.bind.annotation.*;
import com.goodee.coreconnect.common.ApiResponse;

@RestController
@RequestMapping("/api")
public class HealthController {
    @GetMapping("/health")
    public ApiResponse<String> health(){
        return ApiResponse.ok("UP");
    }
}