package com.ssafy.ecosim.domain.market.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@EnableScheduling
@RequiredArgsConstructor
public class MatchingScheduler {

    private final MarketMatchingService marketMatchingService;

    /**
     * 1초마다 금(itemId=1) 아이템에 대한 매칭을 실행합니다.
     */
    @Scheduled(fixedRate = 1000)
    public void runMatching() {
        try {
            marketMatchingService.matchItem(1);
        } catch (Exception e) {
            log.error("[MatchingScheduler] 매칭 실행 중 오류 발생", e);
        }
    }
}