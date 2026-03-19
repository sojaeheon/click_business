// package com.ssafy.ecosim.global.kafka.test;

// import com.ssafy.ecosim.global.kafka.publisher.WarehouseEventPublisher;
// import org.junit.jupiter.api.Test;
// import org.springframework.boot.test.context.SpringBootTest;

// import java.time.Instant;

// /**
//  * Warehouse Kafka producer 테스트 클래스.
//  *
//  * 테스트 실행 시에만 Kafka 이벤트를 발행한다.
//  */
// @SpringBootTest
// class WarehouseProducerTest {

//     private final WarehouseEventPublisher warehouseEventPublisher;

//     WarehouseProducerTest(WarehouseEventPublisher warehouseEventPublisher) {
//         this.warehouseEventPublisher = warehouseEventPublisher;
//     }

//     @Test
//     void publishWarehouseStoredAndRemovedEvents() {
//         // 입고 이벤트 1건 발행
//         warehouseEventPublisher.publishItemStored(
//                 10L,                     // inventory_id
//                 501L,                    // slot_id
//                 3,                       // slot_index
//                 1001L,                   // company_id
//                 2001L,                   // item_id
//                 40L,                     // quantity_delta
//                 70L,                     // slot_quantity_after
//                 "PRODUCTION_COLLECTION", // reason
//                 Instant.now()            // stored_at
//         );

//         // 출고 이벤트 1건 발행
//         warehouseEventPublisher.publishItemRemoved(
//                 10L,                    // inventory_id
//                 501L,                   // slot_id
//                 3,                      // slot_index
//                 1001L,                  // company_id
//                 2001L,                  // item_id
//                 20L,                    // quantity_delta
//                 50L,                    // slot_quantity_after
//                 "PRODUCTION_INPUT",     // reason
//                 Instant.now()           // removed_at
//         );

//         System.out.println("Warehouse Kafka test events sent.");
//     }
// }