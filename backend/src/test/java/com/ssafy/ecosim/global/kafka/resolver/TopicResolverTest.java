package com.ssafy.ecosim.global.kafka.resolver;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * TopicResolver 단위 테스트.
 *
 * 검증 목표:
 * - event_type이 올바른 Kafka topic으로 매핑되는지 확인
 * - 미지원 event_type은 예외가 발생하는지 확인
 */
class TopicResolverTest {

    // 테스트 대상 객체
    private final TopicResolver topicResolver = new TopicResolver();

    /**
     * warehouse.item.stored -> warehouse.events 매핑 검증
     */
    @Test
    void warehouseItemStored_shouldResolveWarehouseEventsTopic() {
        String topic = topicResolver.resolve("warehouse.item.stored");
        assertThat(topic).isEqualTo("warehouse.events");
    }

    /**
     * warehouse.item.removed -> warehouse.events 매핑 검증
     */
    @Test
    void warehouseItemRemoved_shouldResolveWarehouseEventsTopic() {
        String topic = topicResolver.resolve("warehouse.item.removed");
        assertThat(topic).isEqualTo("warehouse.events");
    }

    /**
     * company.cash.changed -> company.events 매핑 검증 (신규)
     */
    @Test
    void companyCashChanged_shouldResolveCompanyEventsTopic() {
        String topic = topicResolver.resolve("company.cash.changed");
        assertThat(topic).isEqualTo("company.events");
    }

    /**
     * 미지원 타입은 IllegalArgumentException 발생 검증
     */
    @Test
    void unsupportedEvent_shouldThrowException() {
        assertThatThrownBy(() -> topicResolver.resolve("unknown.event"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unsupported event type");
    }
}
