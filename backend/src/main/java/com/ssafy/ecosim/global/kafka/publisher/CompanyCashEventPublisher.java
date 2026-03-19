package com.ssafy.ecosim.global.kafka.publisher;

import java.time.Instant;

/**
 * 회사 현금 변경 이벤트 발행 인터페이스.
 */
public interface CompanyCashEventPublisher {

    /**
     * 회사 현금 변경 이벤트(company.cash.changed)를 발행한다.
     *
     * @param companyId     회사 ID
     * @param cash          변경 후 현재 현금
     * @param changedAmount 현금 증감액(+/-)
     * @param reason        변경 사유 (예: MARKET_SELL, MARKET_BUY)
     * @param referenceId   원인 엔티티 ID(optional)
     * @param changedAt     실제 변경 시각
     */
    void publishCashChanged(
            Long companyId,
            Long cash,
            Long changedAmount,
            String reason,
            String referenceId,
            Instant changedAt
    );
}
