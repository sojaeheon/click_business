package com.ssafy.ecosim.domain.market.repository.redis;

import com.ssafy.ecosim.domain.market.entity.MarketOrder;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.TimeUnit;

@Component
@RequiredArgsConstructor
public class OrderDetailsCacheManager {

    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper; // Spring Boot 기본 제공 객체 매퍼

    private static final String KEY_PREFIX = "market:order:";
    // 메모리 누수 방지를 위한 TTL 설정 (예: 1시간)
    private static final long CACHE_TTL_HOURS = 1L;

    private String getKey(Long orderId) {
        return KEY_PREFIX + orderId;
    }

    /**
     * [매칭 엔진 / 워커 전용]
     * Kafka에서 수신한 체결 대기 누적 주문 객체를 매칭 처리를 위해 Redis Hash(HSET)로 개별 저장합니다.
     * (주의: API 서버(MarketOrderService)에서 직접 호출하지 않으며, 이벤트를 컨슘하는 주체가 호출해야 합니다.)
     */
    public void saveOrderCache(MarketOrder order) {
        String key = getKey(order.getId());

        // Java 객체 필드들을 Key-Value 형태의 Map으로 분해 (개발자 가시성 확보)
        Map<String, Object> orderMap = objectMapper.convertValue(order, Map.class);

        // 필드 단위로 Hash (서랍장 구조)에 쏙쏙 분산 적재
        redisTemplate.opsForHash().putAll(key, orderMap);

        // 만료 시간 설정
        redisTemplate.expire(key, CACHE_TTL_HOURS, TimeUnit.HOURS);
    }

    /**
     * Hash 캐시에서 필드들을 꺼내어 다시 하나의 주문 객체로 조립합니다.
     */
    public MarketOrder getOrderCache(Long orderId) {
        String key = getKey(orderId);

        // Hash에 저장된 모든 필드 꺼내오기 (HGETALL)
        Map<Object, Object> orderMap = redisTemplate.opsForHash().entries(key);

        if (orderMap == null || orderMap.isEmpty()) {
            return null;
        }

        // Map 형태의 데이터를 원래의 MarketOrder 객체로 통째 조립
        return objectMapper.convertValue(orderMap, MarketOrder.class);
    }

    /**
     * 주문 체결 또는 취소 시 캐시에서 삭제합니다.
     */
    public void removeOrderCache(Long orderId) {
        redisTemplate.delete(getKey(orderId));
    }
}
