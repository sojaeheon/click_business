package com.ssafy.ecosim.domain.market.dto.event;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.ssafy.ecosim.domain.market.entity.OrderType;
import lombok.Builder;
import lombok.Getter;

/**
 * 카프카 `market.trade.executed` 토픽으로 전송할 체결 완료 데이터 DTO입니다.
 */
@Getter
@Builder
public class TradeEventDto {
    @JsonProperty("trade_id")
    private Long tradeId;

    @JsonProperty("buy_order_id")
    private Long buyOrderId;

    @JsonProperty("sell_order_id")
    private Long sellOrderId;

    @JsonProperty("item_id")
    private Integer itemId;

    @JsonProperty("maker_order_type")
    private OrderType makerOrderType;

    @JsonProperty("price")
    private Long price;

    @JsonProperty("quantity")
    private Long quantity;

    @JsonProperty("buy_remaining_quantity")
    private Long buyRemainingQuantity;

    @JsonProperty("sell_remaining_quantity")
    private Long sellRemainingQuantity;

    @JsonProperty("executed_at")
    private Long executedAt;
}
