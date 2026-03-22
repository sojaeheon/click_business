package com.ssafy.ecosim.domain.market.repository.redis;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component
@RequiredArgsConstructor
public class OrderBookManager {

    // ZSet은 값(Member)으로 OrderId(String 형태)만 들고 있으므로 StringRedisTemplate이 유리
    private final StringRedisTemplate stringRedisTemplate;
    // 주문 상세(Hash) 조회용 (TotalQuantity 합산을 위해)
    private final RedisTemplate<String, Object> redisTemplate;

    // Key 규격
    private static final String BUY_KEY_PREFIX = "market:orderbook:%d:buy";
    private static final String SELL_KEY_PREFIX = "market:orderbook:%d:sell";
    private static final String TICKER_KEY_PREFIX = "market:price:%d";

    private String getBuyKey(Integer itemId) {
        return String.format(BUY_KEY_PREFIX, itemId);
    }

    private String getSellKey(Integer itemId) {
        return String.format(SELL_KEY_PREFIX, itemId);
    }

    /**
     * 매수(Buy) 주문을 호가창에 등록합니다.
     * 
     * @param itemId  아이템 식별자
     * @param orderId 주문 고유 식별자
     * @param score   정렬 기준 점수 (보통 체결 우선순위 가격을 가공한 값)
     */
    public void addBuy(Integer itemId, Long orderId, Double score) {
        stringRedisTemplate.opsForZSet().add(getBuyKey(itemId), String.valueOf(orderId), score);
    }

    /**
     * 매도(Sell) 주문을 호가창에 등록합니다.
     * 
     * @param itemId  아이템 식별자
     * @param orderId 주문 고유 식별자
     * @param score   정렬 기준 점수 (매도는 낮은 가격이 우선 등)
     */
    public void addSell(Integer itemId, Long orderId, Double score) {
        stringRedisTemplate.opsForZSet().add(getSellKey(itemId), String.valueOf(orderId), score);
    }

    public Set<ZSetOperations.TypedTuple<String>> getTopBuys(Integer itemId, int count) {
        return stringRedisTemplate.opsForZSet().rangeWithScores(getBuyKey(itemId), 0, count - 1);
    }


    /**
     * 매도 최우선 호가 세트를 가져옵니다.
     */
    public Set<ZSetOperations.TypedTuple<String>> getTopSells(Integer itemId, int count) {
        return stringRedisTemplate.opsForZSet().rangeWithScores(getSellKey(itemId), 0, count - 1);
    }

    /**
     * 현재 시장가(최근 체결가)를 조회합니다.
     * 매칭 엔진이 체결 시마다 market:price:{item_id} 키에 기록합니다.
     * 아직 체결 이력이 없으면 null을 반환합니다.
     */
    public Long getMarketPrice(Integer itemId) {
        String key = String.format(TICKER_KEY_PREFIX, itemId);
        String value = stringRedisTemplate.opsForValue().get(key);
        if (value == null)
            return null;
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * 최근 체결가를 Redis에 기록합니다 (시장가 갱신).
     * 
     * @param itemId 아이템 ID
     * @param price  체결 가격
     */
    public void setMarketPrice(Integer itemId, Long price) {
        String key = String.format(TICKER_KEY_PREFIX, itemId);
        stringRedisTemplate.opsForValue().set(key, String.valueOf(price));
    }

    /**
     * 호가창에서 특정 주문을 제거합니다 (체결 완료 또는 취소 시).
     */
    public void removeOrder(Integer itemId, String orderType, Long orderId) {
        String key = "BUY".equalsIgnoreCase(orderType) ? getBuyKey(itemId) : getSellKey(itemId);
        stringRedisTemplate.opsForZSet().remove(key, String.valueOf(orderId));
    }

    /**
     * 현재가 ~ 목표가 구간 내 반대편 호가창의 총 미체결 물량을 합산합니다.
     * (Market Sweep 시, 봇이 얼마만큼의 물량을 분배해서 던져야 하는지 계산하기 위함)
     *
     * @param itemId    아이템 식별자
     * @param orderType 봇이 하려는 행동의 반대 타입 (ex: 가격 올리려면 SELL 호가를 스캔)
     * @param minScore  조회할 Score 최솟값 (현재가 기준, 보통 현재가)
     * @param maxScore  조회할 Score 최댓값 (목표가 기준)
     * @return 구간 내 미체결 주문들의 totalQuantity 합산 값
     */
    public long getVolumeInScoreRange(Integer itemId, String orderType, double minScore, double maxScore) {
        String key = "BUY".equalsIgnoreCase(orderType) ? getBuyKey(itemId) : getSellKey(itemId);
        // Score 범위로 OrderId Set 조회
        Set<String> orderIds = stringRedisTemplate.opsForZSet().rangeByScore(key, minScore, maxScore);

        if (orderIds == null || orderIds.isEmpty())
            return 0L;

        long totalVolume = 0L;
        for (String orderId : orderIds) {
            String hashKey = "market:order:" + orderId;
            Object qty = redisTemplate.opsForHash().get(hashKey, "totalQuantity");
            if (qty != null) {
                try {
                    totalVolume += Long.parseLong(qty.toString());
                } catch (NumberFormatException ignored) {
                }
            }
        }
        return totalVolume;
    }
}
