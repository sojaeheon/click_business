package com.ssafy.ecosim.domain.market.kafka;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

/**
 * 'order.made' Kafka 토픽으로 주문 생성/취소 이벤트를 발행하는 프로듀서입니다.
 */

@Slf4j
@Component
@RequiredArgsConstructor
public class OrderEventProducer {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    private static final String TOPIC = "order.made";

    /**
     * 주문 이벤트 전송 (생성 / 취소)
     */
    public void sendOrderEvent(OrderEventDto event) {

        kafkaTemplate.send(TOPIC, String.valueOf(event.getItem()), event)
                .whenComplete((result, ex) -> {
                    if (ex == null) {
                        log.info("Kafka order.made sent: eventType={}, orderId={}, item={}, partition={}",
                                event.getEventType(),
                                event.getMarketOrderId(),
                                event.getItem(),
                                result.getRecordMetadata().partition());
                    } else {
                        log.error("Kafka send failed", ex);
                    }
                });
    }
}