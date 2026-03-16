package com.ssafy.ecosim.domain.market.kafka;

import com.ssafy.ecosim.domain.market.dto.event.TradeEventDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class DummyTradeEventProducer implements TradeEventProducer {
    @Override
    public void publishTradeEvent(TradeEventDto eventDto) {
        log.info("Trade Event Published: MakerOrder={}, TakerOrder={}, Item={}, Price={}, Qty={}",
                eventDto.getMakerOrderId(), eventDto.getTakerOrderId(),
                eventDto.getItemId(), eventDto.getMatchedPrice(), eventDto.getMatchedQuantity());
    }
}
