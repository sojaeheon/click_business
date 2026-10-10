package com.ssafy.ecosim.global.kafka.publisher;

import com.ssafy.ecosim.global.kafka.resolver.MessageKeyResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * CompanyCashEventPublisher 구현체.
 *
 * 역할:
 * - payload 조립
 * - partition_key/aggregate_id 결정
 * - 공통 EventPublisher에 위임
 */
@Component
public class CompanyCashEventPublisherImpl implements CompanyCashEventPublisher {

    private static final String EVENT_TYPE = "company.cash.changed";
    private static final String PRODUCER = "company-service";

    private final EventPublisher eventPublisher;
    private final MessageKeyResolver keyResolver;

    public CompanyCashEventPublisherImpl(EventPublisher eventPublisher, MessageKeyResolver keyResolver) {
        this.eventPublisher = eventPublisher;
        this.keyResolver = keyResolver;
    }

    @Override
    public void publishCashChanged(
            Long companyId,
            Long cash,
            Long changedAmount,
            String reason,
            String referenceId,
            Instant changedAt
    ) {
        if (TransactionSynchronizationManager.isSynchronizationActive()
                && TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    publish(companyId, cash, changedAmount, reason, referenceId, changedAt);
                }
            });
            return;
        }

        publish(companyId, cash, changedAmount, reason, referenceId, changedAt);
    }

    /**
     * Sends only after the enclosing database transaction commits. Calls made
     * without a transaction (such as a manual runner) are sent immediately.
     */
    private void publish(
            Long companyId,
            Long cash,
            Long changedAmount,
            String reason,
            String referenceId,
            Instant changedAt
    ) {
        // 이벤트 payload 조립
        Map<String, Object> payload = new HashMap<>();
        payload.put("company_id", companyId);
        payload.put("cash", cash);
        payload.put("changed_amount", changedAmount);
        payload.put("reason", reason);
        payload.put("changed_at", changedAt.toString());

        // optional 필드는 값이 있을 때만 포함
        if (referenceId != null && !referenceId.isBlank()) {
            payload.put("reference_id", referenceId);
        }

        // 파티션 키는 company_id 문자열
        String partitionKey = keyResolver.fromCompanyId(companyId);

        // 집계 식별자는 company_id 사용
        String aggregateId = String.valueOf(companyId);

        // 공통 발행기로 Kafka 발행 위임
        eventPublisher.publish(
                EVENT_TYPE,
                PRODUCER,
                partitionKey,
                aggregateId,
                payload
        );
    }
}
