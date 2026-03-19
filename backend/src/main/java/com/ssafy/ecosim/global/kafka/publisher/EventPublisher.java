package com.ssafy.ecosim.global.kafka.publisher;

import java.util.Map;

/**
 * 공통 이벤트 발행 인터페이스.
 *
 * 핵심 변경:
 * - companyId 대신 partitionKey를 직접 받는다.
 * - 이벤트마다 파티셔닝 기준이 달라도 유연하게 대응 가능하다.
 */
public interface EventPublisher {

    /**
     * 이벤트를 Kafka로 발행한다.
     *
     * @param eventType    이벤트 타입
     * @param producer     발행 서비스명
     * @param partitionKey Kafka 파티셔닝 기준값 (optional)
     * @param aggregateId  집계 엔티티 식별자
     * @param payload      이벤트 상세 payload
     */
    void publish(
            String eventType,
            String producer,
            String partitionKey,
            String aggregateId,
            Map<String, Object> payload
    );
}
