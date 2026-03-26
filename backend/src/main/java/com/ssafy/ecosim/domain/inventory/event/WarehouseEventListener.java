package com.ssafy.ecosim.domain.inventory.event;

import com.ssafy.ecosim.global.kafka.publisher.WarehouseEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 창고 도메인 이벤트 리스너.
 *
 * DB 트랜잭션이 성공적으로 커밋된 이후(AFTER_COMMIT)에만 Kafka 이벤트를 발행한다.
 * 덕분에 DB 롤백 시 Kafka 메시지가 나가는 불일치 문제가 사라진다.
 */
@Component
public class WarehouseEventListener {

    private final WarehouseEventPublisher warehouseEventPublisher;

    public WarehouseEventListener(WarehouseEventPublisher warehouseEventPublisher) {
        this.warehouseEventPublisher = warehouseEventPublisher;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onItemStored(WarehouseItemStoredEvent event) {
        warehouseEventPublisher.publishItemStored(
                event.warehouseId(),
                event.slotId(),
                event.slotIndex(),
                event.companyId(),
                event.itemId(),
                event.quantityDelta(),
                event.slotQuantityAfter(),
                event.reason(),
                event.storedAt()
        );
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onItemRemoved(WarehouseItemRemovedEvent event) {
        warehouseEventPublisher.publishItemRemoved(
                event.warehouseId(),
                event.slotId(),
                event.slotIndex(),
                event.companyId(),
                event.itemId(),
                event.quantityDelta(),
                event.slotQuantityAfter(),
                event.reason(),
                event.removedAt()
        );
    }
}
