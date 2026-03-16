package com.ssafy.ecosim.domain.market.service;

import com.ssafy.ecosim.domain.market.repository.redis.OrderBookManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class MatchingEngineScheduler {

    private final OrderBookManager orderBookManager;
    private final MarketMatchingService marketMatchingService;

    // 1초마다 모든 활성 아이템에 대해 매칭 엔진을 가동합니다.
    @Scheduled(fixedRate = 1000)
    public void runMatchingEngine() {
        // Redis에서 현재 주문이 존재하는 모든 아이템 ID를 가져옴
        Set<Integer> activeItemIds = orderBookManager.getActiveItemIds();

        if (activeItemIds.isEmpty()) {
            return;
        }

        log.debug("Matching Engine Tick: Found {} active items", activeItemIds.size());

        for (Integer itemId : activeItemIds) {
            try {
                marketMatchingService.matchItem(itemId);
            } catch (Exception e) {
                log.error("Error matching item {}: {}", itemId, e.getMessage(), e);
            }
        }
    }
}
