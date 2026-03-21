package com.ssafy.ecosim.domain.market.repository.redis;

import com.ssafy.ecosim.domain.market.entity.MarketOrder;
import com.ssafy.ecosim.domain.market.entity.OrderType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
@RequiredArgsConstructor
public class OrderDetailsCacheManager {

    private final StringRedisTemplate redisTemplate;

    private static final String KEY_PREFIX = "market:order:";
    private static final long CACHE_TTL_HOURS = 1L;

    private String getKey(Long orderId) {
        return KEY_PREFIX + orderId;
    }

    /**
     * MarketOrder 객체를 필드 단위의 문자열 Hash로 Redis에 저장합니다.
     */
    public void saveOrderCache(MarketOrder order) {
        String key = getKey(order.getId());
        Map<String, String> fields = Map.of(
                "itemId", String.valueOf(order.getItemId()),
                "orderType", order.getOrderType().name(),
                "price", String.valueOf(order.getPrice()),
                "remainingQuantity", String.valueOf(order.getRemainingQuantity()),
                "totalQuantity", String.valueOf(order.getTotalQuantity()),
                "status", order.getStatus().name(),
                "isVirtual", String.valueOf(order.getIsVirtual()));
        redisTemplate.opsForHash().putAll(key, fields);
        redisTemplate.expire(key, CACHE_TTL_HOURS, TimeUnit.HOURS);
    }

    /**
     * Hash 캐시의 문자열 필드를 직접 파싱해 MarketOrder 객체를 재조립합니다.
     * CLI(redis-cli HSET)로 주입된 순수 문자열 데이터와도 호환됩니다.
     */
    public MarketOrder getOrderCache(Long orderId) {
        String key = getKey(orderId);
        Map<Object, Object> map = redisTemplate.opsForHash().entries(key);

        if (map == null || map.isEmpty())
            return null;

        try {
            Long parsedOrderId = Long.parseLong(String.valueOf(map.getOrDefault("orderId", orderId.toString())));
            Integer itemId = Integer.parseInt(String.valueOf(map.getOrDefault("itemId", "1")));
            OrderType orderType = OrderType.valueOf(String.valueOf(map.getOrDefault("orderType", "BUY")));
            Long price = Long.parseLong(String.valueOf(map.getOrDefault("price", "0")));
            Long remainingQty = Long.parseLong(String.valueOf(map.getOrDefault("remainingQuantity", "0")));
            Long totalQty = Long.parseLong(String.valueOf(map.getOrDefault("totalQuantity", remainingQty.toString())));
            String isVirtualStr = String.valueOf(map.getOrDefault("isVirtual", "0"));
            Boolean isVirtual = "1".equals(isVirtualStr) || "true".equalsIgnoreCase(isVirtualStr);
            
            String statusStr = String.valueOf(map.get("status"));
            com.ssafy.ecosim.domain.market.entity.OrderStatus status;
            try {
                status = com.ssafy.ecosim.domain.market.entity.OrderStatus.valueOf(statusStr.toUpperCase());
            } catch (IllegalArgumentException ex) {
                log.error("Invalid OrderStatus in Redis cache for orderId={}: '{}'. Allowed values are PENDING, PARTIALLY_COMPLETED, COMPLETED, CANCELED.", parsedOrderId, statusStr);
                throw ex; // Re-throw to ensure cache parsing fails and returns null
            }

            return MarketOrder.builder()
                    .id(parsedOrderId)
                    .itemId(itemId)
                    .companyId(0L) // 조회 목적 전용 (companyId 불필요)
                    .orderType(orderType)
                    .price(price)
                    .totalQuantity(totalQty)
                    .remainingQuantity(remainingQty)
                    .status(status)
                    .isVirtual(isVirtual)
                    .build();
        } catch (Exception e) {
            log.error("Failed to parse OrderDetails from Redis cache for orderId={}: {}", orderId, e.getMessage());
            return null;
        }
    }

    /**
     * 주문 체결 또는 취소 시 캐시에서 삭제합니다.
     */
    public void removeOrderCache(Long orderId) {
        redisTemplate.delete(getKey(orderId));
    }
}
