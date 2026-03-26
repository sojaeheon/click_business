package com.ssafy.ecosim.domain.market.service;

import com.ssafy.ecosim.domain.market.dto.event.TradeEventDto;
import com.ssafy.ecosim.domain.market.entity.MarketOrder;
import com.ssafy.ecosim.domain.market.entity.OrderStatus;
import com.ssafy.ecosim.domain.market.entity.OrderType;
import com.ssafy.ecosim.domain.market.kafka.TradeEventPublisher;
import com.ssafy.ecosim.domain.market.repository.redis.OrderBookManager;
import com.ssafy.ecosim.domain.market.repository.redis.OrderDetailsCacheManager;
import com.ssafy.ecosim.domain.notification.dto.NotificationEvent;
import com.ssafy.ecosim.domain.notification.entity.NotificationType;
import com.ssafy.ecosim.domain.company.repository.CompanyRepository;
import com.ssafy.ecosim.global.util.GameTimeUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Service;

import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class MarketMatchingService {

    private final OrderBookManager orderBookManager;
    private final OrderDetailsCacheManager orderDetailsCacheManager;
    private final TradeEventPublisher tradeEventPublisher;
    private final CompanyRepository companyRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final GameTimeUtil gameTimeUtil;

    /**
     * 특정 아이템에 대해 매칭을 수행합니다.
     * 
     * @param itemId 아이템 식별자
     */
    public void matchItem(Integer itemId) {
        log.debug("Matching started for item: {}", itemId);

        int iterations = 0;
        while (iterations++ < 100) {
            // 1. 최우선 호가 조회 (매수 최고가, 매도 최저가)
            Set<ZSetOperations.TypedTuple<String>> topBuys = orderBookManager.getTopBuys(itemId, 1);
            Set<ZSetOperations.TypedTuple<String>> topSells = orderBookManager.getTopSells(itemId, 1);

            if (topBuys == null || topBuys.isEmpty() || topSells == null || topSells.isEmpty()) {
                break; // 매수 또는 매도 한쪽이라도 주문이 없으면 종료
            }

            ZSetOperations.TypedTuple<String> topBuy = topBuys.iterator().next();
            ZSetOperations.TypedTuple<String> topSell = topSells.iterator().next();

            Long buyOrderId = Long.valueOf(topBuy.getValue());
            Long sellOrderId = Long.valueOf(topSell.getValue());

            // 2. 상세 정보 조회
            MarketOrder buyOrder = orderDetailsCacheManager.getOrderCache(buyOrderId);
            MarketOrder sellOrder = orderDetailsCacheManager.getOrderCache(sellOrderId);

            if (buyOrder == null || sellOrder == null) {
                // 캐시가 유실된 경우 (고스트 주문 제거)
                if (buyOrder == null) {
                    orderBookManager.removeOrder(itemId, "BUY", buyOrderId);
                    log.warn("[Matching] Ghost Buy Order {} removed for item {}", buyOrderId, itemId);
                }
                if (sellOrder == null) {
                    orderBookManager.removeOrder(itemId, "SELL", sellOrderId);
                    log.warn("[Matching] Ghost Sell Order {} removed for item {}", sellOrderId, itemId);
                }
                continue;
            }

            // 3. 매칭 검사 (매수 최고가 >= 매도 최저가)
            if (buyOrder.getPrice() < sellOrder.getPrice()) {
                break; // 가격이 맞지 않으면 더 이상 매칭 불가
            }

            // 4. 체결 실행
            executeTrade(itemId, buyOrder, sellOrder);
        }
        if (iterations >= 100) {
            log.warn("[Matching] Iteration limit reached for item {}", itemId);
        }
        log.info("=== Matching finished for item: {} ===", itemId); //
    }

    private void executeTrade(Integer itemId, MarketOrder buyOrder, MarketOrder sellOrder) {
        // 체결 가격 결정: 매도 호가(Sell Price)를 기준으로 체결합니다.
        // 매수자가 매도자의 가격을 수용하여 체결되는 형태이며, 이를 통해 매수자의 차액 환불 로직이 가능해집니다.
        long matchedPrice = sellOrder.getPrice();
        long matchedQuantity = Math.min(buyOrder.getRemainingQuantity(), sellOrder.getRemainingQuantity());

        // log.info("Matching Execution: Item={}, Price={}, Qty={}, Buyer={}, Seller={}",
        //         itemId, matchedPrice, matchedQuantity, buyOrder.getId(), sellOrder.getId());

        // Redis 잔량 업데이트
        buyOrder.executeTrade(matchedQuantity);
        sellOrder.executeTrade(matchedQuantity);
        // log.debug("Updated Buy Order Remaining Qty: {}", buyOrder.getRemainingQuantity()); //
        // log.debug("Updated Sell Order Remaining Qty: {}", sellOrder.getRemainingQuantity()); //

        // Redis 상세 캐시 업데이트 또는 삭제
        long executedAt = gameTimeUtil.getCurrentGameTimestamp();
        updateOrRemoveCache(buyOrder, executedAt);
        updateOrRemoveCache(sellOrder, executedAt);

        // Redis 호가창 업데이트 (잔량이 0이면 제거)
        if (buyOrder.getStatus() == OrderStatus.COMPLETED) {
            orderBookManager.removeOrder(itemId, "BUY", buyOrder.getId());
            // log.info("Buy order {} completed and removed from orderbook", buyOrder.getId()); //
        }
        if (sellOrder.getStatus() == OrderStatus.COMPLETED) {
            orderBookManager.removeOrder(itemId, "SELL", sellOrder.getId());
            // log.info("Sell order {} completed and removed from orderbook", sellOrder.getId()); //
        }

        // Redis 시장가 갱신 및 차트 데이터 갱신
        orderBookManager.setMarketPrice(itemId, matchedPrice);
        orderBookManager.addChartData(itemId, matchedPrice, executedAt);

        // TradeEvent 발행
        TradeEventDto tradeEvent = TradeEventDto.builder()
                .tradeId((System.currentTimeMillis() << 20) | (java.util.concurrent.ThreadLocalRandom.current().nextLong(1 << 20)))
                .buyOrderId(buyOrder.getId())
                .sellOrderId(sellOrder.getId())
                .itemId(itemId)
                .makerOrderType(OrderType.SELL)
                .price(matchedPrice)
                .quantity(matchedQuantity)
                .buyRemainingQuantity(buyOrder.getRemainingQuantity())
                .sellRemainingQuantity(sellOrder.getRemainingQuantity())
                .executedAt(executedAt)
                .build();

        try {
            tradeEventPublisher.publishTradeEvent(tradeEvent);
            // log.info("Published trade event for Buy {} and Sell {}", buyOrder.getId(), sellOrder.getId());
        } catch (Exception e) {
            // log.error("Failed to publish trade event for Buy {} and Sell {}", buyOrder.getId(), sellOrder.getId(), e);
        }

        // 실시간 알림 발송
        sendTradeNotifications(buyOrder, sellOrder, matchedPrice, matchedQuantity);
    }

    private void sendTradeNotifications(MarketOrder buyOrder, MarketOrder sellOrder, long price, long quantity) {
        // 매수자 알림
        if (!buyOrder.getIsVirtual()) {
            companyRepository.findById(buyOrder.getCompanyId()).ifPresent(company -> {
                eventPublisher.publishEvent(new NotificationEvent(
                        company.getUser().getId(),
                        String.format("[체결] 상품이 %d개 구매되었습니다. (가격: %d)", quantity, price),
                        NotificationType.TRADE));
            });
        }
        // 매도자 알림
        if (!sellOrder.getIsVirtual()) {
            companyRepository.findById(sellOrder.getCompanyId()).ifPresent(company -> {
                eventPublisher.publishEvent(new NotificationEvent(
                        company.getUser().getId(),
                        String.format("[체결] 상품이 %d개 판매되었습니다. (가격: %d)", quantity, price),
                        NotificationType.TRADE));
            });
        }

    }

    private void updateOrRemoveCache(MarketOrder order, long updatedAt) {
        if (order.getStatus() == OrderStatus.COMPLETED) {
            orderDetailsCacheManager.removeOrderCache(order.getId());
            // log.debug("Removed order {} from cache", order.getId()); //
        } else {
            orderDetailsCacheManager.saveOrderCache(order, updatedAt);
            // log.debug("Updated order {} in cache", order.getId()); //
        }
    }
}
