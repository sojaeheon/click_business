package com.ssafy.ecosim.domain.market.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.ecosim.domain.market.dto.CandleData;
import com.ssafy.ecosim.domain.market.entity.MarketCandle;
import com.ssafy.ecosim.domain.market.repository.MarketCandleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class CandleManager {

    private final StringRedisTemplate stringRedisTemplate;
    private final MarketCandleRepository marketCandleRepository;
    private final ObjectMapper objectMapper;

    private static final String CANDLE_KEY_5M_PREFIX = "market:candle:5m:%d";
    private static final String CANDLE_KEY_1M_PREFIX = "market:candle:1m:%d";
    private static final int MAX_REDIS_CANDLES = 120; // 120개 유지

    /**
     * 분봉을 Redis에 저장합니다.
     */
    public void saveCandleToRedis(Integer itemId, CandleData candle, MarketCandle.CandleType type) {
        try {
            String key = (type == MarketCandle.CandleType.MIN_1) 
                ? String.format(CANDLE_KEY_1M_PREFIX, itemId) 
                : String.format(CANDLE_KEY_5M_PREFIX, itemId);
            
            String value = objectMapper.writeValueAsString(candle);
            
            // ZSet에 추가 (Score: timestamp)
            stringRedisTemplate.opsForZSet().add(key, value, candle.getTimestamp().doubleValue());
            
            // 최근 120개만 유지 (오래된 것 제거)
            Long count = stringRedisTemplate.opsForZSet().zCard(key);
            if (count != null && count > MAX_REDIS_CANDLES) {
                stringRedisTemplate.opsForZSet().removeRange(key, 0, count - MAX_REDIS_CANDLES - 1);
            }
            
            log.debug("[CandleManager] Redis 저장 ({}): itemId={}, timestamp={}", type, itemId, candle.getTimestamp());
        } catch (Exception e) {
            log.error("[CandleManager] Redis 저장 실패 ({})", type, e);
        }
    }

    /**
     * 개별 값을 받아 분봉을 Redis에 추가합니다. (CandleService 백업용)
     */
    public void addCandle(Integer itemId, MarketCandle.CandleType type, Long open, Long high, Long low, Long close, Long volume, LocalDateTime candleTime) {
        long timestamp = candleTime.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
        
        CandleData candle = CandleData.builder()
            .open(open)
            .high(high)
            .low(low)
            .close(close)
            .volume(volume)
            .timestamp(timestamp)
            .build();
            
        saveCandleToRedis(itemId, candle, type);
    }

    /**
     * 분봉을 DB에 비동기로 저장합니다.
     */
    @Async
    public void saveCandleToDB(Integer itemId, CandleData candle, MarketCandle.CandleType type) {
        try {
            LocalDateTime candleTime = LocalDateTime.ofInstant(
                Instant.ofEpochMilli(candle.getTimestamp()), 
                ZoneId.systemDefault()
            );
            
            MarketCandle entity = MarketCandle.builder()
                .itemId(itemId)
                .candleType(type)
                .openPrice(candle.getOpen())
                .highPrice(candle.getHigh())
                .lowPrice(candle.getLow())
                .closePrice(candle.getClose())
                .volume(candle.getVolume())
                .candleTime(candleTime)
                .build();
            
            marketCandleRepository.save(entity);
            log.debug("[CandleManager] DB 저장 ({}): itemId={}, candleTime={}", type, itemId, candleTime);
        } catch (Exception e) {
            log.error("[CandleManager] DB 저장 실패 ({})", type, e);
        }
    }

    /**
     * Redis에서 최근 N개의 분봉을 조회합니다.
     */
    public List<CandleData> getCandles(Integer itemId, int count, MarketCandle.CandleType type) {
        try {
            String key = (type == MarketCandle.CandleType.MIN_1) 
                ? String.format(CANDLE_KEY_1M_PREFIX, itemId) 
                : String.format(CANDLE_KEY_5M_PREFIX, itemId);
            
            // reverseRangeWithScores로 명시적 순서 보장
            Set<ZSetOperations.TypedTuple<String>> valuesWithScores = 
                stringRedisTemplate.opsForZSet().reverseRangeWithScores(key, 0, count - 1);
            
            if (valuesWithScores == null || valuesWithScores.isEmpty()) {
                log.warn("[CandleManager] Redis에 분봉 데이터 없음 ({}): itemId={}", type, itemId);
                return new ArrayList<>();
            }
            
            log.debug("[CandleManager] Redis에서 {}개 분봉 조회 ({}): itemId={}", valuesWithScores.size(), type, itemId);
            
            List<CandleData> candles = new ArrayList<>();
            for (ZSetOperations.TypedTuple<String> tuple : valuesWithScores) {
                try {
                    CandleData candle = objectMapper.readValue(tuple.getValue(), CandleData.class);
                    candles.add(candle);
                } catch (Exception e) {
                    log.warn("[CandleManager] JSON 파싱 실패: {}", tuple.getValue(), e);
                }
            }
            
            return candles;
        } catch (Exception e) {
            log.error("[CandleManager] Redis 조회 실패 ({})", type, e);
            return new ArrayList<>();
        }
    }

    /**
     * DB에서 최근 N개의 분봉을 조회합니다 (Redis 백업용).
     */
    public List<CandleData> getCandlesFromDB(Integer itemId, int count, MarketCandle.CandleType type) {
        try {
            List<MarketCandle> entities = marketCandleRepository
                .findTop100ByItemIdAndCandleTypeOrderByCandleTimeDesc(itemId, type);
            
            return entities.stream()
                .limit(count)
                .map(entity -> CandleData.builder()
                    .open(entity.getOpenPrice())
                    .high(entity.getHighPrice())
                    .low(entity.getLowPrice())
                    .close(entity.getClosePrice())
                    .volume(entity.getVolume())
                    .timestamp(entity.getCandleTime()
                        .atZone(ZoneId.systemDefault())
                        .toInstant()
                        .toEpochMilli())
                    .build())
                .toList();
        } catch (Exception e) {
            log.error("[CandleManager] DB 조회 실패 ({})", type, e);
            return new ArrayList<>();
        }
    }
}
