package com.ssafy.ecosim.domain.market.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

@Schema(description = "호가창 응답")
@Getter
@AllArgsConstructor
public class OrderBookResponseDto {

    @Schema(description = "아이템 ID", example = "1")
    private int itemId;

    @Schema(description = "현재 시장가", example = "1500")
    private Long currentPrice;

    @Schema(description = "매수 호가 목록 (높은 가격순, 최대 10레벨)")
    private List<OrderBookEntryDto> buyOrders;

    @Schema(description = "매도 호가 목록 (낮은 가격순, 최대 10레벨)")
    private List<OrderBookEntryDto> sellOrders;
}
