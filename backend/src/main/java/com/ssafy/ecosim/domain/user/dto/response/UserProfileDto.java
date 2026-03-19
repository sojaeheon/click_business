package com.ssafy.ecosim.domain.user.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "유저 프로필 응답")
public class UserProfileDto {

    @Schema(description = "유저 ID", example = "1")
    private Long id;

    @Schema(description = "게스트 여부", example = "false")
    private Boolean isGuest;

    public UserProfileDto(Long id, Boolean isGuest) {
        this.id = id;
        this.isGuest = isGuest;
    }

    public Long getId() { return id; }
    public Boolean getIsGuest() { return isGuest; }
}
