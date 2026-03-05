package com.ssafy.ecosim.domain.user.dto.response;

public class LoginResponse {
    private String accessToken;
    private Long userId;
    private Boolean isGuest;

    public LoginResponse() {
    }

    public LoginResponse(String accessToken, Long userId, Boolean isGuest) {
        this.accessToken = accessToken;
        this.userId = userId;
        this.isGuest = isGuest;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Boolean getIsGuest() {
        return isGuest;
    }

    public void setIsGuest(Boolean isGuest) {
        this.isGuest = isGuest;
    }
}
