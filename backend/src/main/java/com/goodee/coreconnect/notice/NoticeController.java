package com.goodee.coreconnect.notice;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import com.goodee.coreconnect.common.ApiResponse;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/notices")
@RequiredArgsConstructor
public class NoticeController {
    private final NoticeRepository repo;

    @GetMapping
    public ApiResponse<List<Notice>> list() {
        return ApiResponse.ok(repo.findAll());
    }

    @PostMapping
    public ApiResponse<Notice> create(@RequestBody Notice n) {
        n.setCreatedAt(LocalDateTime.now());
        return ApiResponse.ok(repo.save(n));
    }
}
