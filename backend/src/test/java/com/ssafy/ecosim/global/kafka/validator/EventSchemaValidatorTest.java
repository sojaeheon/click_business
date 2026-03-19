package com.ssafy.ecosim.global.kafka.validator;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * EventSchemaValidator 단위 테스트.
 *
 * 검증 목표:
 * - 이벤트별 필수 필드가 모두 있으면 통과
 * - 필수 필드 누락 시 예외 발생
 */
class EventSchemaValidatorTest {

    // 테스트 대상 객체
    private final EventSchemaValidator validator = new EventSchemaValidator();

    /**
     * warehouse.item.stored payload 정상 케이스
     */
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

    /**
     * warehouse.item.removed payload 정상 케이스
     */
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

    /**
     * company.cash.changed payload 정상 케이스 (신규)
     */
    @Test
    void validCompanyCashChangedPayload_shouldPass() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("company_id", 1001L);
        payload.put("cash", 1_200_000L);
        payload.put("changed_amount", -300_000L);
        payload.put("reason", "MARKET_BUY");
        payload.put("changed_at", "2026-03-19T10:05:00+09:00");
        // optional
        payload.put("reference_id", "order-20260317-0001");

        assertThatCode(() -> validator.validate("company.cash.changed", payload))
                .doesNotThrowAnyException();
    }

    /**
     * 필수 필드 누락 시 예외 발생 검증
     */
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
