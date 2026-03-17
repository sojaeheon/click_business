package com.ssafy.ecosim.domain.market.kafka;

import com.ssafy.ecosim.domain.market.dto.event.OrderCancellationEventDto;
import com.ssafy.ecosim.domain.market.dto.event.OrderCreationEventDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.UUID;

/**
 * 실제 Kafka 연동 이벤트 발행기입니다.
 * OrderMadeEventProducer를 통해 'market.events' 단일 토픽으로 이벤트를 발행합니다.
 *
 * - market.order.created  : 주문 생성
 * - market.order.cancelled: 주문 취소
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KafkaOrderEventPublisher implements OrderEventPublisher {

    private static final String PRODUCER_NAME = "market-service";
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final OrderEventProducer orderEventProducer;

    // ── 주문 생성 ────────────────────────────────────────────────
    @Override
    public void publishOrderEvent(OrderCreationEventDto event) {
        OrderEventPayload payload = OrderEventPayload.builder()
                .orderId(null)                                      // DE/매칭엔진에서 DB 적재 후 채움
                .itemId(event.getItemId())
                .side(event.getOrderType().name())                  // "BUY" / "SELL"
                .price(event.getPrice().intValue())
                .quantity(event.getTotalQuantity().intValue())
                .isVirtual(event.getIsVirtual())
                .createdAt(Instant.ofEpochMilli(event.getTimestamp()))
                .build();

        OrderEventEnvelope envelope = OrderEventEnvelope.builder()
                .eventId(UUID.randomUUID().toString())
                .eventType("market.order.created")
                .eventVersion(1)
                .occurredAt(ZonedDateTime.now(KST))
                .producer(PRODUCER_NAME)
                .companyId("c" + event.getCompanyId())
                .aggregateId("order_pending")                       // 체결 전이므로 임시값
                .payload(payload)
                .build();

        orderEventProducer.sendOrderCreatedEvent(envelope);

        log.info("[Kafka] market.order.created published: item={}, side={}, price={}, qty={}, virtual={}",
                event.getItemId(), event.getOrderType(), event.getPrice(),
                event.getTotalQuantity(), event.getIsVirtual());
    }

    // ── 주문 취소 ────────────────────────────────────────────────
    @Override
    public void publishOrderCancelledEvent(OrderCancellationEventDto event) {
        OrderEventPayload payload = OrderEventPayload.builder()
                .orderId(event.getOrderId())
                .itemId(event.getItemId())
                .side(event.getOrderType().name())
                .price(event.getPrice())
                .quantity(event.getQuantity())
                .isVirtual(event.getIsVirtual())
                .cancelledAt(Instant.ofEpochMilli(event.getTimestamp()))
                .build();

        OrderEventEnvelope envelope = OrderEventEnvelope.builder()
                .eventId(UUID.randomUUID().toString())
                .eventType("market.order.cancelled")
                .eventVersion(1)
                .occurredAt(ZonedDateTime.now(KST))
                .producer(PRODUCER_NAME)
                .companyId("c" + event.getCompanyId())
                .aggregateId("order_" + event.getOrderId())
                .payload(payload)
                .build();

        orderEventProducer.sendOrderCancelledEvent(envelope);

        log.info("[Kafka] market.order.cancelled published: orderId={}, item={}, side={}",
                event.getOrderId(), event.getItemId(), event.getOrderType());
    }

}
