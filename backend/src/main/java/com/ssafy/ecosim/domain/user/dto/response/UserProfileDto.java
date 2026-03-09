package com.ssafy.ecosim.domain.user.dto.response;

public class UserProfileDto {
    private Long id;
    private Boolean isGuest;

    public UserProfileDto(Long id, Boolean isGuest) {
        this.id = id;
        this.isGuest = isGuest;
    }

    public Long getId() {
        return id;
    }

    public Boolean getIsGuest() {
        return isGuest;
    }
}
