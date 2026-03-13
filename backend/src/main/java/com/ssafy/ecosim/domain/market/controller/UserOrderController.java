package com.ssafy.ecosim.domain.market.controller;

import com.ssafy.ecosim.domain.market.dto.request.UserOrderRequestDto;
import com.ssafy.ecosim.domain.market.service.UserOrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/market/orders")
@RequiredArgsConstructor
public class UserOrderController {

    private final UserOrderService userOrderService;

    @PostMapping
    public ResponseEntity<String> createOrder(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody UserOrderRequestDto request) {

        // JwtTokenProvider가 subject(= userId)로 심어준 값을 꺼냄
        Long userId = Long.parseLong(userDetails.getUsername());

        userOrderService.createOrder(userId, request);

        return ResponseEntity.ok("주문 접수 이벤트가 발행되었습니다.");
    }
}
