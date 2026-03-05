package com.ssafy.ecosim.domain.user.controller;

import com.ssafy.ecosim.domain.user.dto.request.UserRegisterRequest;
import com.ssafy.ecosim.domain.user.dto.response.UserProfileDto;
import com.ssafy.ecosim.domain.user.service.UserService;
import com.ssafy.ecosim.global.common.ApiResponse;
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
    public ApiResponse<UserProfileDto> getMyProfile() {
        // TODO: Security 연동 후 실제 로그인 정보 기반으로 변경
        return ApiResponse.success(new UserProfileDto(1L, false));
    }
}
