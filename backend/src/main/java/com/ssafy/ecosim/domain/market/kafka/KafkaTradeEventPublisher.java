package com.ssafy.ecosim.domain.market.kafka;

import com.ssafy.ecosim.domain.market.dto.event.TradeEventDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.UUID;

/**
 * 실제 Kafka 연동 체결 이벤트 발행기입니다.
 * TradeEventProducer를 통해 해당 토픽에 실제 이벤트를 전송합니다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KafkaTradeEventPublisher implements TradeEventPublisher {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final TradeEventProducer tradeEventProducer;

    @Override
    public void publishTradeEvent(TradeEventDto event) {
        TradeEventPayload payload = TradeEventPayload.builder()
                .tradeId(null)                          // trade ID는 매칭엔진(DE)에서 부여
                .itemId(event.getItemId())
                .buyOrderId(event.getBuyOrderId())
                .sellOrderId(event.getSellOrderId())
                .price(event.getPrice())
                .quantity(event.getQuantity())
                .buyRemainingQuantity(null)             // 매칭엔진(DE)에서 채우는 필드
                .sellRemainingQuantity(null)
                .executedAt(Instant.ofEpochMilli(event.getExecutedAt()))
                .build();

        TradeEventEnvelope envelope = TradeEventEnvelope.builder()
                .eventId(UUID.randomUUID().toString())
                .eventType("market.trade.executed")
                .eventVersion(1)
                .occurredAt(ZonedDateTime.now(KST))
                .producer("matching-engine")
                .companyId(null)                        // 체결은 양사 관여 → null
                .aggregateId("trade_buy_" + event.getBuyOrderId())
                .payload(payload)
                .build();

        tradeEventProducer.sendTradeExecutedEvent(envelope);

        log.info("[Kafka] market.trade.executed published: buy={}, sell={}, item={}, price={}, qty={}",
                event.getBuyOrderId(), event.getSellOrderId(),
                event.getItemId(), event.getPrice(), event.getQuantity());
    }
}
