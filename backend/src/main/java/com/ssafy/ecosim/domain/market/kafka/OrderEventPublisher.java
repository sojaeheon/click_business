package com.ssafy.ecosim.domain.market.kafka;

import com.ssafy.ecosim.domain.market.dto.event.OrderCancellationEventDto;
import com.ssafy.ecosim.domain.market.dto.event.OrderCreationEventDto;

/**
 * Kafka 이벤트 발행 인터페이스입니다.
 */
public interface OrderEventPublisher {

    /**
     * 신규 주문 생성 이벤트를 발행합니다. (market.events 토픽, eventType=market.order.created)
     * @param event 프론트엔드 또는 봇이 생성한 주문 데이터
     */
    void publishOrderEvent(OrderCreationEventDto event);

    /**
     * 주문 취소 이벤트를 발행합니다. (market.events 토픽, eventType=market.order.cancelled)
     * @param event 취소 처리에 필요한 주문 데이터
     */
    void publishOrderCancelledEvent(OrderCancellationEventDto event);

}
