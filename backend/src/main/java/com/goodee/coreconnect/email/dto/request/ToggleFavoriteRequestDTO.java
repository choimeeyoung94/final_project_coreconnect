package com.goodee.coreconnect.email.dto.request;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ToggleFavoriteRequestDTO {
    private Integer emailId;
    private Boolean favoriteStatus;
    private String userEmail;
}
