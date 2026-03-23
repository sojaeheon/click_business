package com.ssafy.ecosim.domain.market.service;

import com.ssafy.ecosim.domain.market.dto.CandleData;
import com.ssafy.ecosim.domain.market.repository.redis.OrderBookManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
@EnableScheduling
@RequiredArgsConstructor
public class CandleAggregator {

    private final OrderBookManager orderBookManager;
    private final CandleManager candleManager;

    private static final List<Integer> TARGET_ITEM_IDS = List.of(1, 2, 3);

    /**
     * 매 5분마다 실행 (0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55분에 실행)
     * 최근 5분간 시장가를 집계하여 5분봉 생성
     */
    @Scheduled(cron = "0 */5 * * * *")
    public void aggregate5MinCandles() {
        log.info("[CandleAggregator] 5분봉 집계 시작");
        
        for (Integer itemId : TARGET_ITEM_IDS) {
            try {
                CandleData candle = buildCandle(itemId);
                
                if (candle == null) {
                    log.warn("[CandleAggregator] itemId={} 데이터 부족으로 스킵", itemId);
                    continue;
                }
                
                // Redis 저장 (빠른 조회용)
                candleManager.save5MinCandleToRedis(itemId, candle);
                
                // DB 저장 (영구 보관용) - 비동기
                candleManager.save5MinCandleToDB(itemId, candle);
                
                log.info("[CandleAggregator] itemId={} 5분봉 생성 완료: OHLC={}/{}/{}/{}", 
                    itemId, candle.getOpen(), candle.getHigh(), candle.getLow(), candle.getClose());
            } catch (Exception e) {
                log.error("[CandleAggregator] itemId={} 5분봉 생성 실패", itemId, e);
            }
        }
    }

    /**
     * 최근 시장가 데이터를 기반으로 5분봉을 생성합니다.
     */
    private CandleData buildCandle(Integer itemId) {
        // Redis에서 최근 체결 데이터 조회 (market:chart:{itemId})
        List<String> chartData = orderBookManager.getChartData(itemId);
        
        if (chartData == null || chartData.isEmpty()) {
            return null;
        }
        
        // timestamp:price 형식 파싱
        List<PricePoint> prices = new ArrayList<>();
        for (String data : chartData) {
            try {
                String[] parts = data.split(":");
                long timestamp = Long.parseLong(parts[0]);
                long price = Long.parseLong(parts[1]);
                prices.add(new PricePoint(timestamp, price));
            } catch (Exception e) {
                log.warn("[CandleAggregator] 데이터 파싱 실패: {}", data);
            }
        }
        
        if (prices.isEmpty()) {
            return null;
        }
        
        // 시간순 정렬 (오래된 것부터)
        prices.sort((a, b) -> Long.compare(a.timestamp, b.timestamp));
        
        // OHLC 계산
        long open = prices.get(0).price;  // 첫 번째 가격
        long close = prices.get(prices.size() - 1).price;  // 마지막 가격
        long high = prices.stream().mapToLong(p -> p.price).max().orElse(close);
        long low = prices.stream().mapToLong(p -> p.price).min().orElse(close);
        
        // 분봉 시작 시간 (현재 시간을 5분 단위로 내림)
        long now = System.currentTimeMillis();
        long candleStart = roundTo5Min(now) - 300_000; // 5분 전
        
        return CandleData.builder()
            .open(open)
            .high(high)
            .low(low)
            .close(close)
            .volume(0L)  // 추후 체결량 집계 로직 추가 가능
            .timestamp(candleStart)
            .build();
    }

    /**
     * 밀리초를 5분 단위로 내림합니다.
     */
    private long roundTo5Min(long millis) {
        long fiveMin = 5 * 60 * 1000; // 5분 = 300,000ms
        return (millis / fiveMin) * fiveMin;
    }

    /**
     * 내부 클래스: 시장가 데이터 포인트
     */
    private static class PricePoint {
        final long timestamp;
        final long price;
        
        PricePoint(long timestamp, long price) {
            this.timestamp = timestamp;
            this.price = price;
        }
    }
}