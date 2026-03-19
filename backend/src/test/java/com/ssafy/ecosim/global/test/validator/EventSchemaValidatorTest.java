package com.ssafy.ecosim.global.kafka.validator;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * EventSchemaValidator 단위 테스트.
 *
 * warehouse 이벤트 payload의 필수 필드 검증이 올바르게 동작하는지 확인한다.
 */
class EventSchemaValidatorTest {

    private final EventSchemaValidator validator = new EventSchemaValidator();

    @Test
    void validWarehouseStoredPayload_shouldPass() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("inventory_id", 10L);
        payload.put("slot_id", 501L);
        payload.put("slot_index", 3);
        payload.put("company_id", 1001L);
        payload.put("item_id", 2001L);
        payload.put("quantity_delta", 40L);
        payload.put("slot_quantity_after", 70L);
        payload.put("reason", "PRODUCTION_COLLECTION");
        payload.put("stored_at", "2026-03-19T10:00:00Z");

        assertThatCode(() -> validator.validate("warehouse.item.stored", payload))
                .doesNotThrowAnyException();
    }

    @Test
    void validWarehouseRemovedPayload_shouldPass() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("inventory_id", 10L);
        payload.put("slot_id", 501L);
        payload.put("slot_index", 3);
        payload.put("company_id", 1001L);
        payload.put("item_id", 2001L);
        payload.put("quantity_delta", 20L);
        payload.put("slot_quantity_after", 50L);
        payload.put("reason", "PRODUCTION_INPUT");
        payload.put("removed_at", "2026-03-19T10:00:00Z");

        assertThatCode(() -> validator.validate("warehouse.item.removed", payload))
                .doesNotThrowAnyException();
    }

    @Test
    void missingRequiredField_shouldThrowException() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("inventory_id", 10L);
        payload.put("slot_id", 501L);
        // slot_index 누락
        payload.put("company_id", 1001L);
        payload.put("item_id", 2001L);
        payload.put("quantity_delta", 40L);
        payload.put("slot_quantity_after", 70L);
        payload.put("reason", "PRODUCTION_COLLECTION");
        payload.put("stored_at", "2026-03-19T10:00:00Z");

        assertThatThrownBy(() -> validator.validate("warehouse.item.stored", payload))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("slot_index");
    }
}