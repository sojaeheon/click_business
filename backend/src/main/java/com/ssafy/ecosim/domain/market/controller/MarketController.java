package com.ssafy.ecosim.domain.market.controller;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.company.repository.CompanyRepository;
import com.ssafy.ecosim.domain.market.dto.response.OrderBookResponseDto;
import com.ssafy.ecosim.domain.market.dto.response.TradeHistoryDto;
import com.ssafy.ecosim.domain.market.service.OrderBookService;
import com.ssafy.ecosim.global.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/market")
@RequiredArgsConstructor
public class MarketController {

    private final OrderBookService orderBookService;
    private final CompanyRepository companyRepository;

    /**
     * 실시간 호가창 조회
     * GET /api/v1/market/orderbooks?item_id={itemId}
     * - 현재가(시장가): Redis market:ticker:{itemId}:price
     * - 매수 호가: 높은 가격 순 (최대 10 레벨)
     * - 매도 호가: 낮은 가격 순 (최대 10 레벨)
     */
    @GetMapping("/orderbooks")
    public ResponseEntity<ApiResponse<OrderBookResponseDto>> getOrderBook(
            @RequestParam("item_id") Integer itemId) {

        OrderBookResponseDto response = orderBookService.getOrderBook(itemId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * 내 회사의 체결 내역 조회 (마켓 페이지 내 수령 탭)
     * GET /api/v1/market/trades?item_id={itemId}
     * - 인증된 유저의 회사 + 해당 아이템 기준 최신 30건
     * - isCollected 포함 → 프론트에서 수령 버튼 렌더링
     */
    @GetMapping("/trades")
    public ResponseEntity<ApiResponse<List<TradeHistoryDto>>> getMyTrades(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam("item_id") Integer itemId) {

        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = companyRepository.findByUser_Id(userId)
                .orElseThrow(() -> new IllegalArgumentException("소속 회사를 찾을 수 없습니다."));

        List<TradeHistoryDto> response = orderBookService.getMyTrades(company.getId(), itemId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
