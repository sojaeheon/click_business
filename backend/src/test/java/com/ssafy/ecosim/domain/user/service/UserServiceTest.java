package com.ssafy.ecosim.domain.user.service;

import com.ssafy.ecosim.domain.user.dto.request.UserRegisterRequest;
import com.ssafy.ecosim.domain.user.entity.User;
import com.ssafy.ecosim.domain.user.entity.UserOauth;
import com.ssafy.ecosim.domain.user.repository.UserOauthRepository;
import com.ssafy.ecosim.domain.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserOauthRepository userOauthRepository;

    @InjectMocks
    private UserService userService;

    @Test
    @DisplayName("게스트 유저 생성 테스트")
    void createGuestUser_Success() {
        // given
        User guestUser = new User(true);
        when(userRepository.save(any(User.class))).thenReturn(guestUser);

        // when
        userService.createGuestUser();

        // then
        verify(userRepository, times(1)).save(any(User.class));
    }

    @Test
    @DisplayName("회원가입 성공 테스트 (신규 유저)")
    void registerUser_NewUser_Success() {
        // given
        UserRegisterRequest request = new UserRegisterRequest("google", "sub-123", "test@ssafy.com");
        when(userOauthRepository.existsByEmail(anyString())).thenReturn(false);

        // when
        Long userId = userService.registerUser(request);

        // then
        verify(userRepository, times(1)).save(any(User.class));
        verify(userOauthRepository, times(1)).save(any(UserOauth.class));
    }

    @Test
    @DisplayName("회원가입 성공 테스트 (게스트 전환)")
    void registerUser_GuestConversion_Success() {
        // given
        Long guestId = 1L;
        UserRegisterRequest request = new UserRegisterRequest("google", "sub-123", "test@ssafy.com", guestId);
        User guestUser = new User(true);

        when(userOauthRepository.existsByEmail(anyString())).thenReturn(false);
        when(userRepository.findById(guestId)).thenReturn(java.util.Optional.of(guestUser));

        // when
        userService.registerUser(request);

        // then
        assertThat(guestUser.getIsGuest()).isFalse();
        verify(userOauthRepository, times(1)).save(any(UserOauth.class));
        verify(userRepository, never()).save(any(User.class)); // 신규 저장이 아닌 기존 유저 사용
    }

    @Test
    @DisplayName("이미 가입된 이메일로 가입 시도 시 예외 발생 테스트")
    void registerUser_AlreadyExists_ThrowsException() {
        // given
        UserRegisterRequest request = new UserRegisterRequest("google", "sub-123", "test@ssafy.com");
        when(userOauthRepository.existsByEmail(request.getEmail())).thenReturn(true);

        // when & then
        assertThatThrownBy(() -> userService.registerUser(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("이미 가입된 이메일입니다.");

        verify(userRepository, never()).save(any(User.class));
        verify(userOauthRepository, never()).save(any(UserOauth.class));
    }
}
