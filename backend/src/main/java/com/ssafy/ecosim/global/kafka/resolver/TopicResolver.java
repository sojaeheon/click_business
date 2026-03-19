package com.ssafy.ecosim.global.kafka.resolver;

import org.springframework.stereotype.Component;

/**
 * 이벤트 타입을 Kafka 토픽명으로 매핑하는 Resolver.
 *
 * 현재는 창고 이벤트만 지원하며,
 * 이후 bank / market / production 이벤트가 추가되면 여기서 함께 관리한다.
 */
@Component
public class TopicResolver {

    /**
     * 이벤트 타입에 맞는 Kafka 토픽명을 반환한다.
     *
     * @param eventType 이벤트 타입 문자열
     * @return Kafka topic name
     */
    public String resolve(String eventType) {
        return switch (eventType) {
            case "warehouse.item.stored", "warehouse.item.removed" -> "warehouse.events";
            default -> throw new IllegalArgumentException("Unsupported event type: " + eventType);
        };
    }
}