package com.ssafy.ecosim.domain.market.service;

import com.ssafy.ecosim.domain.market.dto.response.OrderBookEntryDto;
import com.ssafy.ecosim.domain.market.dto.response.OrderBookResponseDto;
import com.ssafy.ecosim.domain.market.dto.response.TradeHistoryDto;
import com.ssafy.ecosim.domain.market.entity.MarketOrder;
import com.ssafy.ecosim.domain.market.repository.TradeHistoryRepository;
import com.ssafy.ecosim.domain.market.repository.redis.OrderBookManager;
import com.ssafy.ecosim.domain.market.repository.redis.OrderDetailsCacheManager;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class OrderBookService {

    private static final int ORDER_BOOK_DEPTH = 10;   // 호가창 표시 가격 단계 수
    private static final int SCAN_LIMIT = 200;        // Redis ZSet 스캔 상한 (price level로 묶기 위해 여유 있게)
    private static final int RECENT_TRADES_COUNT = 30;

    private final OrderBookManager orderBookManager;
    private final OrderDetailsCacheManager orderDetailsCacheManager;
    private final TradeHistoryRepository tradeHistoryRepository;

    /**
     * 특정 아이템의 호가창 스냅샷을 반환합니다.
     * Redis ZSet에서 order ID를 가져온 뒤 Hash 캐시에서 price/remainingQuantity를 조합하여
     * 가격 레벨별로 집계합니다.
     */
    public OrderBookResponseDto getOrderBook(Integer itemId) {
        Long currentPrice = orderBookManager.getMarketPrice(itemId);
        List<OrderBookEntryDto> buyOrders = aggregateOrders(
                orderBookManager.getTopBuys(itemId, SCAN_LIMIT),
                true
        );
        List<OrderBookEntryDto> sellOrders = aggregateOrders(
                orderBookManager.getTopSells(itemId, SCAN_LIMIT),
                false
        );
        return new OrderBookResponseDto(itemId, currentPrice, buyOrders, sellOrders);
    }

    /**
     * 현재 유저 회사의 특정 아이템 체결 내역을 반환합니다.
     * isCollected 포함 → 프론트에서 수령 버튼 렌더링에 활용
     */
    public List<TradeHistoryDto> getMyTrades(Long companyId, Integer itemId) {
        return tradeHistoryRepository
                .findRecentByCompanyIdAndItemId(companyId, itemId, PageRequest.of(0, RECENT_TRADES_COUNT))
                .stream()
                .map(TradeHistoryDto::new)
                .toList();
    }

    // ─────────────────────────────────────────────────────────────────
    // private helpers
    // ─────────────────────────────────────────────────────────────────

    /**
     * ZSet 결과(order ID 목록)를 가격 레벨별 누적 물량으로 집계합니다.
     *
     * @param tuples   ZSet rangeWithScores 결과
     * @param descSort true → 매수(높은 가격 우선), false → 매도(낮은 가격 우선)
     */
    private List<OrderBookEntryDto> aggregateOrders(
            Set<ZSetOperations.TypedTuple<String>> tuples,
            boolean descSort
    ) {
        if (tuples == null || tuples.isEmpty()) {
            return Collections.emptyList();
        }

        // 가격 레벨 → 누적 잔량
        Map<Long, Long> priceMap = new LinkedHashMap<>();

        for (ZSetOperations.TypedTuple<String> tuple : tuples) {
            Long orderId = Long.valueOf(tuple.getValue());
            MarketOrder order = orderDetailsCacheManager.getOrderCache(orderId);
            if (order == null) continue;

            long price = order.getPrice();
            long qty = order.getRemainingQuantity();
            priceMap.merge(price, qty, Long::sum);
        }

        // 가격 레벨 정렬 후 상위 DEPTH만 잘라 반환
        Comparator<Map.Entry<Long, Long>> comparator = descSort
                ? Map.Entry.<Long, Long>comparingByKey().reversed()
                : Map.Entry.comparingByKey();

        return priceMap.entrySet().stream()
                .sorted(comparator)
                .limit(ORDER_BOOK_DEPTH)
                .map(e -> new OrderBookEntryDto(e.getKey(), e.getValue()))
                .toList();
    }
}
