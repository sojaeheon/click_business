package com.ssafy.ecosim.domain.market.service;

import com.ssafy.ecosim.domain.market.dto.event.OrderCreationEventDto;
import com.ssafy.ecosim.domain.market.entity.ExternalIndex;
import com.ssafy.ecosim.domain.market.entity.OrderType;
import com.ssafy.ecosim.domain.market.kafka.OrderEventPublisher;
import com.ssafy.ecosim.domain.market.repository.ExternalIndexRepository;
import com.ssafy.ecosim.domain.market.repository.redis.OrderBookManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;

@Slf4j
@Component
@EnableScheduling
@RequiredArgsConstructor
public class BotOrderScheduler {

    private final OrderEventPublisher eventPublisher;
    // 현재 시장가(Redis Ticker) 조회용
    private final RedisTemplate<String, Object> redisTemplate;
    // Market Sweep 시 반대편 호가창의 총 잔량 조회용
    private final OrderBookManager orderBookManager;
    // 외부 지표(DB) 조회용 리포지토리
    private final ExternalIndexRepository externalIndexRepository;

    // 아이템별 시뮬레이션 상태 관리 (1: 금석, 2: 금괴석, 3: 금 드릴)
    private final Map<Long, ItemSimulationState> itemStates = new HashMap<>();

    // 사이클 관리
    private static final int CYCLE_SECONDS = 600; // 10분 = 외부 지표 1일
    private static final List<Long> TARGET_ITEM_IDS = List.of(1L, 2L, 3L);

    // 초당 생성량 (30~50건)
    private static final int MIN_TPS = 30;
    private static final int MAX_TPS = 50;

    @Scheduled(fixedRate = 1000) // 1초마다 모든 아이템에 대해 가상 주문 생성 실행
    public void generateVirtualOrderTick() {
        for (Long itemId : TARGET_ITEM_IDS) {
            // 아이템별 상태 객체가 없으면 생성 후 시뮬레이션 진행
            ItemSimulationState state = itemStates.computeIfAbsent(itemId, k -> new ItemSimulationState());
            simulateTickForItem(itemId, state);
        }
    }

    // 개별 아이템의 1초당 시뮬레이션 로직 처리
    private void simulateTickForItem(Long itemId, ItemSimulationState state) {
        if (state.currentTick == 0) {
            initNewDayCycle(itemId, state);
        }

        // 지표 데이터가 없는 경우 스킵
        if (state.targetCloseFluct == null) return;

        // 1. 현재 시장가(Redis Ticker) 실시간 조회
        Long currentMarketPriceObj = getCurrentMarketPrice(itemId);
        long currentMarketPrice = currentMarketPriceObj != null ? currentMarketPriceObj : 10000L;

        // 2. 메모리에 미리 계산된 현재 틱의 '목표 변동률' 가져와서 타겟가 계산 (이후 Tick Size 보정)
        double currentTargetFluct = state.tickTargetFluctuations[state.currentTick];
        double rawTargetPrice = currentMarketPrice * (1 + currentTargetFluct);
        long currentTargetPrice = applyTickSize(rawTargetPrice);

        // 3. 초당 생성할 가상 봇 갯수 랜덤 설정 (TPS)
        int botCount = ThreadLocalRandom.current().nextInt(MIN_TPS, MAX_TPS + 1);

        // 최초 시작 시드(Seed) 주문: 유동성 형성을 위해 엄청난 주문 쏟아내기
        if (state.isFirstDay && state.currentTick == 0) {
            botCount = 1000; // 최초 1회만 거물급 매물대 형성 (초기화)
            state.isFirstDay = false;
        }

        for (int i = 0; i < botCount; i++) {
            // 3. 방향 먼저 결정 (수량 및 가격 계산에 모두 필요)
            OrderType type = ThreadLocalRandom.current().nextBoolean() ? OrderType.BUY : OrderType.SELL;

            boolean priceGoingUp = currentTargetPrice > currentMarketPrice;
            boolean isSweeperBot = priceGoingUp ? type == OrderType.BUY : type == OrderType.SELL;

            // 4. 주문 가격 결정 (방향 및 시장 상황 인식 배치)
            long orderPrice;
            if (isSweeperBot) {
                // 스윕 봇: ±0.1% 소폭 스프레드
                double spreadRatio = 1.0 + ThreadLocalRandom.current().nextDouble(-0.001, 0.001);
                orderPrice = applyTickSize(currentTargetPrice * spreadRatio);
            } else {
                // 유동성 봇: 타겟가 바깥 1~3 Tick 위치에 호가 배치 (벽 방해 없음)
                long tickSize = 100L;
                long tickOffset = ThreadLocalRandom.current().nextLong(1, 4) * tickSize; // 1~3 Tick 이격
                // 가격 오르는 중 → SELL 유동성 봇은 타겟가보다 위에 / 내리는 중 → BUY 유동성 봇은 타겟가보다 아래에
                orderPrice = priceGoingUp ? currentTargetPrice + tickOffset : currentTargetPrice - tickOffset;
            }

            // 5. 수량: 스윕 봇은 잔량 기반 균등 분배, 유동성 봇은 소량
            long orderQty = calculateSweepQtyPerBot(itemId, currentMarketPrice, currentTargetPrice, botCount, type, i);

            // 여러 가상 기관(회사)들이 참여하는 것처럼 보이기 위해 500번 ~ 999번 사이의 랜덤 회사 ID 부여
            long randomCompanyId = ThreadLocalRandom.current().nextLong(500, 1000);

            OrderCreationEventDto botEvent = OrderCreationEventDto.builder()
                    .itemId(itemId.intValue())
                    .companyId(randomCompanyId) // 봇 회사 식별번호 (500~999 랜덤)
                    .orderType(type)
                    .price(orderPrice)
                    .totalQuantity(orderQty)
                    .isVirtual(true) // 봇이 생성한 가짜 데이터임을 명시!
                    .timestamp(System.currentTimeMillis())
                    .build();

            eventPublisher.publishOrderEvent(botEvent);
        }

        // 사이클 증가
        state.currentTick++;
        if (state.currentTick >= CYCLE_SECONDS) {
            state.currentTick = 0;
        }
    }

