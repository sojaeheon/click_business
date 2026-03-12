package com.ssafy.ecosim.domain.market.kafka;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

/**
 * DE팀의 Kafka 인프라 구축 전까지 매칭 엔진 개발을 막힘없이 진행하기 위해 만들어둔 임시 인터페이스입니다.
 * 체결이 성사될 때 이벤트를 발행하는 역할을 합니다.
 */

// public interface OrderMadeEventProducer {
    
//     // TODO: TradeEventDto 등 체결 정보를 담은 DTO가 확정되면 파라미터로 추가해야 합니다.
//     // 예: void publishTradeEvent(TradeEventDto event);
    
//     /**
//      * 주문 체결 이벤트를 발행합니다.
//      * @param orderId 체결된 주문의 고유 식별자 (임시)
//      */
//     void publishTradeEvent(Long orderId);
// }

@Slf4j
@Component
@RequiredArgsConstructor
public class OrderMadeEventProducer {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    private static final String TOPIC = "order.made";

    /**
     * 주문 이벤트 전송 (생성 / 취소)
     */
    public void sendOrderEvent(OrderMadeEvent event) {

        kafkaTemplate.send(TOPIC, event.getItem(), event)
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