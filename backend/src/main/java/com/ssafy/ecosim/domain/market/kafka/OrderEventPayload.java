package com.ssafy.ecosim.domain.market.kafka;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Kafka 주문 이벤트의 payload 부분입니다.
 * market.events (eventType: order.created / order.cancelled) 공통으로 사용하며,
 * 취소 이벤트의 경우 cancelled_at 필드가 채워집니다.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OrderEventPayload {

    /** 주문 ID */
    @JsonProperty("order_id")
    private Long orderId;

    /** 아이템 ID */
    @JsonProperty("item_id")
    private Integer itemId;

    /** 주문 방향 (BUY / SELL) */
    private String side;

    /** 주문 단가 */
    private Integer price;

    /** 주문 수량 */
    private Integer quantity;

    /** 봇 주문 여부 */
    @JsonProperty("is_virtual")
    private Boolean isVirtual;

    /** 주문 생성 시각 (eventType: market.order.created 에서 사용) */
    @JsonProperty("created_at")
    private Instant createdAt;

    /** 주문 취소 시각 (eventType: market.order.cancelled 에서 사용) */
    @JsonProperty("cancelled_at")
    private Instant cancelledAt;
}