    /**
     * Market Sweep 수량 계산기: 반대편 호가창에서 현재가~목표가 구간의 총 잔량을 봇 수로 균등 분배합니다.
     */
    private long calculateSweepQtyPerBot(Long itemId, long currentPrice, long targetPrice, int botCount, OrderType botOrderType,
            int botIndex) {
        boolean priceGoingUp = targetPrice > currentPrice;

        // 가격이 오르려면 매도(SELL) 물량을 매수(BUY)로 흡수해야 하고, 내리려면 그 반대
        boolean isSweeperOrder = priceGoingUp ? botOrderType == OrderType.BUY : botOrderType == OrderType.SELL;

        // 스윕 역할을 하지 않는 반대방향 봇은 그냥 소량 랜덤 주문으로 유동성 공급
        if (!isSweeperOrder) {
            return ThreadLocalRandom.current().nextLong(1, 11);
        }

        // 반대편 호가창에서 현재가~목표가 사이의 총 미체결 물량 조회
        String oppositeType = priceGoingUp ? "SELL" : "BUY";
        double minScore = Math.min(currentPrice, targetPrice);
        double maxScore = Math.max(currentPrice, targetPrice);
        long totalSweepVolume = orderBookManager.getVolumeInScoreRange(itemId.intValue(), oppositeType, minScore, maxScore);

        if (totalSweepVolume <= 0) {
            return ThreadLocalRandom.current().nextLong(1, 11);
        }

        int sweepBotCount = Math.max(1, botCount / 2);
        return Math.max(1, totalSweepVolume / sweepBotCount);
    }

