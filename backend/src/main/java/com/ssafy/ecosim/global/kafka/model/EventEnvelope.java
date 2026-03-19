package com.ssafy.ecosim.global.kafka.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

import java.time.Instant;
import java.util.UUID;

/**
 * 모든 도메인 이벤트의 공통 Envelope.
 *
 * 스펙:
 * - event_id
 * - event_type
 * - event_version
 * - occurred_at
 * - producer
 * - partition_key (optional)
 * - aggregate_id
 * - payload
 *
 * 참고:
 * - company_id는 envelope 메타에서 제거하고,
 *   필요한 경우 payload 내부 필드로 전달한다.
 */
@Value
@Builder
@Jacksonized
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class EventEnvelope<T> {

    /** 이벤트 고유 식별자(UUID) */
    UUID eventId;

    /** 이벤트 타입 (예: company.cash.changed) */
    String eventType;

    /** 이벤트 스키마 버전 */
    int eventVersion;

    /** 실제 도메인 이벤트 발생 시각 */
    Instant occurredAt;

    /** 이벤트 발행 서비스명 */
    String producer;

    /** Kafka 파티셔닝 기준값 (optional) */
    String partitionKey;

    /** 이벤트가 속한 집계 엔티티 식별자 */
    String aggregateId;

    /** 이벤트별 상세 데이터 */
    T payload;

    /**
     * 공통 Envelope 생성 헬퍼.
     *
     * 설계 의도:
     * - event_id/occurred_at 생성 중복 제거
     * - 메타 필드 누락 방지
     */
    public static <T> EventEnvelope<T> create(
            String eventType,
            int eventVersion,
            String producer,
            String partitionKey,
            String aggregateId,
            T payload
    ) {
        return EventEnvelope.<T>builder()
                .eventId(UUID.randomUUID())
                .eventType(eventType)
                .eventVersion(eventVersion)
                .occurredAt(Instant.now())
                .producer(producer)
                .partitionKey(partitionKey)
                .aggregateId(aggregateId)
                .payload(payload)
                .build();
    }
}
