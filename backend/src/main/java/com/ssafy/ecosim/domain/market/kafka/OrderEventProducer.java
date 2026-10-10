package com.ssafy.ecosim.domain.market.kafka;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

/**
 * 주문 관련 Kafka 이벤트를 발행하는 프로듀서입니다.
 *
 * Topics:
 *   - market.events (단일 토픽 사용)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OrderEventProducer {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    private static final String TOPIC_MARKET_EVENTS = "market.order.events";

    /** 주문 생성 이벤트 전송 */
    public void sendOrderCreatedEvent(OrderEventEnvelope event) {
        String key = String.valueOf(event.getPayload().getItemId());
        kafkaTemplate.send(TOPIC_MARKET_EVENTS, key, event)
                .whenComplete((result, ex) -> {
                    if (ex == null) {
                        log.debug("[Kafka] {} sent ({}): orderId={}, itemId={}, partition={}",
                                TOPIC_MARKET_EVENTS,
                                event.getEventType(),
                                event.getPayload().getOrderId(),
                                event.getPayload().getItemId(),
                                result.getRecordMetadata().partition());
                    } else {
                        log.error("[Kafka] {} send failed ({})", TOPIC_MARKET_EVENTS, event.getEventType(), ex);
                    }
                });
    }

    /** 주문 취소 이벤트 전송 */
    public void sendOrderCancelledEvent(OrderEventEnvelope event) {
        String key = String.valueOf(event.getPayload().getItemId());
        kafkaTemplate.send(TOPIC_MARKET_EVENTS, key, event)
                .whenComplete((result, ex) -> {
                    if (ex == null) {
                        log.debug("[Kafka] {} sent ({}): orderId={}, itemId={}, partition={}",
                                TOPIC_MARKET_EVENTS,
                                event.getEventType(),
                                event.getPayload().getOrderId(),
                                event.getPayload().getItemId(),
                                result.getRecordMetadata().partition());
                    } else {
                        log.error("[Kafka] {} send failed ({})", TOPIC_MARKET_EVENTS, event.getEventType(), ex);
                    }
                });
    }
}
