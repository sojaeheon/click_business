package com.ssafy.ecosim.domain.market.controller;

import com.ssafy.ecosim.domain.market.dto.request.UserOrderRequestDto;
import com.ssafy.ecosim.domain.market.service.TradeCollectService;
import com.ssafy.ecosim.domain.market.service.UserOrderService;
import com.ssafy.ecosim.global.common.ApiResponse;
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
    private final TradeCollectService tradeCollectService;

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

    /**
     * 체결 결과 수령
     * POST /api/v1/market/orders/{tradeHistoryId}
     * - 매수 체결: 인벤토리에 아이템 지급
     * - 매도 체결: 회사 잔고에 현금 입금
     */
    @PostMapping("/{tradeHistoryId}")
    public ResponseEntity<ApiResponse<Void>> collectTrade(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long tradeHistoryId) {

        Long userId = Long.parseLong(userDetails.getUsername());
        tradeCollectService.collect(userId, tradeHistoryId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
