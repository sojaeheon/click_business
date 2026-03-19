package com.ssafy.ecosim.global.kafka.publisher;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * 창고 도메인 이벤트 발행 구현체.
 *
 * 슬롯 상태 변화 결과만 payload에 담아 Kafka로 발행한다.
 * 회사 전체 아이템 보유량 집계는 Spark가 수행한다.
 */
@Component
public class WarehouseEventPublisherImpl implements WarehouseEventPublisher {

    private final EventPublisher eventPublisher;

    public WarehouseEventPublisherImpl(EventPublisher eventPublisher) {
        this.eventPublisher = eventPublisher;
    }

    @Override
    public void publishItemStored(
            Long inventoryId,
            Long slotId,
            Integer slotIndex,
            Long companyId,
            Long itemId,
            Long quantityDelta,
            Long slotQuantityAfter,
            String reason,
            Instant storedAt
    ) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("inventory_id", inventoryId);
        payload.put("slot_id", slotId);
        payload.put("slot_index", slotIndex);
        payload.put("company_id", companyId);
        payload.put("item_id", itemId);
        payload.put("quantity_delta", quantityDelta);
        payload.put("slot_quantity_after", slotQuantityAfter);
        payload.put("reason", reason);
        payload.put("stored_at", storedAt.toString());

        String aggregateId = String.valueOf(slotId);

        eventPublisher.publish(
                "warehouse.item.stored",
                "warehouse-service",
                companyId,
                aggregateId,
                payload
        );
    }

    @Override
    public void publishItemRemoved(
            Long inventoryId,
            Long slotId,
            Integer slotIndex,
            Long companyId,
            Long itemId,
            Long quantityDelta,
            Long slotQuantityAfter,
            String reason,
            Instant removedAt
    ) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("inventory_id", inventoryId);
        payload.put("slot_id", slotId);
        payload.put("slot_index", slotIndex);
        payload.put("company_id", companyId);
        payload.put("item_id", itemId);
        payload.put("quantity_delta", quantityDelta);
        payload.put("slot_quantity_after", slotQuantityAfter);
        payload.put("reason", reason);
        payload.put("removed_at", removedAt.toString());

        String aggregateId = String.valueOf(slotId);

        eventPublisher.publish(
                "warehouse.item.removed",
                "warehouse-service",
                companyId,
                aggregateId,
                payload
        );
    }
}