package com.ssafy.ecosim.domain.market.service;

import com.ssafy.ecosim.domain.market.dto.CandleData;
import com.ssafy.ecosim.domain.market.entity.MarketCandle;
import com.ssafy.ecosim.domain.market.repository.redis.OrderBookManager;
import com.ssafy.ecosim.global.util.GameTimeUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * 게임 시간 경계(144분 = 현실 1분)마다 확정 캔들을 생성합니다.
 *
 * GameTimeScheduler에서 직접 호출됩니다.
 * Redis의 market:chart:{itemId} 리스트에 쌓인 모든 체결가를 소비하여 OHLC를 계산합니다.
 * 캔들 생성 후 chart 데이터를 초기화하여 다음 캔들이 중복 집계되지 않도록 합니다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CandleAggregator {

    private final OrderBookManager orderBookManager;
    private final CandleManager candleManager;
    private final GameTimeUtil gameTimeUtil;

    private static final List<Integer> TARGET_ITEM_IDS = List.of(1, 2, 3);

    // 현실 1분 = 게임 144분 = 8,640초 (게임 누적초 단위)
    public static final long CANDLE_1MIN_GAME_SECONDS = 8_640L;
    // 현실 5분 = 게임 720분 = 43,200초 (게임 누적초 단위)
    public static final long CANDLE_5MIN_GAME_SECONDS = 43_200L;

    /**
     * GameTimeScheduler에서 1분봉 경계 시 호출합니다.
     *
     * @param candleStartMillis 이 캔들의 시작 시각 (게임 epoch millis)
     */
    public void aggregate1MinCandleAt(long candleStartMillis) {
        aggregateCandlesAt(candleStartMillis, MarketCandle.CandleType.MIN_1);
    }

    /**
     * GameTimeScheduler에서 5분봉 경계 시 호출합니다.
     *
     * @param candleStartMillis 이 캔들의 시작 시각 (게임 epoch millis)
     */
    public void aggregate5MinCandleAt(long candleStartMillis) {
        aggregateCandlesAt(candleStartMillis, MarketCandle.CandleType.MIN_5);
    }

    private void aggregateCandlesAt(long candleStartMillis, MarketCandle.CandleType type) {
        log.info("[CandleAggregator] {} 집계 시작 (candleStart={})", type, candleStartMillis);

        for (Integer itemId : TARGET_ITEM_IDS) {
            try {
                // 1분봉은 체결 버퍼로 만들고, 5분봉은 최근 1분봉 5개를 합친다.
                CandleData candle = type == MarketCandle.CandleType.MIN_1
                    ? buildCandle(itemId, candleStartMillis)
                    : buildFiveMinuteCandle(itemId, candleStartMillis);

                if (candle == null && type == MarketCandle.CandleType.MIN_1) {
                    candle = buildReferenceCandle(itemId, candleStartMillis);
                }

                if (candle == null) {
                    log.warn("[CandleAggregator] itemId={} {} 체결 데이터 없음 → 현재가 보합 캔들", itemId, type);
                    candle = buildFlatCandle(itemId, candleStartMillis);
                }

                if (candle == null) {
                    log.warn("[CandleAggregator] itemId={} {} 현재가도 없음, 스킵", itemId, type);
                    continue;
                }

                // 원시 체결 버퍼는 1분봉만 소비한다.
                if (type == MarketCandle.CandleType.MIN_1) {
                    orderBookManager.clearChartData(itemId);
                    orderBookManager.clearReferenceChartData(itemId);
                }

                candleManager.saveCandleToRedis(itemId, candle, type);
                candleManager.saveCandleToDB(itemId, candle, type);

                log.info("[CandleAggregator] itemId={} {} 생성 완료: OHLC={}/{}/{}/{}",
                    itemId, type, candle.getOpen(), candle.getHigh(), candle.getLow(), candle.getClose());
            } catch (Exception e) {
                log.error("[CandleAggregator] itemId={} {} 생성 실패", itemId, type, e);
            }
        }
    }

    /**
     * Redis chart 데이터 전체를 소비하여 OHLC 캔들 생성.
     * 타임스탬프 범위 필터 없이 현재 리스트에 있는 모든 체결가를 사용합니다.
     */
    private CandleData buildCandle(Integer itemId, long candleStartMillis) {
        List<String> chartData = orderBookManager.getChartData(itemId);

        if (chartData == null || chartData.isEmpty()) {
            return null;
        }

        List<Long> prices = new ArrayList<>();
        long volume = 0L;
        for (String data : chartData) {
            try {
                // 신규 형식: "timestamp:price:quantity". 기존 형식도 읽는다.
                String[] parts = data.split(":");
                long price = Long.parseLong(parts[1]);
                prices.add(price);
                if (parts.length >= 3) {
                    volume += Long.parseLong(parts[2]);
                }
            } catch (Exception e) {
                log.warn("[CandleAggregator] 데이터 파싱 실패: {}", data);
            }
        }

        if (prices.isEmpty()) {
            return null;
        }

        long open  = prices.get(0);
        long close = prices.get(prices.size() - 1);
        long high  = prices.stream().mapToLong(Long::longValue).max().orElse(close);
        long low   = prices.stream().mapToLong(Long::longValue).min().orElse(close);

        return CandleData.builder()
            .open(open).high(high).low(low).close(close)
            .volume(volume).timestamp(candleStartMillis)
            .build();
    }

    private CandleData buildFiveMinuteCandle(Integer itemId, long candleStartMillis) {
        List<CandleData> oneMinuteCandles = new ArrayList<>(
            candleManager.getCandles(itemId, 5, MarketCandle.CandleType.MIN_1)
        );
        if (oneMinuteCandles.isEmpty()) {
            return null;
        }

        oneMinuteCandles.sort(Comparator.comparingLong(CandleData::getTimestamp));
        CandleData first = oneMinuteCandles.get(0);
        CandleData last = oneMinuteCandles.get(oneMinuteCandles.size() - 1);
        long high = oneMinuteCandles.stream().mapToLong(CandleData::getHigh).max().orElse(last.getClose());
        long low = oneMinuteCandles.stream().mapToLong(CandleData::getLow).min().orElse(last.getClose());
        long volume = oneMinuteCandles.stream().mapToLong(CandleData::getVolume).sum();

        return CandleData.builder()
            .open(first.getOpen())
            .high(high)
            .low(low)
            .close(last.getClose())
            .volume(volume)
            .timestamp(candleStartMillis)
            .build();
    }

    /**
     * Builds a zero-volume candle from the external-index reference samples.
     * These samples move the chart while the market is idle without creating
     * fake trades or fake volume.
     */
    private CandleData buildReferenceCandle(Integer itemId, long candleStartMillis) {
        List<String> samples = orderBookManager.getReferenceChartData(itemId);
        if (samples == null || samples.isEmpty()) return null;

        List<Long> prices = new ArrayList<>();
        for (String sample : samples) {
            try {
                String[] parts = sample.split(":");
                prices.add(Long.parseLong(parts[1]));
            } catch (Exception e) {
                log.warn("[CandleAggregator] invalid reference sample: {}", sample);
            }
        }
        if (prices.isEmpty()) return null;

        long open = prices.get(0);
        long close = prices.get(prices.size() - 1);
        long high = prices.stream().mapToLong(Long::longValue).max().orElse(close);
        long low = prices.stream().mapToLong(Long::longValue).min().orElse(close);
        return CandleData.builder()
            .open(open).high(high).low(low).close(close)
            .volume(0L).timestamp(candleStartMillis)
            .build();
    }

    /**
     * 체결 데이터가 없을 때 현재가 기준 보합(Flat) 캔들 생성.
     */
    private CandleData buildFlatCandle(Integer itemId, long candleStartMillis) {
        Long price = orderBookManager.getReferencePrice(itemId);
        if (price == null) {
            price = orderBookManager.getMarketPrice(itemId);
        }
        if (price == null) return null;

        return CandleData.builder()
            .open(price).high(price).low(price).close(price)
            .volume(0L).timestamp(candleStartMillis)
            .build();
    }
}
