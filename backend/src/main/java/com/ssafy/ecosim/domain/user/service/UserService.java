package com.ssafy.ecosim.domain.user.service;

import com.ssafy.ecosim.domain.user.dto.request.LoginRequest;
import com.ssafy.ecosim.domain.user.dto.request.UserRegisterRequest;
import com.ssafy.ecosim.domain.user.dto.response.LoginResponse;
import com.ssafy.ecosim.domain.user.entity.User;
import com.ssafy.ecosim.domain.user.entity.UserOauth;
import com.ssafy.ecosim.domain.user.repository.UserOauthRepository;
import com.ssafy.ecosim.domain.user.repository.UserRepository;
import com.ssafy.ecosim.global.security.JwtTokenProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;
    private final UserOauthRepository userOauthRepository;
    private final JwtTokenProvider tokenProvider;

    public UserService(UserRepository userRepository, UserOauthRepository userOauthRepository,
            JwtTokenProvider tokenProvider) {
        this.userRepository = userRepository;
        this.userOauthRepository = userOauthRepository;
        this.tokenProvider = tokenProvider;
    }

    @Transactional
    public Long createGuestUser() {
        User guest = new User(true); // isGuest = true
        return userRepository.save(guest).getId();
    }

    @Transactional
    public Long registerUser(UserRegisterRequest request) {
        if (userOauthRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("이미 가입된 이메일입니다.");
        }

        User user;
        if (request.getGuestId() != null) {
            user = userRepository.findById(request.getGuestId())
                    .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 게스트입니다."));
            if (!user.getIsGuest()) {
                throw new IllegalArgumentException("이미 정식 회원인 사용자입니다.");
            }
            user.promoteFromGuest();
        } else {
            user = new User(false);
            userRepository.save(user);
        }

        UserOauth userOauth = new UserOauth(
                user,
                request.getProvider(),
                request.getProviderUserId(),
                request.getEmail());
        userOauthRepository.save(userOauth);

        return user.getId();
    }

    public User getUserById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));
    }

    public LoginResponse login(LoginRequest request) {
        UserOauth userOauth = userOauthRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));

        if (!userOauth.getProvider().equals(request.getProvider())) {
            throw new IllegalArgumentException("소셜 로그인 정보가 일치하지 않습니다.");
        }

        User user = userOauth.getUser();
        String accessToken = tokenProvider.createToken(user.getId(), userOauth.getEmail());

        return new LoginResponse(accessToken, user.getId(), user.getIsGuest());
    }
}
