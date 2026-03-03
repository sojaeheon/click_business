package com.ssafy.ecosim.domain.user.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.ecosim.global.common.ApiResponse;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    @GetMapping("/me")
    public ApiResponse<String> getMyProfile() {
        // TODO: Replace with actual user profile logic
        return ApiResponse.success("Hello from EcoSim User Domain!");
    }
}
