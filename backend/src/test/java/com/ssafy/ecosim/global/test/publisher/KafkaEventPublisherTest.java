package com.ssafy.ecosim.global.kafka.publisher;

import com.ssafy.ecosim.global.kafka.resolver.MessageKeyResolver;
import com.ssafy.ecosim.global.kafka.resolver.TopicResolver;
import com.ssafy.ecosim.global.kafka.validator.EventSchemaValidator;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/**
 * KafkaEventPublisher 단위 테스트.
 *
 * 실제 Kafka 없이 KafkaTemplate을 mock 처리해서
 * send()가 올바른 topic/key/value로 호출되는지 확인한다.
 */
class KafkaEventPublisherTest {

    @Test
    void publish_shouldSendKafkaMessage() {
        // given
        @SuppressWarnings("unchecked")
        KafkaTemplate<String, Object> kafkaTemplate = mock(KafkaTemplate.class);

        TopicResolver topicResolver = new TopicResolver();
        MessageKeyResolver keyResolver = new MessageKeyResolver();
        EventSchemaValidator validator = new EventSchemaValidator();

        KafkaEventPublisher publisher = new KafkaEventPublisher(
                kafkaTemplate,
                topicResolver,
                keyResolver,
                validator
        );

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

        // when
        publisher.publish(
                "warehouse.item.stored",
                "warehouse-service",
                1001L,
                "501",
                payload
        );

        // then
        ArgumentCaptor<String> topicCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object> valueCaptor = ArgumentCaptor.forClass(Object.class);

        verify(kafkaTemplate, times(1)).send(
                topicCaptor.capture(),
                keyCaptor.capture(),
                valueCaptor.capture()
        );

        assertThat(topicCaptor.getValue()).isEqualTo("warehouse.events");
        assertThat(keyCaptor.getValue()).isEqualTo("1001");
        assertThat(valueCaptor.getValue()).isNotNull();
    }
}