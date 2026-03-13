package com.ssafy.ecosim.domain.market.kafka;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Kafka 체결 이벤트 DTO입니다.
 * 주문 매칭(체결) 완료 시 DE팀 파이프라인으로 전달하기 위한 메시지입니다.
 * 토픽명은 DE팀과 협의 후 확정 예정입니다.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TradeEvent {

    /** 이벤트 고유 ID (중복 처리용) */
    @JsonProperty("event_id")
    private String eventId;

    /** 이벤트 발생 시각 */
    @JsonProperty("event_time")
    private Instant eventTime;

    /** Maker 주문 ID (호가창에 먼저 등록된 주문) */
    @JsonProperty("maker_order_id")
    private Long makerOrderId;

    /** Taker 주문 ID (체결을 낸 주문) */
    @JsonProperty("taker_order_id")
    private Long takerOrderId;

    /** 거래 아이템 ID */
    @JsonProperty("item_id")
    private Integer itemId;

    /** 체결 단가 */
    @JsonProperty("matched_price")
    private Long matchedPrice;

    /** 체결 수량 */
    @JsonProperty("matched_quantity")
    private Long matchedQuantity;

    /** 체결 시각 */
    @JsonProperty("matched_at")
    private Instant matchedAt;
}
