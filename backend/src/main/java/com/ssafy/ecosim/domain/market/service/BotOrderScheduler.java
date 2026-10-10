package com.ssafy.ecosim.domain.market.service;

import com.ssafy.ecosim.domain.market.dto.event.OrderCancellationEventDto;
import com.ssafy.ecosim.domain.market.dto.event.OrderCreationEventDto;
import com.ssafy.ecosim.domain.market.entity.ExternalIndex;
import com.ssafy.ecosim.domain.market.entity.MarketOrder;
import com.ssafy.ecosim.domain.market.entity.OrderType;
import com.ssafy.ecosim.domain.market.kafka.OrderEventPublisher;
import com.ssafy.ecosim.domain.market.repository.ExternalIndexRepository;
import com.ssafy.ecosim.domain.market.repository.redis.OrderBookManager;
import com.ssafy.ecosim.domain.market.repository.redis.OrderDetailsCacheManager;
import com.ssafy.ecosim.global.util.GameTimeUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Publishes a small, standing market-maker book around an external-index path.
 * It does not create bot-to-bot trades; real executions remain user-driven.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "market.bot.enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
public class BotOrderScheduler {

    private static final List<Long> TARGET_ITEM_IDS = List.of(1L, 2L, 3L);
    private static final int MAX_BOOK_SCAN = 100;

    private final OrderEventPublisher eventPublisher;
    private final OrderBookManager orderBookManager;
    private final OrderDetailsCacheManager orderDetailsCacheManager;
    private final ExternalIndexRepository externalIndexRepository;
    private final GameTimeUtil gameTimeUtil;

    private final Map<Long, Long> quotedReferenceByItem = new HashMap<>();
    private final Map<Long, Long> lastQuoteUpdateByItem = new HashMap<>();
    private final Map<Long, LocalDate> referenceDateByItem = new HashMap<>();
    private final Map<Long, LocalDate> loadedGameDateByItem = new HashMap<>();
    private final Map<Long, ExternalIndex> externalIndexByItem = new HashMap<>();

    @Value("${market.bot.min-levels:5}")
    private int minLevels;

    @Value("${market.bot.target-notional:600000}")
    private long targetNotional;

    @Value("${market.bot.max-orders-per-item-per-tick:2}")
    private int maxOrdersPerItemPerTick;

    @Value("${market.bot.tick-size:100}")
    private long tickSize;

    @Value("${market.bot.reprice-interval-ms:10000}")
    private long repriceIntervalMs;

    @Scheduled(fixedDelayString = "${market.bot.interval-ms:1000}")
    public void replenishLiquidity() {
        int changed = 0;
        for (Long itemId : TARGET_ITEM_IDS) {
            changed += replenishItem(itemId);
        }
        if (changed > 0) {
            log.debug("[BotLiquidity] changed {} maker orders", changed);
        }
    }

