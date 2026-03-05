package com.ssafy.ecosim.domain.user.service;

import com.ssafy.ecosim.domain.user.dto.request.UserRegisterRequest;
import com.ssafy.ecosim.domain.user.entity.User;
import com.ssafy.ecosim.domain.user.entity.UserOauth;
import com.ssafy.ecosim.domain.user.repository.UserOauthRepository;
import com.ssafy.ecosim.domain.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;
    private final UserOauthRepository userOauthRepository;

    public UserService(UserRepository userRepository, UserOauthRepository userOauthRepository) {
        this.userRepository = userRepository;
        this.userOauthRepository = userOauthRepository;
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
}
