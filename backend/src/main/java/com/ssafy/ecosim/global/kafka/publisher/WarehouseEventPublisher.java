package com.ssafy.ecosim.global.kafka.publisher;

import java.time.Instant;

/**
 * 창고 도메인 전용 이벤트 발행 인터페이스.
 *
 * 백엔드는 슬롯 변화 결과만 넘기고,
 * 회사 전체 보유량 집계는 Spark가 담당한다.
 */
public interface WarehouseEventPublisher {

    /**
     * 창고 입고 이벤트 발행
     */
    void publishItemStored(
            Long inventoryId,
            Long slotId,
            Integer slotIndex,
            Long companyId,
            Long itemId,
            Long quantityDelta,
            Long slotQuantityAfter,
            String reason,
            Instant storedAt
    );

    /**
     * 창고 출고 이벤트 발행
     */
    void publishItemRemoved(
            Long inventoryId,
            Long slotId,
            Integer slotIndex,
            Long companyId,
            Long itemId,
            Long quantityDelta,
            Long slotQuantityAfter,
            String reason,
            Instant removedAt
    );
}