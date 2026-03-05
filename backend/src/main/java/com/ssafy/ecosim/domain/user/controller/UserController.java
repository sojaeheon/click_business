package com.ssafy.ecosim.domain.user.controller;

import com.ssafy.ecosim.domain.user.dto.request.UserRegisterRequest;
import com.ssafy.ecosim.domain.user.dto.response.UserProfileDto;
import com.ssafy.ecosim.domain.user.entity.User;
import com.ssafy.ecosim.domain.user.service.UserService;
import com.ssafy.ecosim.global.common.ApiResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/signup")
    public ApiResponse<Long> register(@RequestBody UserRegisterRequest request) {
        Long userId = userService.registerUser(request);
        return ApiResponse.success(userId);
    }

    @GetMapping("/me")
    public ApiResponse<UserProfileDto> getMyProfile(@AuthenticationPrincipal UserDetails userDetails) {
        // JwtTokenProvider에서 subject로 넣어준 userId를 꺼냅니다.
        Long userId = Long.parseLong(userDetails.getUsername());
        User user = userService.getUserById(userId);
        return ApiResponse.success(new UserProfileDto(user.getId(), user.getIsGuest()));
    }
}
