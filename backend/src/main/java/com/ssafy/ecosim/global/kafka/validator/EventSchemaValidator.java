package com.ssafy.ecosim.global.kafka.validator;

import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 이벤트 payload 스키마 검증기.
 *
 * 목적:
 * - producer 단계에서 필수 필드 누락을 fail-fast로 차단
 * - downstream 장애를 사전 예방
 */
@Component
public class EventSchemaValidator {

    /**
     * 이벤트 타입별 필수 필드 검증.
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
            case "company.cash.changed" -> {
                require(payload, "company_id");
                require(payload, "cash");
                require(payload, "changed_amount");
                require(payload, "reason");
                require(payload, "changed_at");
                // reference_id는 optional
            }
            default -> throw new IllegalArgumentException("Unsupported event type: " + eventType);
        }
    }

    /**
     * payload에 필수 key가 존재하고 null이 아닌지 확인.
     */
    private void require(Map<String, Object> payload, String key) {
        if (!payload.containsKey(key) || payload.get(key) == null) {
            throw new IllegalArgumentException("Missing required field: " + key);
        }
    }
}
