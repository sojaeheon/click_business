package com.ssafy.ecosim.global.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;
import org.springframework.kafka.support.serializer.JsonSerializer;

import java.util.HashMap;
import java.util.Map;

/**
 * Kafka Producer 설정 클래스.
 *
 * Key는 String,
 * Value는 EventEnvelope 객체를 JsonSerializer로 직렬화해서 전송한다.
 */
@Configuration
public class KafkaProducerConfig {

    /**
     * Kafka bootstrap server 주소.
     */
    @Value("${spring.kafka.bootstrap-servers:kafka:29092}")
    private String bootstrapServers;

    /**
     * Kafka 직렬화에 사용할 ObjectMapper Bean.
     *
     * Instant / LocalDateTime 등 Java Time 타입을
     * 숫자 timestamp가 아닌 ISO-8601 문자열로 직렬화하도록 설정한다.
     */
    // @Bean
    // public ObjectMapper kafkaObjectMapper() {
    //     ObjectMapper objectMapper = new ObjectMapper();

    //     // Java Time(Instant, LocalDateTime 등) 지원
    //     objectMapper.registerModule(new JavaTimeModule());

    //     // 날짜/시간을 숫자(timestamp) 대신 문자열(ISO-8601)로 직렬화
    //     objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    //     return objectMapper;
    // }

    /**
     * Kafka ProducerFactory Bean 등록.
     */
    @Bean
    // public ProducerFactory<String, Object> producerFactory(ObjectMapper kafkaObjectMapper) {
    public ProducerFactory<String, Object> producerFactory() {    
        Map<String, Object> config = new HashMap<>();

        // Kafka broker 주소
        config.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);

        // Key는 문자열, Value는 JSON 직렬화
        config.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        config.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);

        // 메시지 안정성 설정
        config.put(ProducerConfig.ACKS_CONFIG, "all");

        // 재시도 횟수
        config.put(ProducerConfig.RETRIES_CONFIG, 3);

        // 중복 메시지 방지
        config.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);

        // 메시지 압축
        config.put(ProducerConfig.COMPRESSION_TYPE_CONFIG, "gzip");

        // 짧은 batch 대기
        config.put(ProducerConfig.LINGER_MS_CONFIG, 1);

        // 🔥 중요: 타입 헤더 제거 (Consumer 호환성)
        config.put(JsonSerializer.ADD_TYPE_INFO_HEADERS, false);

        return new DefaultKafkaProducerFactory<>(config);

        // // JsonSerializer에 우리가 만든 ObjectMapper 사용
        // JsonSerializer<Object> jsonSerializer = new JsonSerializer<>(kafkaObjectMapper);

        // return new DefaultKafkaProducerFactory<>(
        //         config,
        //         new StringSerializer(),
        //         jsonSerializer
        // );
    }

    /**
     * KafkaTemplate Bean 등록.
     */
    // @Bean
    // public KafkaTemplate<String, Object> kafkaTemplate(ProducerFactory<String, Object> producerFactory) {
    //     return new KafkaTemplate<>(producerFactory);
    // }
    @Bean
    public KafkaTemplate<String, Object> kafkaTemplate(
            ProducerFactory<String, Object> producerFactory) {
        return new KafkaTemplate<>(producerFactory);
    }   
}