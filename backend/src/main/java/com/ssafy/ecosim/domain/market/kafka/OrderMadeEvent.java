package com.ssafy.ecosim.domain.market.kafka;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Kafka Topic: order.made
 *
 * 주문 생성 / 취소 이벤트를 Data Engineering 파이프라인으로 전달하기 위한 메시지 DTO
 *
 * Key: item
 * Value: OrderMadeEvent (JSON)
 */

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderMadeEvent {

    /** 이벤트 고유 ID (중복 처리용) */
    @JsonProperty("event_id")
    private String eventId;

    /** 이벤트 발생 시각 */
    @JsonProperty("event_time")
    private Instant eventTime;

    /** 이벤트 타입 (ORDER_CREATED / ORDER_CANCELLED) */
    @JsonProperty("event_type")
    private String eventType;

    /** 주문 ID */
    @JsonProperty("market_order_id")
    private Long marketOrderId;

    /** 거래 아이템 (Kafka Partition Key) */
    private String item;

    /** 기업 ID */
    @JsonProperty("company_id")
    private Long companyId;

    /** 주문 타입 (BUY / SELL) */
    @JsonProperty("order_type")
    private String orderType;

    /** 주문 가격 */
    private Integer price;

    /** 주문 총 수량 */
    @JsonProperty("total_quantity")
    private Integer totalQuantity;

    /** 미체결 수량 */
    @JsonProperty("remaining_quantity")
    private Integer remainingQuantity;

    /** 주문 상태 */
    private String status;

    /** 봇 주문 여부 */
    @JsonProperty("is_virtual")
    private Boolean isVirtual;

    /** 주문 생성 시각 */
    @JsonProperty("created_at")
    private Instant createdAt;

    /** 주문 수정 시각 */
    @JsonProperty("updated_at")
    private Instant updatedAt;
}