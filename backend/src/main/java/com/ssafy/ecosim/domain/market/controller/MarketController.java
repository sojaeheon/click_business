package com.ssafy.ecosim.domain.market.controller;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.company.repository.CompanyRepository;
import com.ssafy.ecosim.domain.market.dto.response.OrderBookEntryDto;
import com.ssafy.ecosim.domain.market.dto.response.OrderBookResponseDto;
import com.ssafy.ecosim.domain.market.dto.response.TradeHistoryDto;
import com.ssafy.ecosim.domain.market.service.OrderBookService;
import com.ssafy.ecosim.global.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;

@Tag(name = "마켓", description = "실시간 호가창 조회, 체결 내역 조회")
@RestController
@RequestMapping("/api/v1/market")
@RequiredArgsConstructor
public class MarketController {

    private final OrderBookService orderBookService;
    private final CompanyRepository companyRepository;
    private final com.ssafy.ecosim.domain.market.service.CandleService candleService;

    @Operation(summary = "실시간 호가창 조회", description = "지정한 아이템의 현재가, 매수/매도 호가 목록(최대 10레벨)을 반환합니다.")
    @GetMapping("/orderbooks")
    public ResponseEntity<ApiResponse<OrderBookResponseDto>> getOrderBook(
            @Parameter(description = "조회할 아이템 ID", example = "1") @RequestParam("item_id") Integer itemId) {

        OrderBookResponseDto response = orderBookService.getOrderBook(itemId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Operation(summary = "내 체결 내역 조회", description = "내 회사의 특정 아이템 체결 내역 최신 30건을 반환합니다.")
    @GetMapping("/trades")
    public ResponseEntity<ApiResponse<List<TradeHistoryDto>>> getMyTrades(
            @AuthenticationPrincipal UserDetails userDetails,
            @Parameter(description = "조회할 아이템 ID", example = "1") @RequestParam("item_id") Integer itemId) {

        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = companyRepository.findByUser_Id(userId)
                .orElseThrow(() -> new IllegalArgumentException("소속 회사를 찾을 수 없습니다."));

        List<TradeHistoryDto> response = orderBookService.getMyTrades(company.getId(), itemId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Operation(summary = "실시간 차트 데이터 조회", description = "특정 아이템의 최근 체결 가격 목록(최대 100건)을 반환합니다. 실시간 차트의 초기 데이터로 사용됩니다.")
    @GetMapping("/chart")
    public ResponseEntity<ApiResponse<com.ssafy.ecosim.domain.market.dto.response.ChartDataResponseDto>> getChartData(
            @Parameter(description = "조회할 아이템 ID", example = "1") @RequestParam("item_id") Integer itemId) {
        
        com.ssafy.ecosim.domain.market.dto.response.ChartDataResponseDto response = orderBookService.getChartData(itemId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Operation(summary = "5분봉 차트 데이터 조회", description = "특정 아이템의 5분봉 캔들 데이터를 반환합니다. 확정된 분봉과 현재 진행중인 분봉을 포함합니다.")
    @GetMapping("/candles")
    public ResponseEntity<ApiResponse<List<com.ssafy.ecosim.domain.market.dto.response.CandleResponse>>> get5MinCandles(
            @Parameter(description = "조회할 아이템 ID", example = "1") @RequestParam("item_id") Integer itemId,
            @Parameter(description = "조회할 분봉 개수", example = "100") @RequestParam(value = "count", defaultValue = "100") int count) {
        
        List<com.ssafy.ecosim.domain.market.dto.response.CandleResponse> response = candleService.get5MinCandles(itemId, count);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
