package com.ssafy.ecosim.domain.market.service;

import com.ssafy.ecosim.domain.market.entity.OrderType;
import com.ssafy.ecosim.domain.market.kafka.OrderEventPublisher;
import com.ssafy.ecosim.domain.market.dto.event.OrderCreationEventDto;
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
    // 추후 시장가 조회를 위해 추가
    private final RedisTemplate<String, Object> redisTemplate;

    // 사이클 관리
    private static final int CYCLE_SECONDS = 600; // 10분 = 외부 지표 1일
    private int currentTick = 0;
    private boolean isFirstDay = true; // 최초 시작 시 거대 매물벽 보장용

    // 오늘의 가상지표 (우리의 현재가에 곱해질 목표 금액들)
    private double targetOpenPrice;
    private double targetHighPrice;
    private double targetLowPrice;
    private double targetClosePrice;
    private boolean isHighFirst; // 고가를 먼저 찍을 것인가?

    // 초당 생성량 (30~50건)
    private static final int MIN_TPS = 30;
    private static final int MAX_TPS = 50;

    private static final Integer ITEM_ID_GOLD = 1;

    // @Scheduled(fixedRate = 1000) // 1초마다 정확히 실행
    public void generateVirtualOrderTick() {
        if (currentTick == 0) {
            initNewDayCycle();
        }

        // 1. 현재 틱(Tick)에 맞는 목표 시장가 선형 보간(Interpolation) 계산
        double currentTargetPrice = calculateInterpolatedPrice(currentTick);

        // 2. 가상 봇 갯수 설정 (TPS)
        int botCount = ThreadLocalRandom.current().nextInt(MIN_TPS, MAX_TPS + 1);

        // 최초 시작 시드(Seed) 주문: 유동성 형성을 위해 엄청난 주문 쏟아내기
        if (isFirstDay && currentTick == 0) {
            botCount = 1000; // 최초 1회만 거물급 매물대 형성 (초기화)
            isFirstDay = false;
        }

        for (int i = 0; i < botCount; i++) {
            // 3. 목표가 근처로 가격 흩뿌리기 (Spread) - 위아래 0.1% 내외 랜덤 변동
            // 유저 피드백 반영: 정확한 타겟 가격에 도달하도록 루프의 첫 번째 주문(i==0)은 Spread 없이 100% 목표가로 관통!
            double spreadRatio = 1.0;
            if (i > 0) {
                spreadRatio += ThreadLocalRandom.current().nextDouble(-0.001, 0.001);
            }
            long orderPrice = Math.round(currentTargetPrice * spreadRatio);

            // 4. 소량의 수량 쪼개기 (개미 봇인 척 1~10개씩 주문)
            long orderQty = ThreadLocalRandom.current().nextLong(1, 11);

            // 5. 양방향 마켓 메이킹 (BUY, SELL 무작위 섞기)
            OrderType type = ThreadLocalRandom.current().nextBoolean() ? OrderType.BUY : OrderType.SELL;

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

        // 우리 시장가에 등락률을 곱해 타겟 절대 금액 설정 (유저 개입으로 시장가가 변해도 비율만큼 따라감)
        targetOpenPrice = Math.round(currentMarketPrice * (1 + openFluct));
        targetHighPrice = Math.round(currentMarketPrice * (1 + highFluct));
        targetLowPrice = Math.round(currentMarketPrice * (1 + lowFluct));
        targetClosePrice = Math.round(currentMarketPrice * (1 + closeFluct));

        // 패턴 결정 (50% 확률로 하루 동안 고가를 먼저 찍음)
        isHighFirst = ThreadLocalRandom.current().nextBoolean();

        log.info("[Virtual Index Cycle Started] Base: {}, Open: {}, High: {}, Low: {}, Close: {} (High first? {})",
                currentMarketPrice, (long) targetOpenPrice, (long) targetHighPrice, (long) targetLowPrice,
                (long) targetClosePrice, isHighFirst);
    }

    /**
     * 현재 초(0~599)에 해당하는 1차 함수(선형 보간) 타겟 가격을 부드럽게 계산합니다.
     */
    private double calculateInterpolatedPrice(int tick) {
        if (tick < 200) {
            // Phase 1: 시가 -> 고가/저가 (0 ~ 199초) - 200초 분량
            double start = targetOpenPrice;
            double end = isHighFirst ? targetHighPrice : targetLowPrice;
            return interpolate(start, end, tick, 200);
        } else if (tick < 400) {
            // Phase 2: 고가/저가 -> 저가/고가 (200 ~ 399초) - 200초 분량
            double start = isHighFirst ? targetHighPrice : targetLowPrice;
            double end = isHighFirst ? targetLowPrice : targetHighPrice;
            return interpolate(start, end, tick - 200, 200);
        } else {
            // Phase 3: 저가/고가 -> 종가 (400 ~ 599초) - 200초 분량
            // 마지막 599초일 때 정확히 100% 도달(종가가 됨)하도록 분모를 199로 설정
            double start = isHighFirst ? targetLowPrice : targetHighPrice;
            double end = targetClosePrice;
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
