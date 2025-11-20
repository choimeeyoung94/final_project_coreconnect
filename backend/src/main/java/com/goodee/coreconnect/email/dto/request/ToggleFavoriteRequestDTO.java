package com.goodee.coreconnect.email.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Schema(description = "메일 중요 표시 토글 요청 DTO")
public class ToggleFavoriteRequestDTO {

    @Schema(description = "사용자 이메일", example = "user@example.com")
    private String userEmail;
}
