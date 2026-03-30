package com.ssafy.ecosim.global.kafka.publisher;

import com.ssafy.ecosim.global.kafka.resolver.MessageKeyResolver;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/**
 * WarehouseEventPublisherImpl 단위 테스트.
 *
 * 검증 목표:
 * - payload가 정확히 구성되는지
 * - EventPublisher에 전달되는 partition_key / aggregate_id가 올바른지
 */
class WarehouseEventPublisherImplTest {

    /**
     * publishItemStored 검증
     */
    @Test
    void publishItemStored_shouldBuildPayloadAndDelegateToEventPublisher() {
        // 1) given
        EventPublisher eventPublisher = mock(EventPublisher.class);
        MessageKeyResolver keyResolver = new MessageKeyResolver();
        WarehouseEventPublisherImpl warehouseEventPublisher =
                new WarehouseEventPublisherImpl(eventPublisher, keyResolver);

        Instant now = Instant.parse("2026-03-19T10:00:00Z");

        // 2) when
        warehouseEventPublisher.publishItemStored(
                10L,
                501L,
                3,
                1001L,
                2001L,
                40L,
                70L,
                "PRODUCTION_COLLECTION",
                now
        );

        // 3) then
        ArgumentCaptor<String> eventTypeCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> producerCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> partitionKeyCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> aggregateIdCaptor = ArgumentCaptor.forClass(String.class);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payloadCaptor = ArgumentCaptor.forClass(Map.class);

        verify(eventPublisher, times(1)).publish(
                eventTypeCaptor.capture(),
                producerCaptor.capture(),
                partitionKeyCaptor.capture(),
                aggregateIdCaptor.capture(),
                payloadCaptor.capture()
        );

        assertThat(eventTypeCaptor.getValue()).isEqualTo("warehouse.item.stored");
        assertThat(producerCaptor.getValue()).isEqualTo("warehouse-service");
        assertThat(partitionKeyCaptor.getValue()).isEqualTo("1001");
        assertThat(aggregateIdCaptor.getValue()).isEqualTo("501");

        Map<String, Object> payload = payloadCaptor.getValue();
        assertThat(payload.get("inventory_id")).isEqualTo(10L);
        assertThat(payload.get("slot_id")).isEqualTo(501L);
        assertThat(payload.get("slot_index")).isEqualTo(3);
        assertThat(payload.get("company_id")).isEqualTo(1001L);
        assertThat(payload.get("item_id")).isEqualTo(2001L);
        assertThat(payload.get("quantity_delta")).isEqualTo(40L);
        assertThat(payload.get("slot_quantity_after")).isEqualTo(70L);
        assertThat(payload.get("reason")).isEqualTo("PRODUCTION_COLLECTION");
        assertThat(payload.get("stored_at")).isEqualTo("2026-03-19T10:00:00Z");
    }

    /**
     * publishItemRemoved 검증
     */
    @Test
    void publishItemRemoved_shouldBuildPayloadAndDelegateToEventPublisher() {
        EventPublisher eventPublisher = mock(EventPublisher.class);
        MessageKeyResolver keyResolver = new MessageKeyResolver();
        WarehouseEventPublisherImpl warehouseEventPublisher =
                new WarehouseEventPublisherImpl(eventPublisher, keyResolver);

        Instant now = Instant.parse("2026-03-19T10:05:00Z");

        warehouseEventPublisher.publishItemRemoved(
                10L,
                501L,
                3,
                1001L,
                2001L,
                20L,
                50L,
                "PRODUCTION_INPUT",
                now
        );

        ArgumentCaptor<String> eventTypeCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> producerCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> partitionKeyCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> aggregateIdCaptor = ArgumentCaptor.forClass(String.class);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payloadCaptor = ArgumentCaptor.forClass(Map.class);

        verify(eventPublisher, times(1)).publish(
                eventTypeCaptor.capture(),
                producerCaptor.capture(),
                partitionKeyCaptor.capture(),
                aggregateIdCaptor.capture(),
                payloadCaptor.capture()
        );

        assertThat(eventTypeCaptor.getValue()).isEqualTo("warehouse.item.removed");
        assertThat(producerCaptor.getValue()).isEqualTo("warehouse-service");
        assertThat(partitionKeyCaptor.getValue()).isEqualTo("1001");
        assertThat(aggregateIdCaptor.getValue()).isEqualTo("501");

        Map<String, Object> payload = payloadCaptor.getValue();
        assertThat(payload.get("inventory_id")).isEqualTo(10L);
        assertThat(payload.get("slot_id")).isEqualTo(501L);
        assertThat(payload.get("slot_index")).isEqualTo(3);
        assertThat(payload.get("company_id")).isEqualTo(1001L);
        assertThat(payload.get("item_id")).isEqualTo(2001L);
        assertThat(payload.get("quantity_delta")).isEqualTo(20L);
        assertThat(payload.get("slot_quantity_after")).isEqualTo(50L);
        assertThat(payload.get("reason")).isEqualTo("PRODUCTION_INPUT");
        assertThat(payload.get("removed_at")).isEqualTo("2026-03-19T10:05:00Z");
    }
}
