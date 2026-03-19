package com.ssafy.ecosim.domain.market.controller;

import com.ssafy.ecosim.domain.market.dto.request.UserOrderRequestDto;
import com.ssafy.ecosim.domain.market.service.TradeCollectService;
import com.ssafy.ecosim.domain.market.service.UserOrderService;
import com.ssafy.ecosim.global.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@Tag(name = "주문", description = "매수/매도 주문 생성, 취소, 체결 수령")
@RestController
@RequestMapping("/api/v1/market/orders")
@RequiredArgsConstructor
public class UserOrderController {

    private final UserOrderService userOrderService;
    private final TradeCollectService tradeCollectService;

    @Operation(summary = "주문 생성", description = "매수 또는 매도 주문을 생성합니다. Kafka market.events 토픽으로 이벤트를 발행합니다.")
    @PostMapping
    public ResponseEntity<String> createOrder(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody UserOrderRequestDto request) {

        Long userId = Long.parseLong(userDetails.getUsername());
        userOrderService.createOrder(userId, request);
        return ResponseEntity.ok("주문 접수 이벤트가 발행되었습니다.");
    }

    @Operation(summary = "주문 취소", description = "진행 중인 주문을 취소합니다. Kafka market.events 토픽으로 취소 이벤트를 발행합니다.")
    @DeleteMapping("/{orderId}")
    public ResponseEntity<String> cancelOrder(
            @AuthenticationPrincipal UserDetails userDetails,
            @Parameter(description = "취소할 주문 ID", example = "42") @PathVariable Long orderId) {

        Long userId = Long.parseLong(userDetails.getUsername());
        userOrderService.cancelOrder(userId, orderId);
        return ResponseEntity.ok("주문 취소 이벤트가 발행되었습니다.");
    }

    @Operation(summary = "체결 결과 수령", description = "체결된 거래 결과를 수령합니다. 매수 체결 시 인벤토리에 아이템이 지급되고, 매도 체결 시 회사 잔고에 현금이 입금됩니다.")
    @PostMapping("/{tradeHistoryId}")
    public ResponseEntity<ApiResponse<Void>> collectTrade(
            @AuthenticationPrincipal UserDetails userDetails,
            @Parameter(description = "수령할 체결 내역 ID", example = "7") @PathVariable Long tradeHistoryId) {

        Long userId = Long.parseLong(userDetails.getUsername());
        tradeCollectService.collect(userId, tradeHistoryId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
