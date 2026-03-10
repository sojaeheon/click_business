package com.ssafy.ecosim.domain.user.controller;

import com.ssafy.ecosim.domain.user.dto.request.LoginRequest;
import com.ssafy.ecosim.domain.user.dto.request.UserRegisterRequest;
import com.ssafy.ecosim.domain.user.dto.response.LoginResponse;
import com.ssafy.ecosim.domain.user.dto.response.UserProfileDto;
import com.ssafy.ecosim.domain.user.entity.User;
import com.ssafy.ecosim.domain.user.service.UserService;
import com.ssafy.ecosim.global.common.ApiResponse;
import com.ssafy.ecosim.global.security.JwtTokenProvider;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;
    private final JwtTokenProvider tokenProvider;

    public UserController(UserService userService, JwtTokenProvider tokenProvider) {
        this.userService = userService;
        this.tokenProvider = tokenProvider;
    }

    @PostMapping("/signup")
    public ApiResponse<LoginResponse> register(@Valid @RequestBody UserRegisterRequest request) {
        Long userId = userService.registerUser(request);
        String token = tokenProvider.createToken(userId, request.getEmail());
        return ApiResponse.success(new LoginResponse(token, userId, false));
    }

    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.success(userService.login(request));
    }

    @PostMapping("/guest")
    public ApiResponse<LoginResponse> createGuest() {
        Long guestId = userService.createGuestUser();
        String token = tokenProvider.createToken(guestId, "guest_" + guestId + "@ecosim.com");
        return ApiResponse.success(new LoginResponse(token, guestId, true));
    }

    @GetMapping("/me")
    public ApiResponse<UserProfileDto> getMyProfile(@AuthenticationPrincipal UserDetails userDetails) {
        // JwtTokenProvider에서 subject로 넣어준 userId를 꺼냅니다.
        Long userId = Long.parseLong(userDetails.getUsername());
        User user = userService.getUserById(userId);
        return ApiResponse.success(new UserProfileDto(user.getId(), user.getIsGuest()));
    }
}
