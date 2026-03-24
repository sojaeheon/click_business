package com.ssafy.ecosim.domain.market.service;
    
import com.ssafy.ecosim.domain.market.dto.CandleData;
import com.ssafy.ecosim.domain.market.entity.MarketCandle;
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
     * 매 1분마다 실행
     * 최근 1분간 시장가를 집계하여 1분봉 생성
     */
    @Scheduled(cron = "0 * * * * *")
    public void aggregate1MinCandles() {
        aggregateCandles(MarketCandle.CandleType.MIN_1);
    }

    /**
     * 매 5분마다 실행
     * 최근 5분간 시장가를 집계하여 5분봉 생성
     */
    @Scheduled(cron = "0 */5 * * * *")
    public void aggregate5MinCandles() {
        aggregateCandles(MarketCandle.CandleType.MIN_5);
    }

    private void aggregateCandles(MarketCandle.CandleType type) {
        log.info("[CandleAggregator] {} 집계 시작", type);
        
        for (Integer itemId : TARGET_ITEM_IDS) {
            try {
                CandleData candle = buildCandle(itemId, type);
                
                if (candle == null) {
                    log.warn("[CandleAggregator] itemId={} {} 데이터 부족으로 스킵", itemId, type);
                    continue;
                }
                
                // Redis 저장
                candleManager.saveCandleToRedis(itemId, candle, type);
                
                // DB 저장
                candleManager.saveCandleToDB(itemId, candle, type);
                
                log.info("[CandleAggregator] itemId={} {} 생성 완료: OHLC={}/{}/{}/{}", 
                    itemId, type, candle.getOpen(), candle.getHigh(), candle.getLow(), candle.getClose());
            } catch (Exception e) {
                log.error("[CandleAggregator] itemId={} {} 생성 실패", itemId, type, e);
            }
        }
    }

    /**
     * 최근 시장가 데이터를 기반으로 분봉을 생성합니다.
     */
    private CandleData buildCandle(Integer itemId, MarketCandle.CandleType type) {
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
        long open = prices.get(0).price;
        long close = prices.get(prices.size() - 1).price;
        long high = prices.stream().mapToLong(p -> p.price).max().orElse(close);
        long low = prices.stream().mapToLong(p -> p.price).min().orElse(close);
        
        long now = System.currentTimeMillis();
        long durationMillis = (type == MarketCandle.CandleType.MIN_1) ? 60_000 : 300_000;
        long candleStart = roundToDuration(now, durationMillis) - durationMillis;
        
        return CandleData.builder()
            .open(open)
            .high(high)
            .low(low)
            .close(close)
            .volume(0L)
            .timestamp(candleStart)
            .build();
    }

    private long roundToDuration(long millis, long durationMillis) {
        return (millis / durationMillis) * durationMillis;
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