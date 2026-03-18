package com.ssafy.ecosim.global.kafka.publisher;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/**
 * WarehouseEventPublisherImpl 단위 테스트.
 *
 * payload가 올바르게 만들어지고,
 * EventPublisher에 기대한 파라미터로 위임되는지 검증한다.
 */
class WarehouseEventPublisherImplTest {

    @Test
    void publishItemStored_shouldBuildPayloadAndDelegateToEventPublisher() {
        // given
        EventPublisher eventPublisher = mock(EventPublisher.class);
        WarehouseEventPublisherImpl warehouseEventPublisher =
                new WarehouseEventPublisherImpl(eventPublisher);

        Instant now = Instant.parse("2026-03-19T10:00:00Z");

        // when
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

        // then
        ArgumentCaptor<String> eventTypeCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> producerCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Long> companyIdCaptor = ArgumentCaptor.forClass(Long.class);
        ArgumentCaptor<String> aggregateIdCaptor = ArgumentCaptor.forClass(String.class);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payloadCaptor = ArgumentCaptor.forClass(Map.class);

        verify(eventPublisher, times(1)).publish(
                eventTypeCaptor.capture(),
                producerCaptor.capture(),
                companyIdCaptor.capture(),
                aggregateIdCaptor.capture(),
                payloadCaptor.capture()
        );

        assertThat(eventTypeCaptor.getValue()).isEqualTo("warehouse.item.stored");
        assertThat(producerCaptor.getValue()).isEqualTo("warehouse-service");
        assertThat(companyIdCaptor.getValue()).isEqualTo(1001L);
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

    @Test
    void publishItemRemoved_shouldBuildPayloadAndDelegateToEventPublisher() {
        // given
        EventPublisher eventPublisher = mock(EventPublisher.class);
        WarehouseEventPublisherImpl warehouseEventPublisher =
                new WarehouseEventPublisherImpl(eventPublisher);

        Instant now = Instant.parse("2026-03-19T10:05:00Z");

        // when
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

        // then
        ArgumentCaptor<String> eventTypeCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> producerCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Long> companyIdCaptor = ArgumentCaptor.forClass(Long.class);
        ArgumentCaptor<String> aggregateIdCaptor = ArgumentCaptor.forClass(String.class);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payloadCaptor = ArgumentCaptor.forClass(Map.class);

        verify(eventPublisher, times(1)).publish(
                eventTypeCaptor.capture(),
                producerCaptor.capture(),
                companyIdCaptor.capture(),
                aggregateIdCaptor.capture(),
                payloadCaptor.capture()
        );

        assertThat(eventTypeCaptor.getValue()).isEqualTo("warehouse.item.removed");
        assertThat(producerCaptor.getValue()).isEqualTo("warehouse-service");
        assertThat(companyIdCaptor.getValue()).isEqualTo(1001L);
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