package com.ssafy.ecosim.domain.user.dto.response;

public class UserProfileDto {
    private Long id;
    private String nickname;
    private Boolean isGuest;

    public UserProfileDto(Long id, String nickname, Boolean isGuest) {
        this.id = id;
        this.nickname = nickname;
        this.isGuest = isGuest;
    }

    public Long getId() {
        return id;
    }

    public String getNickname() {
        return nickname;
    }

    public Boolean getIsGuest() {
        return isGuest;
    }
}