    /**
     * 새로운 10분이 시작될 때(1일차), 새로운 목표 가격들을 DB에서 과거부터 순차적으로 세팅합니다.
     */
    private void initNewDayCycle(Long itemId, ItemSimulationState state) {
        // 외부 지표 테이블(external_index)에서 시간 순서에 맞는 실제 데이터를 꺼내옴
        Optional<ExternalIndex> nextIndex;
        if (state.lastSimulatedDate == null) {
            // 처음에는 가장 과거 데이터 조회
            nextIndex = externalIndexRepository.findFirstByItemIdOrderByPriceDateAsc(itemId);
        } else {
            // 마지막 시뮬레이션 날짜 이후의 데이터를 조회 (과거 -> 미래 순차 진행)
            nextIndex = externalIndexRepository.findFirstByItemIdAndPriceDateAfterOrderByPriceDateAsc(itemId, state.lastSimulatedDate);
            
            // 데이터 소진 시 다시 가장 과거로 순환 (지속적 테스트용)
            if (nextIndex.isEmpty()) {
                nextIndex = externalIndexRepository.findFirstByItemIdOrderByPriceDateAsc(itemId);
            }
        }

        if (nextIndex.isEmpty()) {
            log.warn("[BotScheduler] Item ID {} 의 지표 데이터가 DB에 없습니다.", itemId);
            return;
        }

        ExternalIndex index = nextIndex.get();
        state.lastSimulatedDate = index.getPriceDate();

        // 초기 시장가 세팅 (서버 기동 후 거래 내역이 없을 때 DB 시가 적용)
        Long marketPriceObj = getCurrentMarketPrice(itemId);
        long currentMarketPrice;
        if (marketPriceObj == null && index.getOpenPrice() != null) {
            currentMarketPrice = index.getOpenPrice().longValue();
            redisTemplate.opsForValue().set("market:price:" + itemId, String.valueOf(currentMarketPrice));
        } else {
            currentMarketPrice = marketPriceObj != null ? marketPriceObj : 10000L;
        }

        // DB 등락률(Decimal 5,2)을 변동률 값(0.01 = 1%)으로 변환 (게임적 재미를 위해 외부 지표의 10배 변동성 부여)
        state.targetOpenFluct = 0.0; // 시가는 전일 종가와 이어진다고 가정
        state.targetHighFluct = (index.getOpenHighFluctRate() != null ? index.getOpenHighFluctRate().doubleValue() / 100.0 : 0.02) * 10.0;
        state.targetLowFluct = (index.getOpenLowFluctRate() != null ? index.getOpenLowFluctRate().doubleValue() / 100.0 : -0.02) * 10.0;
        state.targetCloseFluct = (index.getFluctRate() != null ? index.getFluctRate().doubleValue() / 100.0 : 0.01) * 10.0;

        // 패턴 결정 (50% 확률로 하루 동안 고가를 먼저 찍음)
        state.isHighFirst = ThreadLocalRandom.current().nextBoolean();

        log.info("[Virtual Index Cycle] Item: {} | Date: {} | Base Price: {} | Fluct (H/L/C): {} / {} / {}",
                itemId, state.lastSimulatedDate, currentMarketPrice, state.targetHighFluct, state.targetLowFluct, state.targetCloseFluct);

        // 장 시작 시점에, 하루치 600틱에 대한 '타겟 변동률'을 미리 계산하여 배열에 저장
        for (int i = 0; i < CYCLE_SECONDS; i++) {
            state.tickTargetFluctuations[i] = calculateInterpolatedFluct(i, state);
        }
    }

    /**
     * 현재 초(0~599)에 해당하는 1차 함수(선형 보간) 타겟 변동률을 부드럽게 계산합니다.
     */
    private double calculateInterpolatedFluct(int tick, ItemSimulationState state) {
        if (tick < 200) {
            double start = state.targetOpenFluct;
            double end = state.isHighFirst ? state.targetHighFluct : state.targetLowFluct;
            return interpolate(start, end, tick, 200);
        } else if (tick < 400) {
            double start = state.isHighFirst ? state.targetHighFluct : state.targetLowFluct;
            double end = state.isHighFirst ? state.targetLowFluct : state.targetHighFluct;
            return interpolate(start, end, tick - 200, 200);
        } else {
            double start = state.isHighFirst ? state.targetLowFluct : state.targetHighFluct;
            double end = state.targetCloseFluct;
            return interpolate(start, end, tick - 400, 199);
        }
    }

    private double interpolate(double start, double end, int progress, int maxProgress) {
        double progressRatio = (double) progress / maxProgress;
        double basePrice = start + (end - start) * progressRatio;
        double remainingRatio = 1.0 - progressRatio;
        double noiseFluct = ThreadLocalRandom.current().nextDouble(-0.005, 0.005);
        return basePrice * (1.0 + (noiseFluct * remainingRatio));
    }

    private long applyTickSize(double rawPrice) {
        long tickSize = 100L;
        return Math.round(rawPrice / tickSize) * tickSize;
    }

    private Long getCurrentMarketPrice(Long itemId) {
        String tickerKey = "market:price:" + itemId;
        Object priceObj = redisTemplate.opsForValue().get(tickerKey);
        if (priceObj != null) {
            try {
                return Long.parseLong(priceObj.toString());
            } catch (Exception ignored) {}
        }
        return null;
    }

    /**
     * 아이템별 시뮬레이션 상태를 별도로 보관하는 내부 클래스입니다.
     */
    private static class ItemSimulationState {
        int currentTick = 0;             // 현재 0~599초 중 몇 번째 틱인지
        boolean isFirstDay = true;       // 서버 시작 후 첫 사이클 여부
        LocalDate lastSimulatedDate = null; // 마지막으로 처리한 DB 지표 날짜

        double targetOpenFluct;         // 시가 목표 변동률
        double targetHighFluct;         // 고가 목표 변동률
        double targetLowFluct;          // 저가 목표 변동률
        Double targetCloseFluct;        // 종가 목표 변동률 (데이터 유무 체크용)
        boolean isHighFirst;            // 고가를 먼저 찍는 패턴인지 여부

        final double[] tickTargetFluctuations = new double[600]; // 초별 미리 계산된 타겟 변동률
    }
}
