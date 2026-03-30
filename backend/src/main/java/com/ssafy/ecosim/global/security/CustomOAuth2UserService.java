package com.ssafy.ecosim.global.security;

import com.ssafy.ecosim.domain.user.entity.User;
import com.ssafy.ecosim.domain.user.entity.UserOauth;
import com.ssafy.ecosim.domain.user.repository.UserOauthRepository;
import com.ssafy.ecosim.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
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
        Long guestId = getGuestIdFromCookie();
        var existingOauth = userOauthRepository.findByProviderAndProviderUserId(provider, providerUserId);

        if (existingOauth.isPresent()) {
            // 이미 가입된 OAuth 계정이 존재
            if (guestId != null) {
                // 게스트 연동 시도인데 이미 가입된 계정 → 충돌
                // 프론트에서 confirm=true 파라미터로 재시도하면 기존 계정으로 로그인
                HttpServletRequest request = ((ServletRequestAttributes) RequestContextHolder.currentRequestAttributes())
                        .getRequest();
                String confirm = null;
                if (request.getCookies() != null) {
                    for (Cookie cookie : request.getCookies()) {
                        if ("GUEST_LINK_CONFIRM".equals(cookie.getName())) {
                            confirm = cookie.getValue();
                        }
                    }
                }
                if (!"true".equals(confirm)) {
                    throw new OAuth2AuthenticationException(new OAuth2Error("GUEST_CONFLICT", "이미 가입된 계정입니다", null));
                }
            }
            return existingOauth.get().getUser();
        }

        // 새 OAuth 연동
        User user;
        if (guestId != null) {
            user = userRepository.findById(guestId)
                    .orElseGet(this::createNewUser);
            if (user.getIsGuest()) {
                user.promoteFromGuest();
            }
        } else {
            user = createNewUser();
        }

        UserOauth oauth = new UserOauth(user, provider, providerUserId, email);
        userOauthRepository.save(oauth);
        return user;
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
                System.out.println("[CustomOAuth2UserService] Cookies present: " + request.getCookies().length);
                for (jakarta.servlet.http.Cookie cookie : request.getCookies()) {
                    System.out.println("[CustomOAuth2UserService] Cookie: " + cookie.getName() + " = " + cookie.getValue());
                    if ("GUEST_ID".equals(cookie.getName())) {
                        Long guestId = Long.parseLong(cookie.getValue());
                        System.out.println("[CustomOAuth2UserService] Found GUEST_ID: " + guestId);
                        return guestId;
                    }
                }
            } else {
                System.out.println("[CustomOAuth2UserService] No cookies in request!");
            }
        } catch (Exception e) {
            System.out.println("[CustomOAuth2UserService] Error reading cookie: " + e.getMessage());
        }
        return null;
    }
}
