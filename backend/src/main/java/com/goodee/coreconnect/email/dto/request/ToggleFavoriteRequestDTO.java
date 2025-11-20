package com.goodee.coreconnect.email.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Schema(description = "즐겨찾기 토글 요청 DTO")
public class ToggleFavoriteRequestDTO {

    @Schema(description = "사용자 이메일", example = "user@example.com")
    private String userEmail;
    
    @Schema(description = "즐겨찾기 상태", example = "true")
    private Boolean favoriteStatus;
}
