package com.ssafy.ecosim.global.kafka.publisher;

import com.ssafy.ecosim.global.kafka.model.EventEnvelope;
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
 * 검증 목표:
 * - publish 호출 시 올바른 topic/key/envelope로 send 되는지 확인
 * - envelope 내부 메타(event_type, partition_key 등)가 기대값인지 확인
 */
class KafkaEventPublisherTest {

    /**
     * warehouse 이벤트 발행 검증
     */
    @Test
    void publishWarehouseEvent_shouldSendKafkaMessage() {
        // 1) mock 및 테스트 대상 준비
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

        // 2) 테스트 payload
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

        // 3) 실행
        publisher.publish(
                "warehouse.item.stored",
                "warehouse-service",
                "1001",     // partition_key
                "501",      // aggregate_id
                payload
        );

        // 4) send 인자 캡처
        ArgumentCaptor<String> topicCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object> valueCaptor = ArgumentCaptor.forClass(Object.class);

        verify(kafkaTemplate, times(1)).send(
                topicCaptor.capture(),
                keyCaptor.capture(),
                valueCaptor.capture()
        );

        // 5) topic/key 검증
        assertThat(topicCaptor.getValue()).isEqualTo("warehouse.events");
        assertThat(keyCaptor.getValue()).isEqualTo("1001");

        // 6) envelope 메타 검증
        assertThat(valueCaptor.getValue()).isInstanceOf(EventEnvelope.class);
        @SuppressWarnings("unchecked")
        EventEnvelope<Map<String, Object>> envelope = (EventEnvelope<Map<String, Object>>) valueCaptor.getValue();

        assertThat(envelope.getEventType()).isEqualTo("warehouse.item.stored");
        assertThat(envelope.getProducer()).isEqualTo("warehouse-service");
        assertThat(envelope.getPartitionKey()).isEqualTo("1001");
        assertThat(envelope.getAggregateId()).isEqualTo("501");
        assertThat(envelope.getPayload()).containsEntry("company_id", 1001L);
    }

    /**
     * company.cash.changed 이벤트 발행 검증 (신규)
     */
    @Test
    void publishCompanyCashChanged_shouldSendToCompanyEvents() {
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
        payload.put("company_id", 1001L);
        payload.put("cash", 1_200_000L);
        payload.put("changed_amount", -300_000L);
        payload.put("reason", "MARKET_BUY");
        payload.put("changed_at", "2026-03-19T10:05:00+09:00");

        publisher.publish(
                "company.cash.changed",
                "company-service",
                "1001",
                "1001",
                payload
        );

        ArgumentCaptor<String> topicCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);

        verify(kafkaTemplate).send(topicCaptor.capture(), keyCaptor.capture(), any());

        assertThat(topicCaptor.getValue()).isEqualTo("company.events");
        assertThat(keyCaptor.getValue()).isEqualTo("1001");
    }
}
