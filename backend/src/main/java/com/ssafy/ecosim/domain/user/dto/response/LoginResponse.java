package com.ssafy.ecosim.domain.user.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "로그인/회원가입 응답")
public class LoginResponse {

    @Schema(description = "JWT 액세스 토큰", example = "eyJhbGciOiJIUzI1NiJ9...")
    private String accessToken;

    @Schema(description = "유저 ID", example = "1")
    private Long userId;

    @Schema(description = "게스트 여부", example = "false")
    private Boolean isGuest;

    public LoginResponse() {
    }

    public LoginResponse(String accessToken, Long userId, Boolean isGuest) {
        this.accessToken = accessToken;
        this.userId = userId;
        this.isGuest = isGuest;
    }

    public String getAccessToken() { return accessToken; }
    public void setAccessToken(String accessToken) { this.accessToken = accessToken; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public Boolean getIsGuest() { return isGuest; }
    public void setIsGuest(Boolean isGuest) { this.isGuest = isGuest; }
}
