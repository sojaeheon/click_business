package com.ssafy.ecosim.global.security;

import com.ssafy.ecosim.domain.user.entity.User;
import com.ssafy.ecosim.domain.user.entity.UserOauth;
import com.ssafy.ecosim.domain.user.repository.UserOauthRepository;
import com.ssafy.ecosim.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final UserRepository userRepository;
    private final UserOauthRepository userOauthRepository;

    @Override
    @Transactional
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oAuth2User = super.loadUser(userRequest);

        String provider = userRequest.getClientRegistration().getRegistrationId(); // google, kakao 등
        Map<String, Object> attributes = oAuth2User.getAttributes();

        // 제공처별로 정보 추출 방식이 다를 수 있음 (여기선 구글 기준 예시)
        String providerUserId = (String) attributes.get("sub");
        String email = (String) attributes.get("email");

        // 유저 정보 저장 또는 업데이트 로직
        User user = saveOrUpdateUser(provider, providerUserId, email);

        return new DefaultOAuth2User(
                Collections.emptyList(),
                attributes,
                userRequest.getClientRegistration().getProviderDetails().getUserInfoEndpoint()
                        .getUserNameAttributeName());
    }

    private User saveOrUpdateUser(String provider, String providerUserId, String email) {
        return userOauthRepository.findByProviderAndProviderUserId(provider, providerUserId)
                .map(UserOauth::getUser)
                .orElseGet(() -> {
                    User newUser = new User(false);
                    userRepository.save(newUser);

                    UserOauth oauth = new UserOauth(newUser, provider, providerUserId, email);
                    userOauthRepository.save(oauth);
                    return newUser;
                });
    }
}
