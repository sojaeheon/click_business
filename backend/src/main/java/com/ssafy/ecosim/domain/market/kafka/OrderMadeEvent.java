package com.ssafy.ecosim.domain.market.kafka;

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

    /**
     * 이벤트 종류
     * ORDER_CREATED / ORDER_CANCELLED
     */
    private String eventType;

    /** 주문 ID */
    private Long marketOrderId;

    /** 거래 아이템 (ex: gold_ore, gold_bar) */
    private String item;

    /** 기업 ID */
    private Long companyId;

    /** 주문 타입 (BUY / SELL) */
    private String orderType;

    /** 주문 가격 */
    private Integer price;

    /** 주문 총 수량 */
    private Integer totalQuantity;

    /** 미체결 수량 */
    private Integer remainingQuantity;

    /** 주문 상태
     * OPEN / PARTIALLY_FILLED / FILLED / CANCELLED
     */
    private String status;

    /** 봇 주문 여부 */
    private Boolean isVirtual;

    /** 주문 생성 시각 */
    private Instant createdAt;

    /** 주문 수정 시각 */
    private Instant updatedAt;

}