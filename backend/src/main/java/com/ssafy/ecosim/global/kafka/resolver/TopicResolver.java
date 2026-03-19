package com.ssafy.ecosim.global.kafka.resolver;

import org.springframework.stereotype.Component;

/**
 * 이벤트 타입 -> Kafka 토픽 매핑.
 *
 * 운영 시 토픽 규칙이 늘어나면 이 클래스에서 일괄 관리한다.
 */
@Component
public class TopicResolver {

    /**
     * 이벤트 타입에 맞는 토픽 반환.
     */
    public String resolve(String eventType) {
        return switch (eventType) {
            case "warehouse.item.stored", "warehouse.item.removed" -> "warehouse.events";
            case "company.cash.changed" -> "company.events";
            default -> throw new IllegalArgumentException("Unsupported event type: " + eventType);
        };
    }
}
