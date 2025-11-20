package com.goodee.coreconnect.email.dto.request;

public class ToggleFavoriteRequestDTO {
    private Long emailId;
    private Boolean favoriteStatus;
    private String userEmail;

    public ToggleFavoriteRequestDTO() {}
    public ToggleFavoriteRequestDTO(Long emailId, Boolean favoriteStatus, String userEmail) {
        this.emailId = emailId;
        this.favoriteStatus = favoriteStatus;
        this.userEmail = userEmail;
    }

    public Long getEmailId() { return emailId; }
    public void setEmailId(Long emailId) { this.emailId = emailId; }
    
    public Boolean getFavoriteStatus() { return favoriteStatus; }
    public void setFavoriteStatus(Boolean favoriteStatus) { this.favoriteStatus = favoriteStatus; }
    
    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }
}
