package com.ssafy.ecosim.global.kafka.publisher;

import com.ssafy.ecosim.global.kafka.resolver.MessageKeyResolver;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * 창고 이벤트 발행 구현체.
 *
 * 변경 포인트:
 * - EventPublisher가 partitionKey 기반으로 바뀌었으므로
 *   companyId를 문자열 partitionKey로 변환해 전달한다.
 */
@Component
public class WarehouseEventPublisherImpl implements WarehouseEventPublisher {

    private final EventPublisher eventPublisher;
    private final MessageKeyResolver keyResolver;

    public WarehouseEventPublisherImpl(EventPublisher eventPublisher, MessageKeyResolver keyResolver) {
        this.eventPublisher = eventPublisher;
        this.keyResolver = keyResolver;
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

        String partitionKey = keyResolver.fromCompanyId(companyId);
        String aggregateId = String.valueOf(slotId);

        eventPublisher.publish(
                "warehouse.item.stored",
                "warehouse-service",
                partitionKey,
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

        String partitionKey = keyResolver.fromCompanyId(companyId);
        String aggregateId = String.valueOf(slotId);

        eventPublisher.publish(
                "warehouse.item.removed",
                "warehouse-service",
                partitionKey,
                aggregateId,
                payload
        );
    }
}
