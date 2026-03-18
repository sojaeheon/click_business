package com.ssafy.ecosim.global.kafka.resolver;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * TopicResolver 단위 테스트.
 *
 * 이벤트 타입이 올바른 Kafka topic으로 매핑되는지 검증한다.
 */
class TopicResolverTest {

    private final TopicResolver topicResolver = new TopicResolver();

    @Test
    void warehouseItemStored_shouldResolveWarehouseEventsTopic() {
        String topic = topicResolver.resolve("warehouse.item.stored");
        assertThat(topic).isEqualTo("warehouse.events");
    }

    @Test
    void warehouseItemRemoved_shouldResolveWarehouseEventsTopic() {
        String topic = topicResolver.resolve("warehouse.item.removed");
        assertThat(topic).isEqualTo("warehouse.events");
    }

    @Test
    void unsupportedEvent_shouldThrowException() {
        assertThatThrownBy(() -> topicResolver.resolve("unknown.event"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unsupported event type");
    }
}