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

    /**
     * 주문 생성 - market.events 토픽으로 발행
     */
    @PostMapping
    public ResponseEntity<String> createOrder(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody UserOrderRequestDto request) {

        Long userId = Long.parseLong(userDetails.getUsername());
        userOrderService.createOrder(userId, request);
        return ResponseEntity.ok("주문 접수 이벤트가 발행되었습니다.");
    }

    /**
     * 주문 취소 - market.events 토픽으로 발행
     */
    @DeleteMapping("/{orderId}")
    public ResponseEntity<String> cancelOrder(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long orderId) {

        Long userId = Long.parseLong(userDetails.getUsername());
        userOrderService.cancelOrder(userId, orderId);
        return ResponseEntity.ok("주문 취소 이벤트가 발행되었습니다.");
    }
}
