package com.ssafy.ecosim.domain.market.kafka;

import com.ssafy.ecosim.domain.market.dto.event.OrderCreationEventDto;
import com.ssafy.ecosim.domain.market.dto.event.TradeEventDto;

/**
 * Kafka 이벤트 발행 인터페이스입니다.
 * 신규 주문(유저/봇) 및 체결 이벤트를 발행하는 계약을 정의합니다.
 */
public interface OrderEventPublisher {
    
    /**
     * 체결 이벤트를 발행합니다.
     * @param event 체결 상세 정보(영수증)를 담은 DTO
     */
    void publishTradeEvent(TradeEventDto event);

    /**
     * 신규 주문 (실제 유저 및 가상 봇) 발생 시 이벤트를 발행합니다.
     * @param event 프론트엔드 또는 봇이 생성한 통합 주문 데이터
     */
    void publishOrderEvent(OrderCreationEventDto event);
}
