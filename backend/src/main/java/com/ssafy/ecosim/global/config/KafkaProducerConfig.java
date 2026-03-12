package com.ssafy.ecosim.global.config;

import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.*;
import org.springframework.kafka.support.serializer.JsonSerializer;

import java.util.HashMap;
import java.util.Map;

@Configuration
public class KafkaProducerConfig {

    @Bean
    public ProducerFactory<String, Object> producerFactory() {

        Map<String, Object> config = new HashMap<>();

        // Kafka broker 주소
        config.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "kafka:9092");

        // Key / Value 직렬화 방식
        config.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        config.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);

        // 메시지 안정성 설정
        config.put(ProducerConfig.ACKS_CONFIG, "all");

        // 재시도 횟수
        config.put(ProducerConfig.RETRIES_CONFIG, 3);

        // 중복 메시지 방지
        config.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);

        // 메시지 압축
        config.put(ProducerConfig.COMPRESSION_TYPE_CONFIG, "snappy");

        // batch 전송
        config.put(ProducerConfig.LINGER_MS_CONFIG, 1);

        return new DefaultKafkaProducerFactory<>(config);
    }

    @Bean
    public KafkaTemplate<String, Object> kafkaTemplate() {
        return new KafkaTemplate<>(producerFactory());
    }
}