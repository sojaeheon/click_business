package com.ssafy.ecosim.domain.market.controller;

import com.ssafy.ecosim.domain.market.dto.request.UserOrderRequestDto;
import com.ssafy.ecosim.domain.market.service.UserOrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/market/orders")
@RequiredArgsConstructor
public class UserOrderController {

    private final UserOrderService userOrderService;

    @PostMapping
    public ResponseEntity<String> createOrder(@RequestBody UserOrderRequestDto request) {
        // TODO: 실제 Security 연동 완료 시 아래 주석 해제 및 적용
        /*
        @PostMapping
        public ResponseEntity<String> createOrder(
                @RequestBody MarketOrderRequestDto request,
                @AuthenticationPrincipal CustomUserDetails userDetails) {
            
            Long userId = userDetails.getId();
            Long companyId = userDetails.getCompanyId();
            marketOrderService.createOrder(userId, companyId, request);
        }
        */
        
        // 현재는 개발 시나리오 목적으로 하드코딩된 유저 정보를 넘깁니다.
        Long tempUserId = 1L;
        Long tempCompanyId = 100L;
        
        userOrderService.createOrder(tempUserId, tempCompanyId, request);
        
        return ResponseEntity.ok("주문 접수 이벤트가 발행되었습니다.");
    }
}
