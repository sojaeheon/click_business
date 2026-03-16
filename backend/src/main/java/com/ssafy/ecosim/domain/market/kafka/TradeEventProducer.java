package com.ssafy.ecosim.domain.market.kafka;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

/**
 * 체결 관련 Kafka 이벤트를 발행하는 프로듀서입니다.
 *
 * Topic:
 *   - market.trade.executed : 주문 체결 이벤트 (key = item_id)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TradeEventProducer {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    private static final String TOPIC_MARKET_EVENTS = "market.events";

    /** 체결 이벤트 전송 */
    public void sendTradeExecutedEvent(TradeEventEnvelope event) {
        String key = String.valueOf(event.getPayload().getItemId());
        kafkaTemplate.send(TOPIC_MARKET_EVENTS, key, event)
                .whenComplete((result, ex) -> {
                    if (ex == null) {
                        log.info("[Kafka] {} sent ({}): tradeId={}, itemId={}, partition={}",
                                TOPIC_MARKET_EVENTS,
                                event.getEventType(),
                                event.getPayload().getTradeId(),
                                event.getPayload().getItemId(),
                                result.getRecordMetadata().partition());
                    } else {
                        log.error("[Kafka] {} send failed ({})", TOPIC_MARKET_EVENTS, event.getEventType(), ex);
                    }
                });
    }
}
