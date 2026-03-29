package com.ssafy.ecosim.domain.market.repository.redis;

import com.ssafy.ecosim.domain.market.entity.MarketOrder;
import com.ssafy.ecosim.domain.market.entity.OrderType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.SessionCallback;
import org.springframework.data.redis.core.RedisOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
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
        saveOrderCache(order, null);
    }

    /**
     * 주문 상세 캐시를 저장하며, 필요 시 게임시간 기준 updatedAt(epoch millis)을 함께 기록합니다.
     */
    public void saveOrderCache(MarketOrder order, Long updatedAtMillis) {
        String key = getKey(order.getId());
        java.util.Map<String, String> fields = new java.util.HashMap<>();
        fields.put("itemId", String.valueOf(order.getItemId()));
        fields.put("orderId", String.valueOf(order.getId()));
        fields.put("orderType", order.getOrderType().name());
        fields.put("price", String.valueOf(order.getPrice()));
        fields.put("remainingQuantity", String.valueOf(order.getRemainingQuantity()));
        fields.put("totalQuantity", String.valueOf(order.getTotalQuantity()));
        fields.put("status", order.getStatus().name());
        fields.put("companyId", String.valueOf(order.getCompanyId()));
        fields.put("isVirtual", String.valueOf(order.getIsVirtual()));
        if (updatedAtMillis != null) {
            fields.put("updatedAt", String.valueOf(updatedAtMillis));
        }
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

            String companyIdStr = String.valueOf(map.getOrDefault("companyId", "0"));
            if (companyIdStr.startsWith("c")) companyIdStr = companyIdStr.substring(1);
            Long companyId = Long.parseLong(companyIdStr);
            
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
                    .companyId(companyId)
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
     * 여러 주문의 price + remainingQuantity를 Redis Pipeline으로 일괄 조회합니다.
     * 호가창 집계 전용 — HGETALL 대신 HMGET으로 필요한 2개 필드만 읽어 네트워크 왕복을 1회로 줄입니다.
     *
     * @param orderIds 조회할 주문 ID 목록
     * @return orderId → long[]{price, remainingQuantity} 맵 (캐시 미스 항목은 포함되지 않음)
     */
    @SuppressWarnings("unchecked")
    public Map<Long, long[]> getOrderPriceAndQtyBatch(List<Long> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) return Map.of();

        List<Object> results = redisTemplate.executePipelined(new SessionCallback<Object>() {
            @Override
            @SuppressWarnings("rawtypes")
            public Object execute(RedisOperations operations) {
                for (Long orderId : orderIds) {
                    operations.opsForHash().multiGet(
                            getKey(orderId),
                            List.of("price", "remainingQuantity")
                    );
                }
                return null;
            }
        });

        Map<Long, long[]> result = new HashMap<>(orderIds.size());
        for (int i = 0; i < orderIds.size(); i++) {
            List<String> fields = (List<String>) results.get(i);
            if (fields == null || fields.size() < 2 || fields.get(0) == null || fields.get(1) == null) continue;
            try {
                long price = Long.parseLong(fields.get(0));
                long qty   = Long.parseLong(fields.get(1));
                result.put(orderIds.get(i), new long[]{price, qty});
            } catch (NumberFormatException ignored) {}
        }
        return result;
    }

    /**
     * 주문 체결 또는 취소 시 캐시에서 삭제합니다.
     */
    public void removeOrderCache(Long orderId) {
        redisTemplate.delete(getKey(orderId));
    }
}
