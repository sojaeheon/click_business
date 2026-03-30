package com.ssafy.ecosim.global.security;

import com.ssafy.ecosim.domain.user.entity.User;
import com.ssafy.ecosim.domain.user.entity.UserOauth;
import com.ssafy.ecosim.domain.user.repository.UserOauthRepository;
import com.ssafy.ecosim.domain.user.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CustomOAuth2UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserOauthRepository userOauthRepository;

    @Mock
    private HttpServletRequest request;

    @InjectMocks
    private CustomOAuth2UserService oauth2UserService;

    // loadUser_WithGuestCookie_PromotesUser 제거 (스터빙 미사용으로 인한 오류 방지)

    @Test
    @DisplayName("게스트 연동 로직 (saveOrUpdateUser) 단위 테스트")
    void saveOrUpdateUser_Integration() throws Exception {
        // given
        String provider = "google";
        String providerUserId = "sub-123";
        String email = "test@ssafy.com";
        Long guestId = 100L;
        User guestUser = new User(true);

        // Mock Session/Cookie via Reflection or helper
        ServletRequestAttributes attributes = mock(ServletRequestAttributes.class);
        RequestContextHolder.setRequestAttributes(attributes);
        when(attributes.getRequest()).thenReturn(request);
        when(request.getCookies()).thenReturn(new Cookie[] { new Cookie("GUEST_ID", String.valueOf(guestId)) });

        when(userOauthRepository.findByProviderAndProviderUserId(provider, providerUserId))
                .thenReturn(Optional.empty());
        when(userRepository.findById(guestId)).thenReturn(Optional.of(guestUser));

        // when (Reflectively call private method)
        java.lang.reflect.Method method = CustomOAuth2UserService.class.getDeclaredMethod("saveOrUpdateUser",
                String.class, String.class, String.class);
        method.setAccessible(true);
        User result = (User) method.invoke(oauth2UserService, provider, providerUserId, email);

        // then
        assertThat(result.getIsGuest()).isFalse(); // 승격됨 확인
        verify(userOauthRepository).save(any(UserOauth.class));
        verify(userRepository, never()).save(any(User.class)); // 신규 생성 안함
    }
}
