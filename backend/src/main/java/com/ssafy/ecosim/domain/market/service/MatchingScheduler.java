package com.ssafy.ecosim.domain.market.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@EnableScheduling
@ConditionalOnProperty(name = "market.matching.enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
public class MatchingScheduler {

    private final MarketMatchingService marketMatchingService;

    // 매칭 대상 아이템 ID (1: 금석, 2: 금괴석, 3: 금 드릴)
    private static final java.util.List<Integer> TARGET_ITEM_IDS = java.util.List.of(1, 2, 3);

    /**
     * 0.1초마다 모든 대상 아이템(1, 2, 3)에 대해 매칭을 실행합니다.
     */
    @Scheduled(fixedRate = 100)
    public void runMatching() {
        for (Integer itemId : TARGET_ITEM_IDS) {
            try {
                marketMatchingService.matchItem(itemId);
            } catch (Exception e) {
                log.error("[MatchingScheduler] 아이템 {} 매칭 실행 중 오류 발생", itemId, e);
            }
        }
    }
}
