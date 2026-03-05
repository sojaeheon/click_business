package com.ssafy.ecosim.domain.user.repository;

import com.ssafy.ecosim.domain.user.entity.UserOauth;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserOauthRepository extends JpaRepository<UserOauth, Long> {
    Optional<UserOauth> findByProviderAndProviderUserId(String provider, String providerUserId);

    boolean existsByEmail(String email);
}
