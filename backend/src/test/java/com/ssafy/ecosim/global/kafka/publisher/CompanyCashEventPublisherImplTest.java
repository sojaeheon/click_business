package com.ssafy.ecosim.global.kafka.publisher;

import com.ssafy.ecosim.global.kafka.resolver.MessageKeyResolver;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/**
 * CompanyCashEventPublisherImpl 단위 테스트.
 *
 * 검증 목표:
 * - payload 조립이 스펙과 일치하는지
 * - event_type / producer / partition_key / aggregate_id 전달이 맞는지
 */
class CompanyCashEventPublisherImplTest {

    /**
     * company.cash.changed 이벤트 위임 호출 검증
     */
    @Test
    void publishCashChanged_shouldBuildPayloadAndDelegate() {
        // 1) given
        EventPublisher eventPublisher = mock(EventPublisher.class);
        MessageKeyResolver keyResolver = new MessageKeyResolver();
        CompanyCashEventPublisherImpl publisher =
                new CompanyCashEventPublisherImpl(eventPublisher, keyResolver);

        Instant changedAt = Instant.parse("2026-03-19T10:05:00Z");

        // 2) when
        publisher.publishCashChanged(
                1001L,
                1_200_000L,
                -300_000L,
                "MARKET_BUY",
                "order-20260317-0001",
                changedAt
        );

        // 3) then
        ArgumentCaptor<String> eventTypeCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> producerCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> partitionKeyCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> aggregateIdCaptor = ArgumentCaptor.forClass(String.class);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payloadCaptor = ArgumentCaptor.forClass(Map.class);

        verify(eventPublisher, times(1)).publish(
                eventTypeCaptor.capture(),
                producerCaptor.capture(),
                partitionKeyCaptor.capture(),
                aggregateIdCaptor.capture(),
                payloadCaptor.capture()
        );

        assertThat(eventTypeCaptor.getValue()).isEqualTo("company.cash.changed");
        assertThat(producerCaptor.getValue()).isEqualTo("company-service");
        assertThat(partitionKeyCaptor.getValue()).isEqualTo("1001");
        assertThat(aggregateIdCaptor.getValue()).isEqualTo("1001");

        Map<String, Object> payload = payloadCaptor.getValue();
        assertThat(payload.get("company_id")).isEqualTo(1001L);
        assertThat(payload.get("cash")).isEqualTo(1_200_000L);
        assertThat(payload.get("changed_amount")).isEqualTo(-300_000L);
        assertThat(payload.get("reason")).isEqualTo("MARKET_BUY");
        assertThat(payload.get("reference_id")).isEqualTo("order-20260317-0001");
        assertThat(payload.get("changed_at")).isEqualTo("2026-03-19T10:05:00Z");
    }

    /**
     * reference_id가 null/blank일 때 payload에서 제외되는지 검증
     */
    @Test
    void publishCashChanged_withoutReferenceId_shouldNotIncludeReferenceField() {
        EventPublisher eventPublisher = mock(EventPublisher.class);
        MessageKeyResolver keyResolver = new MessageKeyResolver();
        CompanyCashEventPublisherImpl publisher =
                new CompanyCashEventPublisherImpl(eventPublisher, keyResolver);

        publisher.publishCashChanged(
                1001L,
                900_000L,
                200_000L,
                "MARKET_SELL",
                null,
                Instant.parse("2026-03-19T11:00:00Z")
        );

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payloadCaptor = ArgumentCaptor.forClass(Map.class);

        verify(eventPublisher).publish(
                eq("company.cash.changed"),
                eq("company-service"),
                eq("1001"),
                eq("1001"),
                payloadCaptor.capture()
        );

        Map<String, Object> payload = payloadCaptor.getValue();
        assertThat(payload).doesNotContainKey("reference_id");
    }
}
