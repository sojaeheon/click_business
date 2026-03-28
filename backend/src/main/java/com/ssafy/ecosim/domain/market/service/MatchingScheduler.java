package com.ssafy.ecosim.domain.market.service;

import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Slf4j
@Component
@EnableScheduling
@RequiredArgsConstructor
public class MatchingScheduler {

    private final MarketMatchingService marketMatchingService;

    // 매칭 대상 아이템 ID (1: 금석, 2: 금괴석, 3: 금 드릴)
    private static final List<Integer> TARGET_ITEM_IDS = List.of(1, 2, 3);

    // 아이템별 전용 스레드 — 각 아이템이 서로 블로킹하지 않고 독립적으로 매칭 실행
    private final ExecutorService matchingExecutor = Executors.newFixedThreadPool(TARGET_ITEM_IDS.size());

    @PreDestroy
    public void shutdown() {
        matchingExecutor.shutdown();
    }

    /**
     * 100ms마다 모든 아이템 매칭을 병렬로 실행합니다.
     * 아이템별 전용 스레드를 사용하여 한 아이템의 매칭이 다른 아이템을 블로킹하지 않습니다.
     */
    @Scheduled(fixedRate = 100)
    public void runMatching() {
        for (Integer itemId : TARGET_ITEM_IDS) {
            matchingExecutor.submit(() -> {
                try {
                    marketMatchingService.matchItem(itemId);
                } catch (Exception e) {
                    log.error("[MatchingScheduler] 아이템 {} 매칭 실행 중 오류 발생", itemId, e);
                }
            });
        }
    }
}