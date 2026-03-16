package com.ssafy.ecosim.domain.market.kafka;

import com.ssafy.ecosim.domain.market.dto.event.TradeEventDto;

public interface TradeEventProducer {
    /**
     * 체결 이벤트를 카프카로 발행합니다.
     * @param eventDto 체결 상세 정보
     */
    void publishTradeEvent(TradeEventDto eventDto);
}
