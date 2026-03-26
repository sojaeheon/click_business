package com.ssafy.ecosim.domain.market.service;

import com.ssafy.ecosim.domain.market.dto.event.OrderCreationEventDto;
import com.ssafy.ecosim.domain.market.entity.ExternalIndex;
import com.ssafy.ecosim.domain.market.entity.OrderType;
import com.ssafy.ecosim.domain.market.kafka.OrderEventPublisher;
import com.ssafy.ecosim.domain.market.repository.ExternalIndexRepository;
import com.ssafy.ecosim.domain.market.repository.redis.OrderBookManager;
import com.ssafy.ecosim.global.util.GameTimeUtil;
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
    // 게임시간 관리 유틸
    private final GameTimeUtil gameTimeUtil;

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
        // GameTimeUtil에서 현재 틱 및 날짜 조회
        int currentTick = gameTimeUtil.getCurrentTick();
        LocalDate currentDate = gameTimeUtil.getCurrentGameDate();
        
        // 날짜가 바뀌었으면 새 외부지표 로드
        if (state.lastSimulatedDate == null || !currentDate.equals(state.lastSimulatedDate)) {
            initNewDayCycle(itemId, state, currentDate);
        }

        // 지표 데이터가 없는 경우 스킵
        if (state.targetCloseFluct == null) {
            if (itemId == 1L) log.warn("[BotDebug] Item 1 skipped: targetCloseFluct is null");
            return;
        }

        // 1. 현재 시장가(Redis Ticker) 실시간 조회
        Long currentMarketPriceObj = getCurrentMarketPrice(itemId);
        // 이전에 저장된 시가가 없으면 DB에서 가져온 시가(dayOpenPrice)를 기본값으로 사용
        long currentMarketPrice = currentMarketPriceObj != null ? currentMarketPriceObj : state.dayOpenPrice;

        if (itemId == 1L && currentTick % 10 == 0) {
            log.info("[BotDebug] Item 1 Tick: {}, MarketPrice: {}, OpenPrice: {}", 
                currentTick, currentMarketPrice, state.dayOpenPrice);
        }

        // 2. 이번 틱의 '목표 변동 증분(Delta)' 계산
        // 현재가 기준으로 이번 1초 동안 이동해야 할 순수 변화량(델타)만 추출하여 적용합니다.
        double currentTotalFluct = state.tickTargetFluctuations[currentTick];
        double previousTotalFluct = (currentTick == 0) ? 0.0 : state.tickTargetFluctuations[currentTick - 1];
        
        // 순수 델타 (이번 틱의 변화량)
        double deltaFluct = currentTotalFluct - previousTotalFluct;
        
        // 현재가에 델타 적용 (현재가 × (1 + 델타))
        double theoreticalTarget = currentMarketPrice * (1.0 + deltaFluct);

        long currentTargetPrice = applyTickSize(theoreticalTarget);

        // 3. 초당 생성할 가상 봇 갯수 랜덤 설정 (TPS)
        int botCount = ThreadLocalRandom.current().nextInt(MIN_TPS, MAX_TPS + 1);

        // 최초 시작 시드(Seed) 주문: 유동성 형성을 위해 엄청난 주문 쏟아내기
        if (state.isFirstDay && currentTick == 0) {
            botCount = 1000; // 최초 1회만 거물급 매물대 형성 (초기화)
            state.isFirstDay = false;
        }

        for (int i = 0; i < botCount; i++) {
            // 3-Tier 봇 시스템: 메이커(70%), 테이커(20%), 노이즈(10%)
            double rand = ThreadLocalRandom.current().nextDouble();
            
            OrderType type;
            long orderPrice;
            long orderQty;
            long tickSize = 100L;
            boolean priceGoingUp = currentTargetPrice > currentMarketPrice;
            
            if (rand < 0.7) {
                // A) 메이커 봇 (70%): 호가창 유동성 제공
                type = ThreadLocalRandom.current().nextBoolean() ? OrderType.BUY : OrderType.SELL;
                
                // 매수는 목표가 아래, 매도는 목표가 위에만 배치 (1~15 Tick 오프셋)
                long tickOffset = ThreadLocalRandom.current().nextLong(1, 16) * tickSize;
                if (type == OrderType.BUY) {
                    orderPrice = currentTargetPrice - tickOffset;
                } else {
                    orderPrice = currentTargetPrice + tickOffset;
                }
                
                // [계산적 메이커] 해당 호가의 현재 잔량 확인 후 딱 필요한 만큼(최대 150)만 공급
                double minScore, maxScore;
                if (type == OrderType.BUY) {
                    minScore = -((double)orderPrice * 1_000_000.0 + 999_999.0);
                    maxScore = -((double)orderPrice * 1_000_000.0);
                } else {
                    minScore = (double)orderPrice * 1_000_000.0;
                    maxScore = (double)orderPrice * 1_000_000.0 + 999_999.0;
                }
                
                long currentVolume = orderBookManager.getVolumeInScoreRange(itemId.intValue(), type.name(), minScore, maxScore);
                long targetDepth = 3000L;
                
                if (currentVolume < targetDepth) {
                    orderQty = Math.min(150, targetDepth - currentVolume);
                    if (orderQty < 50) orderQty = 50; // 최소 활성량 보장
                } else {
                    // 이미 충분하면 유동성 공급 생략 (벽 생성 방지)
                    continue; 
                }
                
            } else if (rand < 0.9) {
                // B) 테이커 봇 (20%): 목표가로 시장가 이동
                type = priceGoingUp ? OrderType.BUY : OrderType.SELL;
                
                // 목표가 ±1~3 Tick (타겟가 근처 물량 집중 체결)
                long tickOffset = ThreadLocalRandom.current().nextLong(-1, 4) * tickSize;
                orderPrice = currentTargetPrice + tickOffset;
                
                // 반대편 호가창 물량의 100%를 균등 분배 (잔량 없는 정밀 체결)
                String oppositeType = priceGoingUp ? "SELL" : "BUY";
                double minRangeScore = (double)Math.min(currentMarketPrice, currentTargetPrice) * 1_000_000.0;
                double maxRangeScore = (double)Math.max(currentMarketPrice, currentTargetPrice) * 1_000_000.0 + 999_999.0;
                
                // BUY 테이커는 SELL 호가(양수 스코어)를, SELL 테이커는 BUY 호가(음수 스코어)를 조회
                if (type == OrderType.SELL) {
                   // SELL 봇은 BUY 호가(음수)를 확인해서 시장가 하향 유도
                   double tmp = minRangeScore;
                   minRangeScore = -(maxRangeScore);
                   maxRangeScore = -(tmp);
                }
                
                long totalVolume = orderBookManager.getVolumeInScoreRange(itemId.intValue(), oppositeType, minRangeScore, maxRangeScore);
                int takerCount = Math.max(1, (int)(botCount * 0.2)); // 20% 봇
                
                if (totalVolume <= 0) {
                    // 치울 물량이 없으면 주문 내지 않음 (가격은 메이커가 채우면서 자연스럽게 형성됨)
                    continue;
                }
                
                // 가용 물량의 100%를 정확히 나누어 가져감 (사전 계산된 시장 충격)
                orderQty = Math.max(1, totalVolume / takerCount);
                
            } else {
                // C) 노이즈 봇 (10%): 시장 자연스러움
                type = ThreadLocalRandom.current().nextBoolean() ? OrderType.BUY : OrderType.SELL;
                
                // 매수는 현재가 아래, 매도는 현재가 위에만 배치 (10~30 Tick 오프셋)
                long tickOffset = ThreadLocalRandom.current().nextLong(10, 31) * tickSize;
                if (type == OrderType.BUY) {
                    orderPrice = currentMarketPrice - tickOffset;
                } else {
                    orderPrice = currentMarketPrice + tickOffset;
                }
                
                // 소량 (1~10)
                orderQty = ThreadLocalRandom.current().nextLong(1, 11);
            }
            
            // 최소 1틱(100원) 방어
            orderPrice = Math.max(tickSize, orderPrice);

            // 여러 가상 기관(회사)들이 참여하는 것처럼 보이기 위해 500번 ~ 999번 사이의 랜덤 회사 ID 부여
            long randomCompanyId = ThreadLocalRandom.current().nextLong(500, 1000);

            OrderCreationEventDto botEvent = OrderCreationEventDto.builder()
                    .itemId(itemId.intValue())
                    .companyId(randomCompanyId) // 봇 회사 식별번호 (500~999 랜덤)
                    .orderType(type)
                    .price(orderPrice)
                    .totalQuantity(orderQty)
                    .isVirtual(true) // 봇이 생성한 가짜 데이터임을 명시!
                    .timestamp(gameTimeUtil.getCurrentGameTimestamp()) // 게임시간 사용
                    .build();

            eventPublisher.publishOrderEvent(botEvent);
        }
    }

    /**
     * 새로운 날짜가 시작될 때 외부 지표에서 데이터를 로드합니다.
     */
    private void initNewDayCycle(Long itemId, ItemSimulationState state, LocalDate currentDate) {
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
        state.lastSimulatedDate = currentDate;

        // 초기 시장가 세팅 (서버 기동 후 거래 내역이 없을 때 DB 시가 적용)
        Long marketPriceObj = getCurrentMarketPrice(itemId);
        long currentMarketPrice;
        if (marketPriceObj == null && index.getOpenPrice() != null) {
            currentMarketPrice = index.getOpenPrice().longValue();
            redisTemplate.opsForValue().set("market:price:" + itemId, String.valueOf(currentMarketPrice));
        } else {
            currentMarketPrice = marketPriceObj != null ? marketPriceObj : (index.getOpenPrice() != null ? index.getOpenPrice().longValue() : 10000L);
        }

        // 10분 사이클 동안 목표 계산의 기준이 될 시가 베이스 저장.
        state.dayOpenPrice = currentMarketPrice;
        
        // 시가를 Redis에 저장하여 OrderBookService에서 변동률 계산 시 사용
        redisTemplate.opsForValue().set("market:price:open:" + itemId, String.valueOf(currentMarketPrice));
        // 새 사이클 시작 시 이전 차트 데이터 초기화
        orderBookManager.clearChartData(itemId.intValue());

        // DB 등락률(Decimal 5,2)을 변동률 값(0.01 = 1%)으로 변환 (게임적 재미를 위해 외부 지표의 10배 변동성 부여)
        state.targetOpenFluct = 0.0; // 시가는 전일 종가와 이어진다고 가정
        state.targetHighFluct = (index.getOpenHighFluctRate() != null ? index.getOpenHighFluctRate().doubleValue() / 100.0 : 0.02) * 10.0;
        state.targetLowFluct = (index.getOpenLowFluctRate() != null ? index.getOpenLowFluctRate().doubleValue() / 100.0 : -0.02) * 10.0;
        state.targetCloseFluct = (index.getFluctRate() != null ? index.getFluctRate().doubleValue() / 100.0 : 0.01) * 10.0;

        // 패턴 결정 (50% 확률로 하루 동안 고가를 먼저 찍음)
        state.isHighFirst = ThreadLocalRandom.current().nextBoolean();

        log.info("[Virtual Index Cycle] Item: {} | Date: {} | Base Price: {} | Fluct (H/L/C): {} / {} / {}",
                itemId, currentDate, currentMarketPrice, state.targetHighFluct, state.targetLowFluct, state.targetCloseFluct);

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
        boolean isFirstDay = true;       // 서버 시작 후 첫 사이클 여부
        LocalDate lastSimulatedDate = null; // 마지막으로 처리한 DB 지표 날짜

        double targetOpenFluct;         // 시가 목표 변동률
        double targetHighFluct;         // 고가 목표 변동률
        double targetLowFluct;          // 저가 목표 변동률
        Double targetCloseFluct;        // 종가 목표 변동률 (데이터 유무 체크용)
        boolean isHighFirst;            // 고가를 먼저 찍는 패턴인지 여부
        long dayOpenPrice;              // 사이클 시작 시점의 시장가 보관 (참고용)

        final double[] tickTargetFluctuations = new double[600]; // 초별 미리 계산된 타겟 변동률
    }
}
