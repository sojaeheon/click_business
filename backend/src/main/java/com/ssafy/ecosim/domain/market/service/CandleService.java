package com.ssafy.ecosim.domain.market.service;

import com.ssafy.ecosim.domain.market.dto.CandleData;
import com.ssafy.ecosim.domain.market.dto.response.CandleResponse;
import com.ssafy.ecosim.domain.market.repository.redis.OrderBookManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class CandleService {

    private final CandleManager candleManager;
    private final OrderBookManager orderBookManager;

    /**
     * 5분봉 데이터를 조회합니다.
     * - 확정된 분봉: Redis에서 조회
     * - 현재 진행중인 분봉: 실시간 시장가로 생성
     */
    public List<CandleResponse> get5MinCandles(Integer itemId, int count) {
        List<CandleResponse> result = new ArrayList<>();
        
        // 1. 현재 진행중인 분봉 생성 (isLive = true)
        CandleData currentCandle = buildCurrentCandle(itemId);
        if (currentCandle != null) {
            result.add(CandleResponse.from(currentCandle, true));
        }
        
        // 2. 확정된 분봉 조회 (isLive = false)
        List<CandleData> confirmedCandles = candleManager.get5MinCandles(itemId, count - 1);
        for (CandleData candle : confirmedCandles) {
            result.add(CandleResponse.from(candle, false));
        }
        
        return result;
    }

    /**
     * 현재 진행중인 5분봉을 실시간 데이터로 생성합니다.
     */
    private CandleData buildCurrentCandle(Integer itemId) {
        try {
            long now = System.currentTimeMillis();
            long candleStart = roundTo5Min(now); // 현재 5분봉 시작 시간
            
            // Redis에서 최근 체결 데이터 조회
            List<String> chartData = orderBookManager.getChartData(itemId);
            
            if (chartData == null || chartData.isEmpty()) {
                // 데이터가 없으면 현재 시장가로 대체
                Long currentPrice = orderBookManager.getMarketPrice(itemId);
                if (currentPrice == null) return null;
                
                return CandleData.builder()
                    .open(currentPrice)
                    .high(currentPrice)
                    .low(currentPrice)
                    .close(currentPrice)
                    .volume(0L)
                    .timestamp(candleStart)
                    .build();
            }
            
            // timestamp:price 형식 파싱
            List<PricePoint> prices = new ArrayList<>();
            for (String data : chartData) {
                try {
                    String[] parts = data.split(":");
                    long timestamp = Long.parseLong(parts[0]);
                    long price = Long.parseLong(parts[1]);
                    
                    // 현재 5분봉 범위 내의 데이터만 포함
                    if (timestamp >= candleStart) {
                        prices.add(new PricePoint(timestamp, price));
                    }
                } catch (Exception e) {
                    log.warn("[CandleService] 데이터 파싱 실패: {}", data);
                }
            }
            
            if (prices.isEmpty()) {
                Long currentPrice = orderBookManager.getMarketPrice(itemId);
                if (currentPrice == null) return null;
                
                return CandleData.builder()
                    .open(currentPrice)
                    .high(currentPrice)
                    .low(currentPrice)
                    .close(currentPrice)
                    .volume(0L)
                    .timestamp(candleStart)
                    .build();
            }
            
            // 시간순 정렬
            prices.sort((a, b) -> Long.compare(a.timestamp, b.timestamp));
            
            // OHLC 계산
            long open = prices.get(0).price;
            long close = prices.get(prices.size() - 1).price;
            long high = prices.stream().mapToLong(p -> p.price).max().orElse(close);
            long low = prices.stream().mapToLong(p -> p.price).min().orElse(close);
            
            return CandleData.builder()
                .open(open)
                .high(high)
                .low(low)
                .close(close)
                .volume(0L)
                .timestamp(candleStart)
                .build();
        } catch (Exception e) {
            log.error("[CandleService] 현재 분봉 생성 실패", e);
            return null;
        }
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