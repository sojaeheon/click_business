package com.ssafy.ecosim.domain.market.kafka;

import com.ssafy.ecosim.domain.market.dto.event.TradeEventDto;

/**
 * 카프카 체결 이벤트 발행 인터페이스입니다.
 */
public interface TradeEventPublisher {
    /**
     * 체결 이벤트를 카프카로 발행합니다.
     * @param eventDto 체결 상세 정보 (도메인 DTO)
     */
    void publishTradeEvent(TradeEventDto eventDto);
}
