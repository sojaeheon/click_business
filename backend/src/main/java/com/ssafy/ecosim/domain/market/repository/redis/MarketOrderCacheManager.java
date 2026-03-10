package com.ssafy.ecosim.domain.market.repository.redis;

import com.ssafy.ecosim.domain.market.entity.MarketOrder;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

@Component
@RequiredArgsConstructor
public class MarketOrderCacheManager {

    private final RedisTemplate<String, Object> redisTemplate;
    private static final String KEY_PREFIX = "market:order:";
    // 메모리 누수 방지를 위한 TTL 설정 (예: 1시간)
    private static final long CACHE_TTL_HOURS = 1L;

    private String getKey(Long orderId) {
        return KEY_PREFIX + orderId;
    }

    /**
     * DB에 저장된 주문 객체를 Redis Hash 속성들로 분산 적재합니다.
     */
    public void saveOrderCache(MarketOrder order) {
        String key = getKey(order.getId());
        
        // 객체 전체를 한 번에 저장 (GenericJackson2JsonRedisSerializer 덕분에 자동 변환됨)
        redisTemplate.opsForValue().set(key, order, CACHE_TTL_HOURS, TimeUnit.HOURS);
    }

    /**
     * 주문 객체를 통째로 캐시에서 읽어옵니다.
     */
    public MarketOrder getOrderCache(Long orderId) {
        String key = getKey(orderId);
        Object value = redisTemplate.opsForValue().get(key);
        if (value instanceof MarketOrder) {
            return (MarketOrder) value;
        }
        return null;
    }

    /**
     * 주문 체결 또는 취소 시 캐시에서 삭제합니다.
     */
    public void removeOrderCache(Long orderId) {
        redisTemplate.delete(getKey(orderId));
    }
}
