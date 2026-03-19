// package com.ssafy.ecosim.global.kafka.manual;

// import com.ssafy.ecosim.global.config.KafkaProducerConfig;
// import com.ssafy.ecosim.global.kafka.publisher.KafkaEventPublisher;
// import com.ssafy.ecosim.global.kafka.publisher.WarehouseEventPublisher;
// import com.ssafy.ecosim.global.kafka.publisher.WarehouseEventPublisherImpl;
// import com.ssafy.ecosim.global.kafka.resolver.MessageKeyResolver;
// import com.ssafy.ecosim.global.kafka.resolver.TopicResolver;
// import com.ssafy.ecosim.global.kafka.validator.EventSchemaValidator;
// import org.junit.jupiter.api.Test;
// import org.springframework.beans.factory.annotation.Autowired;
// import org.springframework.test.context.TestPropertySource;
// import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

// import java.time.Instant;

// import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

// /**
//  * 수동 발행 테스트(안정형):
//  * - Warehouse 이벤트 발행 호출 성공 여부만 검증
//  */
// @SpringJUnitConfig(classes = {
//         KafkaProducerConfig.class,
//         KafkaEventPublisher.class,
//         TopicResolver.class,
//         MessageKeyResolver.class,
//         EventSchemaValidator.class,
//         WarehouseEventPublisherImpl.class
// })
// @TestPropertySource(properties = {
//         "spring.kafka.bootstrap-servers=kafka:9092"
// })
// class WarehouseProducerTestRunner {

//     @Autowired
//     private WarehouseEventPublisher warehouseEventPublisher;

//     @Test
//     void publishWarehouseStoredAndRemovedEvents() {
//         assertDoesNotThrow(() -> warehouseEventPublisher.publishItemStored(
//                 10L, 501L, 3, 1001L, 2001L, 40L, 70L,
//                 "PRODUCTION_COLLECTION", Instant.now()
//         ));

//         assertDoesNotThrow(() -> warehouseEventPublisher.publishItemRemoved(
//                 10L, 501L, 3, 1001L, 2001L, 20L, 50L,
//                 "PRODUCTION_INPUT", Instant.now()
//         ));
//     }
// }
