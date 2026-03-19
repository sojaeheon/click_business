// package com.ssafy.ecosim.global.kafka.manual;

// import com.ssafy.ecosim.global.config.KafkaProducerConfig;
// import com.ssafy.ecosim.global.kafka.publisher.CompanyCashEventPublisher;
// import com.ssafy.ecosim.global.kafka.publisher.CompanyCashEventPublisherImpl;
// import com.ssafy.ecosim.global.kafka.publisher.KafkaEventPublisher;
// import com.ssafy.ecosim.global.kafka.resolver.MessageKeyResolver;
// import com.ssafy.ecosim.global.kafka.resolver.TopicResolver;
// import com.ssafy.ecosim.global.kafka.validator.EventSchemaValidator;
// import org.junit.jupiter.api.Test;
// import org.springframework.beans.factory.annotation.Autowired;
// import org.springframework.test.context.TestPropertySource;
// import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

// import java.time.Instant;
// import java.util.UUID;

// import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

// /**
//  * 수동 발행 테스트(안정형):
//  * - 내부 Consumer 검증 없이, Publisher 호출이 예외 없이 끝나는지 확인
//  * - 실제 적재 확인은 kafka-console-consumer로 수동 확인
//  */
// @SpringJUnitConfig(classes = {
//         KafkaProducerConfig.class,
//         KafkaEventPublisher.class,
//         TopicResolver.class,
//         MessageKeyResolver.class,
//         EventSchemaValidator.class,
//         CompanyCashEventPublisherImpl.class
// })
// @TestPropertySource(properties = {
//         "spring.kafka.bootstrap-servers=kafka:9092"
// })
// class CompanyCashProducerTestRunner {

//     @Autowired
//     private CompanyCashEventPublisher companyCashEventPublisher;

//     @Test
//     void publishCompanyCashChangedEvents() {
//         String referenceId = "manual-cash-" + UUID.randomUUID();

//         assertDoesNotThrow(() -> companyCashEventPublisher.publishCashChanged(
//                 1001L,
//                 1_200_000L,
//                 -300_000L,
//                 "MARKET_BUY",
//                 referenceId,
//                 Instant.now()
//         ));
//     }
// }
