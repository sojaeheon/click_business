package com.ssafy.ecosim.domain.user.controller;

import com.ssafy.ecosim.domain.user.dto.request.LoginRequest;
import com.ssafy.ecosim.domain.user.dto.request.UserRegisterRequest;
import com.ssafy.ecosim.domain.user.dto.response.LoginResponse;
import com.ssafy.ecosim.domain.user.dto.response.UserProfileDto;
import com.ssafy.ecosim.domain.user.entity.User;
import com.ssafy.ecosim.domain.user.service.UserService;
import com.ssafy.ecosim.global.common.ApiResponse;
import com.ssafy.ecosim.global.security.JwtTokenProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@Tag(name = "유저", description = "회원가입, 로그인, 프로필 조회")
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;
    private final JwtTokenProvider tokenProvider;

    public UserController(UserService userService, JwtTokenProvider tokenProvider) {
        this.userService = userService;
        this.tokenProvider = tokenProvider;
    }

    @Operation(summary = "일반 회원가입", description = "OAuth 제공자 정보로 회원가입하고 JWT를 반환합니다.")
    @PostMapping("/signup")
    public ApiResponse<LoginResponse> register(@Valid @RequestBody UserRegisterRequest request) {
        Long userId = userService.registerUser(request);
        String token = tokenProvider.createToken(userId, request.getEmail());
        return ApiResponse.success(new LoginResponse(token, userId, false));
    }

    @Operation(summary = "로그인", description = "이메일과 OAuth 제공자로 로그인하고 JWT를 반환합니다.")
    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.success(userService.login(request));
    }

    @Operation(summary = "게스트 로그인", description = "임시 게스트 계정을 생성하고 JWT를 반환합니다.")
    @PostMapping("/guest")
    public ApiResponse<LoginResponse> createGuest() {
        Long guestId = userService.createGuestUser();
        String token = tokenProvider.createToken(guestId, "guest_" + guestId + "@ecosim.com");
        return ApiResponse.success(new LoginResponse(token, guestId, true));
    }

    @Operation(summary = "내 프로필 조회", description = "JWT 토큰으로 현재 로그인한 유저의 ID와 게스트 여부를 반환합니다.")
    @GetMapping("/me")
    public ApiResponse<UserProfileDto> getMyProfile(@AuthenticationPrincipal UserDetails userDetails) {
        Long userId = Long.parseLong(userDetails.getUsername());
        User user = userService.getUserById(userId);
        return ApiResponse.success(new UserProfileDto(user.getId(), user.getIsGuest()));
    }
}
