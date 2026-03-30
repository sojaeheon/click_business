package com.ssafy.ecosim.domain.user.entity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class UserTest {

    @Test
    @DisplayName("사용자 엔티티 생성 테스트")
    void createUser() {
        // given
        Boolean isGuest = false;

        // when
        User user = new User(isGuest);

        // then
        assertThat(user.getIsGuest()).isFalse();
    }

    @Test
    @DisplayName("소셜 연동 엔티티 생성 테스트")
    void createUserOauth() {
        // given
        User user = new User(false);
        String provider = "google";
        String providerUserId = "123456789";
        String email = "test@ssafy.com";

        // when
        UserOauth userOauth = new UserOauth(user, provider, providerUserId, email);

        // then
        assertThat(userOauth.getUser()).isEqualTo(user);
        assertThat(userOauth.getProvider()).isEqualTo(provider);
        assertThat(userOauth.getProviderUserId()).isEqualTo(providerUserId);
        assertThat(userOauth.getEmail()).isEqualTo(email);
    }
}
