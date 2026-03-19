package com.ssafy.ecosim.global.kafka.publisher;

import com.ssafy.ecosim.global.kafka.model.EventEnvelope;
import com.ssafy.ecosim.global.kafka.resolver.MessageKeyResolver;
import com.ssafy.ecosim.global.kafka.resolver.TopicResolver;
import com.ssafy.ecosim.global.kafka.validator.EventSchemaValidator;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * EventPublisher 구현체.
 *
 * 처리 순서:
 * 1) payload 검증
 * 2) topic 결정
 * 3) partition key 정규화
 * 4) envelope 생성
 * 5) Kafka 전송
 */
@Component
public class KafkaEventPublisher implements EventPublisher {

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final TopicResolver topicResolver;
    private final MessageKeyResolver keyResolver;
    private final EventSchemaValidator validator;

    public KafkaEventPublisher(
            KafkaTemplate<String, Object> kafkaTemplate,
            TopicResolver topicResolver,
            MessageKeyResolver keyResolver,
            EventSchemaValidator validator
    ) {
        this.kafkaTemplate = kafkaTemplate;
        this.topicResolver = topicResolver;
        this.keyResolver = keyResolver;
        this.validator = validator;
    }

    @Override
    public void publish(
            String eventType,
            String producer,
            String partitionKey,
            String aggregateId,
            Map<String, Object> payload
    ) {
        // 1) 이벤트 타입별 payload 스키마 검증
        validator.validate(eventType, payload);

        // 2) 이벤트 타입으로 토픽 결정
        String topic = topicResolver.resolve(eventType);

        // 3) partition key 정규화 (blank -> null)
        String normalizedKey = keyResolver.normalize(partitionKey);

        // 4) 공통 envelope 생성
        EventEnvelope<Map<String, Object>> envelope = EventEnvelope.create(
                eventType,
                1,
                producer,
                normalizedKey,
                aggregateId,
                payload
        );

        // 5) Kafka 전송
        // key가 null이면 Kafka 기본 partitioner 정책으로 분산
        kafkaTemplate.send(topic, normalizedKey, envelope);
    }
}
