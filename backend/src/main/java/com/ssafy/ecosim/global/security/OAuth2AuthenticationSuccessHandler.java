package com.ssafy.ecosim.global.security;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class OAuth2AuthenticationSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final JwtTokenProvider tokenProvider;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
            Authentication authentication) throws IOException, ServletException {
        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();
        Map<String, Object> attributes = oAuth2User.getAttributes();

        // 실제 운영시는 DBId 등을 TokenProvider에 넘겨야 함
        // 지금은 예외 처리를 위해 email 정보 등을 활용
        String email = (String) attributes.get("email");

        // TODO: 실제 유저 ID를 TokenProvider에 넘기는 로직 보완 필요
        // (현재 CustomOAuth2UserService에서 추출한 유저 정보를 principal에 담아 보내는 과정을 추가해야 함)
        String token = tokenProvider.createToken(1L, email); // 임시 ID 1L 사용

        String targetUrl = UriComponentsBuilder.fromUriString("/login/success")
                .queryParam("token", token)
                .build().toUriString();

        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }
}
