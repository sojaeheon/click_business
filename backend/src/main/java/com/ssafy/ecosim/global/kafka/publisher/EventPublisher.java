package com.ssafy.ecosim.global.kafka.publisher;

import java.util.Map;

/**
 * 공통 이벤트 발행 인터페이스.
 */
public interface EventPublisher {

    /**
     * 이벤트를 Kafka에 발행한다.
     *
     * @param eventType   이벤트 타입
     * @param producer    발행 서비스명
     * @param companyId   회사 ID
     * @param aggregateId 집계 식별자
     * @param payload     이벤트 payload
     */
    void publish(
            String eventType,
            String producer,
            Long companyId,
            String aggregateId,
            Map<String, Object> payload
    );
}