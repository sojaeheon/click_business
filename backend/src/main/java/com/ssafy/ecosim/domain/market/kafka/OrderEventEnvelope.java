package com.ssafy.ecosim.domain.market.kafka;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.ZonedDateTime;

/**
 * Kafka 주문 이벤트 Envelope DTO입니다.
 *
 * Topics:
 *   - market.events (key=item_id)
 *     (eventType: market.order.created 또는 market.order.cancelled)
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderEventEnvelope {

    /** 이벤트 고유 ID (UUID, 중복 방지) */
    @JsonProperty("event_id")
    private String eventId;

    /** 이벤트 타입 (market.order.created / market.order.cancelled) */
    @JsonProperty("event_type")
    private String eventType;

    /** 이벤트 스키마 버전 */
    @JsonProperty("event_version")
    private Integer eventVersion;

    /** 이벤트 발생 시각 (ISO-8601, Asia/Seoul) */
    @JsonProperty("occurred_at")
    private ZonedDateTime occurredAt;

    /** 이벤트 발행 주체 */
    private String producer;

    /** 연관 기업 ID */
    @JsonProperty("company_id")
    private String companyId;

    /** 집합체 ID (예: order_123) */
    @JsonProperty("aggregate_id")
    private String aggregateId;

    /** 주문 이벤트 상세 데이터 */
    private OrderEventPayload payload;
}
