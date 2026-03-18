package com.ssafy.ecosim.global.kafka.publisher;

import com.ssafy.ecosim.global.kafka.model.EventEnvelope;
import com.ssafy.ecosim.global.kafka.resolver.MessageKeyResolver;
import com.ssafy.ecosim.global.kafka.resolver.TopicResolver;
import com.ssafy.ecosim.global.kafka.validator.EventSchemaValidator;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 실제 Kafka 발행 구현체.
 *
 * payload를 검증하고 EventEnvelope를 만든 뒤,
 * KafkaTemplate을 통해 객체를 그대로 전송한다.
 *
 * 직렬화는 KafkaProducerConfig의 JsonSerializer가 담당한다.
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
            Long companyId,
            String aggregateId,
            Map<String, Object> payload
    ) {
        // 1. payload 검증
        validator.validate(eventType, payload);

        // 2. 공통 envelope 생성
        EventEnvelope<Map<String, Object>> envelope = EventEnvelope.create(
                eventType,
                1,
                producer,
                companyId,
                aggregateId,
                null,
                null,
                payload
        );

        // 3. topic / key 결정
        String topic = topicResolver.resolve(eventType);
        String key = keyResolver.resolve(companyId);

        // 4. Kafka 전송
        // 직렬화는 JsonSerializer가 처리함
        kafkaTemplate.send(topic, key, envelope);
    }
}