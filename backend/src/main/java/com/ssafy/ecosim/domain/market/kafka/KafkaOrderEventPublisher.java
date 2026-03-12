package com.ssafy.ecosim.domain.market.kafka;

import com.ssafy.ecosim.domain.market.dto.event.OrderCreationEventDto;
import com.ssafy.ecosim.domain.market.dto.event.TradeEventDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

/**
 * 실제 Kafka 연동 이벤트 발행기입니다.
 * DE팀의 OrderMadeEventProducer를 통해 'order.made' 토픽으로 이벤트를 발행합니다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KafkaOrderEventPublisher implements OrderEventPublisher {

    private final OrderMadeEventProducer orderMadeEventProducer;

    @Override
    public void publishOrderEvent(OrderCreationEventDto event) {
        OrderMadeEvent kafkaEvent = OrderMadeEvent.builder()
                .eventId(UUID.randomUUID().toString())
                .eventTime(Instant.now())
                .eventType("ORDER_CREATED")
                .marketOrderId(null)        // DB 적재 후 ID 발급 → 매칭엔진에서 채움
                .item(event.getItemId())    // DE팀과 협의된 Integer 타입 itemId
                .companyId(event.getCompanyId())
                .orderType(event.getOrderType().name())  // "BUY" / "SELL"
                .price(event.getPrice().intValue())
                .totalQuantity(event.getTotalQuantity().intValue())
                .remainingQuantity(event.getTotalQuantity().intValue()) // 최초엔 전량 미체결
                .status("OPEN")
                .isVirtual(event.getIsVirtual())
                .createdAt(Instant.ofEpochMilli(event.getTimestamp()))
                .updatedAt(Instant.ofEpochMilli(event.getTimestamp()))
                .build();

        orderMadeEventProducer.sendOrderEvent(kafkaEvent);

        log.info("[Kafka] order.made published: type={}, item={}, price={}, qty={}, virtual={}",
                event.getOrderType(), event.getItemId(), event.getPrice(),
                event.getTotalQuantity(), event.getIsVirtual());
    }

    @Override
    public void publishTradeEvent(TradeEventDto event) {
        // TODO: TradeEvent(order.matched 토픽) 연동 예정 - DE팀 DTO 확정 후 구현
        log.info("[Kafka] publishTradeEvent called - TradeEvent 연동 예정. makerOrderId={}",
                event.getMakerOrderId());
    }
}
