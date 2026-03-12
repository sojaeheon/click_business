package com.ssafy.ecosim.domain.market.repository.redis;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component
@RequiredArgsConstructor
public class OrderBookManager {

    // ZSet은 값(Member)으로 OrderId(String 형태)만 들고 있으므로 StringRedisTemplate이 유리
    private final StringRedisTemplate stringRedisTemplate;
    
    // Key 규격
    private static final String BID_KEY_PREFIX = "market:orderbook:%d:bids";
    private static final String ASK_KEY_PREFIX = "market:orderbook:%d:asks";

    private String getBidKey(Integer itemId) {
        return String.format(BID_KEY_PREFIX, itemId);
    }

    private String getAskKey(Integer itemId) {
        return String.format(ASK_KEY_PREFIX, itemId);
    }

    /**
     * 매수(Bid) 주문을 호가창에 등록합니다.
     * 비쌀수록 우선순위가 높기 때문에 가격(price)을 기준으로 내림차순 조회를 해야합니다.
     * 동점일 경우 시간 우선(더 일찍 주문한 사람이 먼저 체결)을 위해 정밀한 Score 설계가 필요합니다.
     */
    public void addBid(Integer itemId, Long orderId, Double score) {
        stringRedisTemplate.opsForZSet().add(getBidKey(itemId), String.valueOf(orderId), score);
    }

    /**
     * 매도(Ask) 주문을 호가창에 등록합니다.
     * 쌀수록 우선순위가 높기 때문에 가격(price)을 기준으로 오름차순 조회를 합니다.
     */
    public void addAsk(Integer itemId, Long orderId, Double score) {
        stringRedisTemplate.opsForZSet().add(getAskKey(itemId), String.valueOf(orderId), score);
    }

    /**
     * 가장 비싸게 사려는 매수 주문 상위 N개를 조회 (내림차순, ZREVRANGE)
     */
    public Set<ZSetOperations.TypedTuple<String>> getTopBids(Integer itemId, int count) {
        return stringRedisTemplate.opsForZSet().reverseRangeWithScores(getBidKey(itemId), 0, count - 1);
    }

    /**
     * 가장 싸게 팔려는 매도 주문 상위 N개를 조회 (오름차순, ZRANGE)
     */
    public Set<ZSetOperations.TypedTuple<String>> getTopAsks(Integer itemId, int count) {
        return stringRedisTemplate.opsForZSet().rangeWithScores(getAskKey(itemId), 0, count - 1);
    }

    /**
     * 주문이 체결 또는 취소되었을 때 해당 호가창에서 제거 (ZREM)
     */
    public void removeOrderFromBook(Integer itemId, String orderType, Long orderId) {
        String key = "BUY".equalsIgnoreCase(orderType) ? getBidKey(itemId) : getAskKey(itemId);
        stringRedisTemplate.opsForZSet().remove(key, String.valueOf(orderId));
    }
}
