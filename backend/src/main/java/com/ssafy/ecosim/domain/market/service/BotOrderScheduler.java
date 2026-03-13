package com.ssafy.ecosim.domain.market.service;

import com.ssafy.ecosim.domain.market.entity.OrderType;
import com.ssafy.ecosim.domain.market.kafka.OrderEventPublisher;
import com.ssafy.ecosim.domain.market.dto.event.OrderCreationEventDto;
import com.ssafy.ecosim.domain.market.repository.redis.OrderBookManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

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

    // 사이클 관리
    private static final int CYCLE_SECONDS = 600; // 10분 = 외부 지표 1일
    private int currentTick = 0;
    private boolean isFirstDay = true; // 최초 시작 시 거대 매물벽 보장용

    // 오늘의 가상지표 (우리의 현재가에 곱해질 '목표 변동률')
    private double targetOpenFluct;
    private double targetHighFluct;
    private double targetLowFluct;
    private double targetCloseFluct;
    private boolean isHighFirst; // 고가를 먼저 찍을 것인가?

    // 600틱 동안의 타겟 '변동률'을 미리 계산해두는 메모리 배열
    private final double[] tickTargetFluctuations = new double[CYCLE_SECONDS];

    // 초당 생성량 (30~50건)
    private static final int MIN_TPS = 30;
    private static final int MAX_TPS = 50;

    private static final Integer ITEM_ID_GOLD = 1;

    // @Scheduled(fixedRate = 1000) // 1초마다 정확히 실행
    public void generateVirtualOrderTick() {
        if (currentTick == 0) {
            initNewDayCycle();
        }

        // 1. 현재 시장가(Redis Ticker) 실시간 조회
        long currentMarketPrice = getCurrentMarketPrice(ITEM_ID_GOLD);

        // 2. 메모리에 미리 계산된 현재 틱의 '목표 변동률' 가져와서 타겟가 계산 (이후 Tick Size 보정)
        double currentTargetFluct = tickTargetFluctuations[currentTick];
        double rawTargetPrice = currentMarketPrice * (1 + currentTargetFluct);
        long currentTargetPrice = applyTickSize(rawTargetPrice);

        // 3. 가상 봇 갯수 설정 (TPS)
        int botCount = ThreadLocalRandom.current().nextInt(MIN_TPS, MAX_TPS + 1);

        // 최초 시작 시드(Seed) 주문: 유동성 형성을 위해 엄청난 주문 쏟아내기
        if (isFirstDay && currentTick == 0) {
            botCount = 1000; // 최초 1회만 거물급 매물대 형성 (초기화)
            isFirstDay = false;
        }

        for (int i = 0; i < botCount; i++) {
            // 3. 방향 먼저 결정 (수량 및 가격 계산에 모두 필요)
            OrderType type = ThreadLocalRandom.current().nextBoolean() ? OrderType.BUY : OrderType.SELL;

            boolean priceGoingUp = currentTargetPrice > currentMarketPrice;
            boolean isSweeperBot = priceGoingUp ? type == OrderType.BUY : type == OrderType.SELL;

            // 4. 주문 가격 결정 (방향 인식 배치)
            // - 스윕 방향 봇: 타겟가 ± 소폭 랜덤 스프레드 → 기존 벽을 직접 뚫음
            // - 반대 방향 봇(유동성 공급): 타겟가에서 1~3 Tick 더 바깥(안전지대)에 배치
            // → 스윕이 진행 중인 구간을 방해하지 않고 자연스러운 원거리 호가 형성
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
            long orderQty = calculateSweepQtyPerBot(currentMarketPrice, currentTargetPrice, botCount, type, i);

            // 여러 가상 기관(회사)들이 참여하는 것처럼 보이기 위해 500번 ~ 999번 사이의 랜덤 회사 ID 부여
            long randomCompanyId = ThreadLocalRandom.current().nextLong(500, 1000);

            OrderCreationEventDto botEvent = OrderCreationEventDto.builder()
                    .itemId(ITEM_ID_GOLD)
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
        currentTick++;
        if (currentTick >= CYCLE_SECONDS) {
            currentTick = 0;
        }
    }

    /**
     * Market Sweep 수량 계산기: 반대편 호가창에서 현재가~목표가 구간의 총 잔량을 봇 수로 균등 분배합니다.
     * 스윕이 필요 없는 봇에게는 자연스러운 소량 주문(1~10개)을 배정합니다.
     *
     * @param currentPrice 현재 시장가
     * @param targetPrice  이번 틱의 목표가
     * @param botCount     이번 틱에 생성되는 봇 수
     * @param botOrderType 이 봇이 생성하는 주문 타입
     * @param botIndex     봇 인덱스 (0 이상)
     * @return 이 봇이 처리할 수량
     */
    private long calculateSweepQtyPerBot(long currentPrice, long targetPrice, int botCount, OrderType botOrderType,
            int botIndex) {
        boolean priceGoingUp = targetPrice > currentPrice;

        // 가격이 오르려면 매도(SELL) 물량을 매수(BUY)로 흡수해야 하고, 내리려면 그 반대
        boolean isSweeperOrder = priceGoingUp ? botOrderType == OrderType.BUY : botOrderType == OrderType.SELL;

        // 스윕 역할을 하지 않는 반대방향 봇은 그냥 소량 랜덤 주문으로 유동성 공급
        if (!isSweeperOrder) {
            return ThreadLocalRandom.current().nextLong(1, 11);
        }

        // 반대편 호가창에서 현재가~목표가 사이의 총 미체결 물량 조회
        // 가격이 오를 때는 SELL 호가창에서, 내릴 때는 BUY 호가창에서 장벽 수량 파악
        String oppositeType = priceGoingUp ? "SELL" : "BUY";
        double minScore = Math.min(currentPrice, targetPrice);
        double maxScore = Math.max(currentPrice, targetPrice);
        long totalSweepVolume = orderBookManager.getVolumeInScoreRange(ITEM_ID_GOLD, oppositeType, minScore, maxScore);

        if (totalSweepVolume <= 0) {
            // 장벽이 없으면 소량 주문으로도 충분
            return ThreadLocalRandom.current().nextLong(1, 11);
        }

        // 스윕용 봇 수(BUY or SELL 봇만 스윕하므로 절반 정도)로 총 잔량을 균등 분배
        // 각 봇이 처리할 물량 = 전체 스윕 물량 / 스윕 봇 수 (최소 1개는 보장)
        int sweepBotCount = Math.max(1, botCount / 2);
        long qtyPerBot = Math.max(1, totalSweepVolume / sweepBotCount);
        return qtyPerBot;
    }

    /**
     * 새로운 10분이 시작될 때(1일차), 새로운 목표 가격들을 세팅합니다.
     */
    private void initNewDayCycle() {
        // 현재 우리 서버의 "진짜 최근 체결된 시장가" 가져오기 (Redis)
        long currentMarketPrice = getCurrentMarketPrice(ITEM_ID_GOLD);

        // TODO: 외부 지표 테이블(gold_price_history)에서 시간 순서에 맞는 실제 데이터를 꺼내와야 함.
        // 추후 연결될 ERD 컬럼 형태의 변수 사전 정의 (Decimal(5,2) 이므로 Double로 받음)
        double mockFluctRate = ThreadLocalRandom.current().nextDouble(-0.02, 0.02); // ERD: fluct_rate (전일 종가 대비 당일 종가
                                                                                    // 등락률)
        double mockOpenHighFluctRate = ThreadLocalRandom.current().nextDouble(0.01, 0.03); // ERD: open_high_fluct_rate
                                                                                           // (시가 대비 고가 등락률)
        double mockOpenLowFluctRate = ThreadLocalRandom.current().nextDouble(-0.03, -0.01); // ERD: open_low_fluct_rate
                                                                                            // (시가 대비 저가 등락률)

        // 시가(Open)는 이전 틱의 종가(현재 시장가)에 약간의 갭(Gap) 상승/하락을 주며 시작한다고 가정 (원할 경우 0으로 설정 가능)
        // 현재 세팅: 전일 종가에서 명일 시가로 '정확히 이어지도록' 갭(Gap) 변동을 0.0으로 고정
        double openFluct = 0.0;

        // 고가(High), 저가(Low), 종가(Close) 등락률을 ERD 데이터(mock) 기반으로 세팅
        double highFluct = mockOpenHighFluctRate;
        double lowFluct = mockOpenLowFluctRate;
        double closeFluct = mockFluctRate; // 종가 기준 등락률

        // 외부 지표에 따른 오늘의 목표 등락률(Fluctuation) 세팅 (절대 금액은 매 틱마다 실시간 시장가에 곱해서 산출)
        targetOpenFluct = openFluct;
        targetHighFluct = highFluct;
        targetLowFluct = lowFluct;
        targetCloseFluct = closeFluct;

        // 패턴 결정 (50% 확률로 하루 동안 고가를 먼저 찍음)
        isHighFirst = ThreadLocalRandom.current().nextBoolean();

        log.info("[Virtual Index Cycle Started] Base: {} | Fluct (O/H/L/C): {} / {} / {} / {} (High first? {})",
                currentMarketPrice, targetOpenFluct, targetHighFluct, targetLowFluct, targetCloseFluct, isHighFirst);

        // 장 시작 시점에, 하루치 600틱에 대한 '타겟 변동률'을 1차 함수(선형 보간)로 미리 계산하여 배열에 저장
        for (int i = 0; i < CYCLE_SECONDS; i++) {
            tickTargetFluctuations[i] = calculateInterpolatedFluct(i);
        }
    }

    /**
     * 현재 초(0~599)에 해당하는 1차 함수(선형 보간) 타겟 변동률을 부드럽게 계산합니다.
     */
    private double calculateInterpolatedFluct(int tick) {
        if (tick < 200) {
            // Phase 1: 시가 -> 고가/저가 (0 ~ 199초) - 200초 분량
            double start = targetOpenFluct;
            double end = isHighFirst ? targetHighFluct : targetLowFluct;
            return interpolate(start, end, tick, 200);
        } else if (tick < 400) {
            // Phase 2: 고가/저가 -> 저가/고가 (200 ~ 399초) - 200초 분량
            double start = isHighFirst ? targetHighFluct : targetLowFluct;
            double end = isHighFirst ? targetLowFluct : targetHighFluct;
            return interpolate(start, end, tick - 200, 200);
        } else {
            // Phase 3: 저가/고가 -> 종가 (400 ~ 599초) - 200초 분량
            // 마지막 599초일 때 정확히 100% 도달(종가가 됨)하도록 분모를 199로 설정
            double start = isHighFirst ? targetLowFluct : targetHighFluct;
            double end = targetCloseFluct;
            return interpolate(start, end, tick - 400, 199);
        }
    }

    /**
     * 선형 보간법에 '변동성(Noise)'을 추가하여 실제 주식 차트처럼 오르락내리락하게 만듭니다.
     * 목표 지점에 도달할수록 노이즈를 줄여서 마지막엔 정확히 목표가(Target)를 타격하게 설계했습니다.
     */
    private double interpolate(double start, double end, int progress, int maxProgress) {
        // 1. 기본 1차 함수 직선 가격 (베이스 캠프)
        double progressRatio = (double) progress / maxProgress;
        double basePrice = start + (end - start) * progressRatio;

        // 2. 남은 시간(진척도)에 비례한 '노이즈 허용치' 계산
        // 목표점에 가까워질수록(ratio가 1에 가까워질수록) 허용치는 0으로 수렴하여 목표가 정확히 타격
        double remainingRatio = 1.0 - progressRatio;

        // 3. 랜덤 노이즈 발생 (위아래 최대 0.5% 파동)
        // 실제로는 상승(start->end) 구간이더라도 일시적으로 하락 파동이 생길 수 있음!
        double noiseFluct = ThreadLocalRandom.current().nextDouble(-0.005, 0.005);

        // 4. 베이스 가격에 (노이즈 * 허용치) 를 곱해서 최종 요동치는 가격 계산
        // progress 비율이 100%(마지막 틱)가 되면 remainingRatio가 0이 되어 노이즈가 완벽히 증발함
        return basePrice * (1.0 + (noiseFluct * remainingRatio));
    }

    /**
     * 호가 단위를 100원 범위 등으로 강제 절사(보정)하여 호가 파편화를 막는 로직
     */
    private long applyTickSize(double rawPrice) {
        long tickSize = 100L; // 추후 아이템 가격대에 따라 동적으로 가져올 수도 있음
        return Math.round(rawPrice / tickSize) * tickSize;
    }

    /**
     * 캐시(Redis)에서 가장 최근에 체결된 시장가(Last Traded Price)를 가져옵니다.
     */
    private long getCurrentMarketPrice(Integer itemId) {
        String tickerKey = "market:ticker:" + itemId + ":price";
        Object priceObj = redisTemplate.opsForValue().get(tickerKey);

        if (priceObj != null) {
            try {
                return Long.parseLong(priceObj.toString());
            } catch (NumberFormatException e) {
                // 파싱 에러 시 무시
            }
        }
        // 캐시 정보가 아예 없는 '최초 상장일'의 경우, 시드 가격(10,000원) 리턴
        return 10000L;
    }
}
