package com.ssafy.ecosim.domain.market.service;

import com.ssafy.ecosim.domain.market.dto.CandleData;
import com.ssafy.ecosim.domain.market.dto.response.CandleResponse;
import com.ssafy.ecosim.domain.market.entity.MarketCandle;
import com.ssafy.ecosim.domain.market.repository.redis.OrderBookManager;
import com.ssafy.ecosim.global.util.GameTimeUtil;
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
    private final GameTimeUtil gameTimeUtil;

    /**
     * 1분봉 데이터를 조회합니다.
     */
    public List<CandleResponse> get1MinCandles(Integer itemId, int count) {
        return getCandles(itemId, count, MarketCandle.CandleType.MIN_1);
    }

    /**
     * 5분봉 데이터를 조회합니다.
     */
    public List<CandleResponse> get5MinCandles(Integer itemId, int count) {
        return getCandles(itemId, count, MarketCandle.CandleType.MIN_5);
    }

    private List<CandleResponse> getCandles(Integer itemId, int count, MarketCandle.CandleType type) {
        List<CandleResponse> result = new ArrayList<>();
        
        // 1. 현재 진행중인 분봉 생성 (isLive = true)
        CandleData currentCandle = buildCurrentCandle(itemId, type);
        if (currentCandle != null) {
            result.add(CandleResponse.from(currentCandle, true));
        }
        
        // 2. 확정된 분봉 조회 (isLive = false)
        List<CandleData> confirmedCandles = candleManager.getCandles(itemId, count - 1, type);
        
        // 3. Redis에 데이터가 없으면 DB에서 조회 후 Redis에 백업
        if (confirmedCandles == null || confirmedCandles.isEmpty()) {
            log.info("[CandleService] Redis에 {} 데이터 없음. DB에서 조회 시작: itemId={}", type, itemId);
            
            List<CandleData> dbCandles = candleManager.getCandlesFromDB(itemId, count - 1, type);
            
            if (!dbCandles.isEmpty()) {
                log.info("[CandleService] DB에서 {}개 {} 조회 완료. Redis로 백업 시작...", dbCandles.size(), type);
                
                // DB 데이터를 Redis에 백업 (역순으로 추가 - 오래된 것부터)
                for (int i = dbCandles.size() - 1; i >= 0; i--) {
                    CandleData candle = dbCandles.get(i);
                    candleManager.saveCandleToRedis(itemId, candle, type);
                }
                
                log.info("[CandleService] Redis 백업 완료: itemId={}, {} 개수={}", itemId, type, dbCandles.size());
                
                // Redis에서 다시 조회 (백업된 데이터)
                confirmedCandles = candleManager.getCandles(itemId, count - 1, type);
            } else {
                log.warn("[CandleService] DB에도 {} 데이터 없음: itemId={}", type, itemId);
            }
        }
        
        if (confirmedCandles != null) {
            for (CandleData candle : confirmedCandles) {
                result.add(CandleResponse.from(candle, false));
            }
        }
        
        return result;
    }

    /**
     * 현재 진행중인 분봉을 실시간 데이터로 생성합니다.
     */
    private CandleData buildCurrentCandle(Integer itemId, MarketCandle.CandleType type) {
        try {
            long now = gameTimeUtil.getCurrentGameTimestamp();
            // 현실 1분 = 게임 144분 = 8,640,000ms
            long durationMillis = (type == MarketCandle.CandleType.MIN_1) ? 8_640_000L : 43_200_000L;
            long candleStart = roundToDuration(now, durationMillis);
            
            // Redis에서 최근 체결 데이터 조회
            List<String> chartData = orderBookManager.getChartData(itemId);
            
            if (chartData == null || chartData.isEmpty()) {
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
            
            List<PricePoint> prices = new ArrayList<>();
            for (String data : chartData) {
                try {
                    String[] parts = data.split(":");
                    long timestamp = Long.parseLong(parts[0]);
                    long price = Long.parseLong(parts[1]);
                    
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
            
            prices.sort((a, b) -> Long.compare(a.timestamp, b.timestamp));
            
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
            log.error("[CandleService] 현재 {} 생성 실패", type, e);
            return null;
        }
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