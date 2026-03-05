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
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.Cookie;

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

        return new PrincipalDetails(user, attributes);
    }

    private User saveOrUpdateUser(String provider, String providerUserId, String email) {
        // 1. 이미 가입된 OAuth 정보가 있는지 확인
        return userOauthRepository.findByProviderAndProviderUserId(provider, providerUserId)
                .map(UserOauth::getUser)
                .orElseGet(() -> {
                    // 2. 가입된 정보가 없다면, 현재 요청 쿠키에 게스트 ID가 있는지 확인 (연동 처리)
                    Long guestId = getGuestIdFromCookie();
                    User user;

                    if (guestId != null) {
                        user = userRepository.findById(guestId)
                                .orElseGet(() -> createNewUser());
                        if (user.getIsGuest()) {
                            user.promoteFromGuest(); // 게스트에서 일반 유저로 승격
                        }
                    } else {
                        user = createNewUser();
                    }

                    UserOauth oauth = new UserOauth(user, provider, providerUserId, email);
                    userOauthRepository.save(oauth);
                    return user;
                });
    }

    private User createNewUser() {
        User newUser = new User(false);
        return userRepository.save(newUser);
    }

    private Long getGuestIdFromCookie() {
        try {
            HttpServletRequest request = ((ServletRequestAttributes) RequestContextHolder.currentRequestAttributes())
                    .getRequest();

            if (request.getCookies() != null) {
                for (jakarta.servlet.http.Cookie cookie : request.getCookies()) {
                    if ("GUEST_ID".equals(cookie.getName())) {
                        return Long.parseLong(cookie.getValue());
                    }
                }
            }
        } catch (Exception e) {
            // 쿠키 접근 또는 파싱 실패 시 무시
        }
        return null;
    }
}
