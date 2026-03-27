package com.ssafy.ecosim.domain.inventory.event;

import java.time.Instant;

/**
 * 창고 출고 도메인 이벤트.
 *
 * Service에서 직접 Kafka를 호출하는 대신 Spring 이벤트 버스에 발행하고,
 * WarehouseEventListener가 DB 커밋 이후(@TransactionalEventListener)에 Kafka로 전달한다.
 */
public record WarehouseItemRemovedEvent(
        Long warehouseId,
        Long slotId,
        Integer slotIndex,
        Long companyId,
        Long itemId,
        Long quantityDelta,
        Long slotQuantityAfter,
        String reason,
        Instant removedAt
) {}
