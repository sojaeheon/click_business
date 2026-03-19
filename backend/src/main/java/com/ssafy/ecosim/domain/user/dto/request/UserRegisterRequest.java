package com.ssafy.ecosim.domain.user.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "회원가입 요청")
public class UserRegisterRequest {

    @Schema(description = "OAuth 제공자 (google, kakao 등)", example = "google")
    @NotBlank(message = "인증 제공자는 필수입니다.")
    private String provider;

    @Schema(description = "OAuth 제공자에서 발급한 유저 ID", example = "1234567890")
    @NotBlank(message = "인증 제공자 유저 ID는 필수입니다.")
    private String providerUserId;

    @Schema(description = "이메일 주소", example = "user@example.com")
    @NotBlank(message = "이메일은 필수입니다.")
    @Email(message = "유효한 이메일 형식이 아닙니다.")
    private String email;

    @Schema(description = "게스트에서 정식 전환 시 기존 게스트 ID (선택)", example = "42")
    private Long guestId;

    public UserRegisterRequest() {
    }

    public UserRegisterRequest(String provider, String providerUserId, String email) {
        this(provider, providerUserId, email, null);
    }

    public UserRegisterRequest(String provider, String providerUserId, String email, Long guestId) {
        this.provider = provider;
        this.providerUserId = providerUserId;
        this.email = email;
        this.guestId = guestId;
    }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }

    public String getProviderUserId() { return providerUserId; }
    public void setProviderUserId(String providerUserId) { this.providerUserId = providerUserId; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public Long getGuestId() { return guestId; }
    public void setGuestId(Long guestId) { this.guestId = guestId; }
}
