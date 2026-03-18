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
 * Kafka로 발행되는 모든 이벤트의 공통 Envelope 모델.
 *
 * <p>도메인별 payload를 공통 메타데이터와 함께 감싸서 전송한다.</p>
 *
 * <ul>
 *   <li>event_id: 이벤트 고유 식별자</li>
 *   <li>event_type: 이벤트 타입 (예: warehouse.item.stored)</li>
 *   <li>event_version: 이벤트 스키마 버전</li>
 *   <li>occurred_at: 실제 이벤트 발생 시각 (UTC 기준 Instant)</li>
 *   <li>producer: 이벤트를 발행한 서비스명</li>
 *   <li>company_id: 이벤트가 속한 회사 ID</li>
 *   <li>aggregate_id: 이벤트가 속한 집계 단위 식별자</li>
 *   <li>correlation_id: 하나의 비즈니스 요청 흐름을 묶는 ID</li>
 *   <li>trace_id: 분산 추적용 ID</li>
 *   <li>payload: 이벤트 상세 데이터</li>
 * </ul>
 *
 * <p>불변 객체로 유지하기 위해 {@code @Value}를 사용하고,
 * Jackson 역직렬화를 위해 {@code @Jacksonized}를 사용한다.</p>
 */
@Value
@Builder
@Jacksonized
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class EventEnvelope<T> {

    /**
     * 이벤트 고유 ID.
     * 중복 처리, 추적, 장애 분석에 사용한다.
     */
    UUID eventId;

    /**
     * 이벤트 타입.
     * 예: warehouse.item.stored
     */
    String eventType;

    /**
     * 이벤트 스키마 버전.
     * 현재는 1부터 시작.
     */
    int eventVersion;

    /**
     * 실제 이벤트 발생 시각.
     * Kafka 적재 시각이 아니라 비즈니스 이벤트 발생 시각이다.
     */
    Instant occurredAt;

    /**
     * 이벤트 발행 서비스 이름.
     * 예: warehouse-service
     */
    String producer;

    /**
     * 회사 ID.
     * 대부분의 이벤트는 회사 단위로 파티셔닝/집계되므로 중요하다.
     */
    Long companyId;

    /**
     * 집계 단위 식별자.
     * 예: companyId:itemId, tradeId, workstationId 등
     */
    String aggregateId;

    /**
     * 하나의 비즈니스 요청 흐름을 식별하는 ID.
     * 선택값이며, 있으면 요청 단위 추적이 쉬워진다.
     */
    String correlationId;

    /**
     * 분산 추적용 ID.
     * 선택값이며, 로그/추적 시스템과 연계할 때 유용하다.
     */
    String traceId;

    /**
     * 도메인별 실제 이벤트 데이터.
     * 예: warehouse 입고/출고 payload
     */
    T payload;

    /**
     * 공통 기본값(event_id, occurred_at)을 자동으로 채워 Envelope를 생성하는 헬퍼 메서드.
     *
     * <p>백엔드 서비스나 Publisher에서 builder를 직접 매번 작성하지 않도록 돕는다.</p>
     *
     * @param eventType 이벤트 타입
     * @param eventVersion 이벤트 버전
     * @param producer 발행 서비스명
     * @param companyId 회사 ID
     * @param aggregateId 집계 단위 식별자
     * @param correlationId 요청 흐름 식별자
     * @param traceId 분산 추적 ID
     * @param payload 실제 이벤트 payload
     * @return 공통 메타데이터가 채워진 EventEnvelope
     * @param <T> payload 타입
     */
    public static <T> EventEnvelope<T> create(
            String eventType,
            int eventVersion,
            String producer,
            Long companyId,
            String aggregateId,
            String correlationId,
            String traceId,
            T payload
    ) {
        return EventEnvelope.<T>builder()
                .eventId(UUID.randomUUID())
                .eventType(eventType)
                .eventVersion(eventVersion)
                .occurredAt(Instant.now())
                .producer(producer)
                .companyId(companyId)
                .aggregateId(aggregateId)
                .correlationId(correlationId)
                .traceId(traceId)
                .payload(payload)
                .build();
    }
}