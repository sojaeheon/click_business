package com.ssafy.ecosim.global.kafka.validator;

import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 이벤트 payload의 필수 필드 존재 여부를 검증하는 Validator.
 *
 * 현재는 warehouse 이벤트 2종만 검증한다.
 */
@Component
public class EventSchemaValidator {

    /**
     * 이벤트 타입별 필수 필드를 검증한다.
     *
     * @param eventType 이벤트 타입
     * @param payload   이벤트 payload
     */
    public void validate(String eventType, Map<String, Object> payload) {
        switch (eventType) {
            case "warehouse.item.stored" -> {
                require(payload, "inventory_id");
                require(payload, "slot_id");
                require(payload, "slot_index");
                require(payload, "company_id");
                require(payload, "item_id");
                require(payload, "quantity_delta");
                require(payload, "slot_quantity_after");
                require(payload, "reason");
                require(payload, "stored_at");
            }
            case "warehouse.item.removed" -> {
                require(payload, "inventory_id");
                require(payload, "slot_id");
                require(payload, "slot_index");
                require(payload, "company_id");
                require(payload, "item_id");
                require(payload, "quantity_delta");
                require(payload, "slot_quantity_after");
                require(payload, "reason");
                require(payload, "removed_at");
            }
            default -> throw new IllegalArgumentException("Unsupported event type: " + eventType);
        }
    }

    /**
     * payload에 필수 key가 존재하는지 검사한다.
     */
    private void require(Map<String, Object> payload, String key) {
        if (!payload.containsKey(key) || payload.get(key) == null) {
            throw new IllegalArgumentException("Missing required field: " + key);
        }
    }
}