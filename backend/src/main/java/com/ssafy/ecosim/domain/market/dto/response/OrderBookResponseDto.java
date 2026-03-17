package com.ssafy.ecosim.domain.market.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

@Getter
@AllArgsConstructor
public class OrderBookResponseDto {
    private int itemId;
    // 현재 시장가 (Redis market:ticker:{itemId}:price)
    private Long currentPrice;
    // 매수 호가: 높은 가격순
    private List<OrderBookEntryDto> buyOrders;
    // 매도 호가: 낮은 가격순
    private List<OrderBookEntryDto> sellOrders;
}
