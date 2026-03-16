package com.ssafy.ecosim.domain.market.kafka;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Kafka 체결 이벤트(market.events, eventType=market.trade.executed)의 payload 부분입니다.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TradeEventPayload {

    /** 체결 ID */
    @JsonProperty("trade_id")
    private Long tradeId;

    /** 아이템 ID */
    @JsonProperty("item_id")
    private Integer itemId;

    /** 매수 주문 ID */
    @JsonProperty("buy_order_id")
    private Long buyOrderId;

    /** 매도 주문 ID */
    @JsonProperty("sell_order_id")
    private Long sellOrderId;

    /** 체결 단가 */
    private Long price;

    /** 체결 수량 */
    private Long quantity;

    /** 매수 주문의 잔여 수량 */
    @JsonProperty("buy_remaining_quantity")
    private Long buyRemainingQuantity;

    /** 매도 주문의 잔여 수량 */
    @JsonProperty("sell_remaining_quantity")
    private Long sellRemainingQuantity;

    /** 체결 시각 */
    @JsonProperty("executed_at")
    private Instant executedAt;
}
