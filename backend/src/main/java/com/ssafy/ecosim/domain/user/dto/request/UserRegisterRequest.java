package com.ssafy.ecosim.domain.user.dto.request;

public class UserRegisterRequest {
    private String provider;
    private String providerUserId;
    private String email;
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

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getProviderUserId() {
        return providerUserId;
    }

    public void setProviderUserId(String providerUserId) {
        this.providerUserId = providerUserId;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public Long getGuestId() {
        return guestId;
    }

    public void setGuestId(Long guestId) {
        this.guestId = guestId;
    }
}