    private int replenishItem(Long itemId) {
        long referencePrice = resolveReferencePrice(itemId);
        if (referencePrice <= 0) {
            log.warn("[BotLiquidity] reference price is unavailable: itemId={}", itemId);
            return 0;
        }

        int intItemId = itemId.intValue();
        long gameTimestamp = gameTimeUtil.getCurrentGameTimestamp();
        orderBookManager.setReferencePrice(intItemId, referencePrice);
        orderBookManager.addReferenceChartData(intItemId, referencePrice, gameTimestamp);

        long now = System.currentTimeMillis();
        Long quoteReference = quotedReferenceByItem.get(itemId);
        long lastUpdate = lastQuoteUpdateByItem.getOrDefault(itemId, 0L);
        if (quoteReference == null || now - lastUpdate >= repriceIntervalMs) {
            quoteReference = referencePrice;
            quotedReferenceByItem.put(itemId, quoteReference);
            lastQuoteUpdateByItem.put(itemId, now);
        }

        LinkedHashSet<Long> desiredBuys = desiredPrices(quoteReference, OrderType.BUY);
        LinkedHashSet<Long> desiredSells = desiredPrices(quoteReference, OrderType.SELL);
        BookState book = inspectBook(intItemId);

        List<MarketOrder> stale = new ArrayList<>();
        book.virtualBuys.values().stream()
            .filter(order -> !desiredBuys.contains(order.getPrice())
                || order.getRemainingQuantity() != calculateOrderQuantity(itemId, OrderType.BUY, order.getPrice()))
            .forEach(stale::add);
        book.virtualSells.values().stream()
            .filter(order -> !desiredSells.contains(order.getPrice())
                || order.getRemainingQuantity() != calculateOrderQuantity(itemId, OrderType.SELL, order.getPrice()))
            .forEach(stale::add);

        List<PriceLevel> missing = new ArrayList<>();
        for (int level = 1; level <= minLevels; level++) {
            long buyPrice = Math.max(tickSize, quoteReference - level * tickSize);
            long sellPrice = quoteReference + level * tickSize;
            MarketOrder buyOrder = book.virtualBuys.get(buyPrice);
            if (buyOrder == null
                || buyOrder.getRemainingQuantity() != calculateOrderQuantity(itemId, OrderType.BUY, buyPrice)) {
                missing.add(new PriceLevel(OrderType.BUY, buyPrice));
            }
            MarketOrder sellOrder = book.virtualSells.get(sellPrice);
            if (sellOrder == null
                || sellOrder.getRemainingQuantity() != calculateOrderQuantity(itemId, OrderType.SELL, sellPrice)) {
                missing.add(new PriceLevel(OrderType.SELL, sellPrice));
            }
        }

        // Remove every stale virtual quote before publishing a new one. If a new
        // bid is inserted while an old virtual ask is still present (or vice
        // versa), the matching engine can create a synthetic bot-to-bot trade.
        for (MarketOrder order : stale) {
            cancelMakerOrder(order);
        }

        int created = 0;
        int budget = Math.max(1, maxOrdersPerItemPerTick);
        while (created < budget && !missing.isEmpty()) {
            PriceLevel level = missing.remove(0);
            publishMakerOrder(itemId, level.side(), level.price());
            created++;
        }
        return stale.size() + created;
    }

    private BookState inspectBook(Integer itemId) {
        Map<Long, MarketOrder> buys = inspectSide(
            orderBookManager.getTopBuys(itemId, MAX_BOOK_SCAN), OrderType.BUY
        );
        Map<Long, MarketOrder> sells = inspectSide(
            orderBookManager.getTopSells(itemId, MAX_BOOK_SCAN), OrderType.SELL
        );
        return new BookState(buys, sells);
    }

    private Map<Long, MarketOrder> inspectSide(
        Set<ZSetOperations.TypedTuple<String>> tuples,
        OrderType side
    ) {
        Map<Long, MarketOrder> ordersByPrice = new HashMap<>();
        if (tuples == null) return ordersByPrice;

        for (ZSetOperations.TypedTuple<String> tuple : tuples) {
            try {
                Long orderId = Long.valueOf(tuple.getValue());
                MarketOrder order = orderDetailsCacheManager.getOrderCache(orderId);
                if (order == null) continue;
                if (Boolean.TRUE.equals(order.getIsVirtual()) && order.getOrderType() == side) {
                    ordersByPrice.putIfAbsent(order.getPrice(), order);
                }
            } catch (Exception e) {
                log.warn("[BotLiquidity] failed to inspect order {}", tuple.getValue());
            }
        }
        return ordersByPrice;
    }

    private LinkedHashSet<Long> desiredPrices(long referencePrice, OrderType side) {
        LinkedHashSet<Long> prices = new LinkedHashSet<>();
        for (int level = 1; level <= minLevels; level++) {
            long offset = level * tickSize;
            prices.add(side == OrderType.BUY
                ? Math.max(tickSize, referencePrice - offset)
                : referencePrice + offset);
        }
        return prices;
    }

    private void cancelMakerOrder(MarketOrder order) {
        orderBookManager.removeOrder(order.getItemId(), order.getOrderType().name(), order.getId());
        OrderCancellationEventDto event = OrderCancellationEventDto.builder()
            .orderId(order.getId())
            .itemId(order.getItemId())
            .companyId(order.getCompanyId())
            .orderType(order.getOrderType())
            .price(order.getPrice().intValue())
            .quantity(order.getRemainingQuantity().intValue())
            .isVirtual(true)
            .timestamp(gameTimeUtil.getCurrentGameTimestamp())
            .build();
        eventPublisher.publishOrderCancelledEvent(event);
    }

    private void publishMakerOrder(Long itemId, OrderType orderType, long price) {
        long quantity = calculateOrderQuantity(itemId, orderType, price);
        OrderCreationEventDto event = OrderCreationEventDto.builder()
            .itemId(itemId.intValue())
            .companyId(ThreadLocalRandom.current().nextLong(500, 1000))
            .orderType(orderType)
            .price(price)
            .totalQuantity(quantity)
            .isVirtual(true)
            .timestamp(gameTimeUtil.getCurrentGameTimestamp())
            .build();
        eventPublisher.publishOrderEvent(event);
    }

    private long calculateOrderQuantity(Long itemId, OrderType orderType, long price) {
        long baseQuantity = Math.max(1L, Math.round(targetNotional / (double) price));

        // Stable 80~120% variation keeps the depth readable without changing
        // randomly on every scheduler tick.
        long priceLevel = price / Math.max(1L, tickSize);
        int bucket = Math.floorMod(
            itemId.intValue() * 31 + orderType.ordinal() * 17 + (int) (priceLevel % 5),
            5
        );
        int percentage = 80 + bucket * 10;
        return Math.max(1L, Math.round(baseQuantity * percentage / 100.0));
    }

    private long resolveReferencePrice(Long itemId) {
        LocalDate gameDate = gameTimeUtil.getCurrentGameDate();
        ExternalIndex value = loadExternalIndex(itemId, gameDate);
        if (value == null) return 0L;
        int tick = Math.max(0, Math.min(599, gameTimeUtil.getCurrentTick()));
        boolean highFirst = ((value.getPriceDate().toEpochDay() + itemId) & 1L) == 0L;
        long firstExtreme = highFirst ? value.getHighPrice() : value.getLowPrice();
        long secondExtreme = highFirst ? value.getLowPrice() : value.getHighPrice();

        long price;
        if (tick < 200) {
            price = interpolate(value.getOpenPrice(), firstExtreme, tick, 200);
        } else if (tick < 400) {
            price = interpolate(firstExtreme, secondExtreme, tick - 200, 200);
        } else {
            price = interpolate(secondExtreme, value.getClosePrice(), tick - 400, 199);
        }
        long rounded = Math.max(tickSize, Math.round(price / (double) tickSize) * tickSize);

        if (!value.getPriceDate().equals(referenceDateByItem.get(itemId))) {
            long roundedOpen = Math.max(
                tickSize,
                Math.round(value.getOpenPrice() / (double) tickSize) * tickSize
            );
            orderBookManager.setOpenPrice(itemId.intValue(), roundedOpen);
            referenceDateByItem.put(itemId, value.getPriceDate());
        }
        if (orderBookManager.getMarketPrice(itemId.intValue()) == null) {
            orderBookManager.setMarketPrice(itemId.intValue(), rounded);
        }
        return rounded;
    }

    private ExternalIndex loadExternalIndex(Long itemId, LocalDate gameDate) {
        if (gameDate.equals(loadedGameDateByItem.get(itemId))) {
            return externalIndexByItem.get(itemId);
        }

        Optional<ExternalIndex> index = externalIndexRepository.findByItemIdAndPriceDate(itemId, gameDate);
        if (index.isEmpty()) {
            index = externalIndexRepository.findFirstByItemIdAndPriceDateAfterOrderByPriceDateAsc(itemId, gameDate);
        }
        if (index.isEmpty()) {
            index = externalIndexRepository.findFirstByItemIdOrderByPriceDateDesc(itemId);
        }

        loadedGameDateByItem.put(itemId, gameDate);
        if (index.isPresent()) {
            externalIndexByItem.put(itemId, index.get());
            return index.get();
        }
        externalIndexByItem.remove(itemId);
        return null;
    }

    private long interpolate(long start, long end, int position, int span) {
        if (span <= 0) return end;
        double ratio = Math.max(0.0, Math.min(1.0, position / (double) span));
        return Math.round(start + (end - start) * ratio);
    }

    private record PriceLevel(OrderType side, long price) {}
    private record BookState(
        Map<Long, MarketOrder> virtualBuys,
        Map<Long, MarketOrder> virtualSells
    ) {}
}
