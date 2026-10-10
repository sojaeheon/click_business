package com.ssafy.ecosim.global.scheduler;

import com.ssafy.ecosim.domain.market.entity.ExternalIndex;
import com.ssafy.ecosim.domain.market.repository.ExternalIndexRepository;
import com.ssafy.ecosim.domain.market.service.CandleAggregator;
import com.ssafy.ecosim.global.util.GameTimeUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.time.LocalDate;
import java.util.Optional;

/**
 * 게임 시뮬레이션 시간을 중앙에서 관리하는 스케줄러
 * 
 * 서버 가동 시간 기준으로 게임시간을 진행시킵니다.
 * - 실제 1초마다 게임 144초 진행
 * - 실제 10분(600초) = 게임 1일(86,400초)
 */
@Slf4j
@Component
@EnableScheduling
@ConditionalOnProperty(name = "game-time.enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
public class GameTimeScheduler {
    
    private final RedisTemplate<String, Object> redisTemplate;
    private final RedisTemplate<String, String> stringRedisTemplate;
    private final ExternalIndexRepository externalIndexRepository;
    private final CandleAggregator candleAggregator; // 게임 시간 기반 캔들 트리거
    private final GameTimeUtil gameTimeUtil; // 캔들 시작 시각 epoch millis 조회용
    
    // Redis 키
    private static final String GAME_ACCUMULATED_SECONDS_KEY = "game:accumulated:seconds";
    private static final String GAME_SIMULATION_DATE_KEY = "game:simulation:date";
    private static final String GAME_SIMULATION_TICK_KEY = "game:simulation:tick";
    private static final String GAME_SERVER_START_TIME_KEY = "game:server:start_time";
    
    // 게임 시간 상수
    private static final int GAME_SPEED_MULTIPLIER = 144; // 실제 1초 = 게임 144초
    private static final int SECONDS_PER_DAY = 86400; // 게임 1일 = 86,400초
    private static final int CYCLE_SECONDS = 600; // 실제 10분 = 게임 1일
    // 1분봉 경계 주기: 실제 1분 = 게임 144분 = 8,640 game-seconds
    private static final long CANDLE_1MIN_INTERVAL = CandleAggregator.CANDLE_1MIN_GAME_SECONDS;
    // 5분봉 경계 주기: 실제 5분 = 게임 720분 = 43,200 game-seconds
    private static final long CANDLE_5MIN_INTERVAL = CandleAggregator.CANDLE_5MIN_GAME_SECONDS;
    
    /**
     * 서버 시작 시 게임시간 초기화
     */
    @PostConstruct
    public void initializeGameTime() {
        // 이미 초기화된 경우 스킵
        Object startTimeObj = redisTemplate.opsForValue().get(GAME_SERVER_START_TIME_KEY);
        if (startTimeObj != null) {
            log.info("[GameTimeScheduler] 기존 게임시간 데이터 발견. 계속 진행합니다.");
            logCurrentGameTime();
            return;
        }
        
        // 최초 초기화
        long now = System.currentTimeMillis();
        stringRedisTemplate.opsForValue().set(GAME_SERVER_START_TIME_KEY, String.valueOf(now));
        stringRedisTemplate.opsForValue().set(GAME_ACCUMULATED_SECONDS_KEY, "0");
        stringRedisTemplate.opsForValue().set(GAME_SIMULATION_TICK_KEY, "0");
        
        // 첫 외부 지표 데이터 로드 (아이템 ID 1번 기준)
        Optional<ExternalIndex> firstIndex = externalIndexRepository.findFirstByItemIdOrderByPriceDateAsc(1L);
        LocalDate initialDate = firstIndex.map(ExternalIndex::getPriceDate).orElse(LocalDate.of(2020, 1, 1));
        redisTemplate.opsForValue().set(GAME_SIMULATION_DATE_KEY, initialDate.toString());
        redisTemplate.opsForValue().set("game:simulation:start_date", initialDate.toString()); // 최초 시작일 별도 보존
        
        log.info("[GameTimeScheduler] 게임시간 초기화 완료: 시작일={}, 서버시작시각={}", initialDate, now);
    }
    
    /**
     * 매 1초마다 게임시간 증가 (144초 진행)
     */
    @Scheduled(fixedRate = 1000)
    public void incrementGameTime() {
        try {
            // 누적 게임시간 증가
            Long accumulated = stringRedisTemplate.opsForValue().increment(GAME_ACCUMULATED_SECONDS_KEY, GAME_SPEED_MULTIPLIER);
            if (accumulated == null) {
                log.warn("[GameTimeScheduler] 누적 게임시간 증가 실패. 재초기화 필요.");
                return;
            }
            
            // 현재 틱 계산 (0~599 순환)
            int currentTick = (int)((accumulated / GAME_SPEED_MULTIPLIER) % CYCLE_SECONDS);
            stringRedisTemplate.opsForValue().set(GAME_SIMULATION_TICK_KEY, String.valueOf(currentTick));
            
            // 날짜 변경 감지 (86,400초마다)
            long daysPassed = accumulated / SECONDS_PER_DAY;
            if (accumulated % SECONDS_PER_DAY < GAME_SPEED_MULTIPLIER) {
                advanceToNextDay(daysPassed);
            }

            // ✅ 1분봉 트리거: 게임 8,640초 배수에 도달하면 캔들 확정
            if (accumulated % CANDLE_1MIN_INTERVAL < GAME_SPEED_MULTIPLIER) {
                // 현재 게임시간을 epoch millis로 변환 후 144분 단위 경계로 내림
                long nowMs = gameTimeUtil.getCurrentGameTimestamp();
                long candleStartMillis = (nowMs / 8_640_000L) * 8_640_000L - 8_640_000L;
                log.info("[GameTimeScheduler] 1분봉 트리거 (candleStartMs={})", candleStartMillis);
                candleAggregator.aggregate1MinCandleAt(candleStartMillis);
            }

            // ✅ 5분봉 트리거: 게임 43,200초 배수에 도달하면 캔들 확정
            if (accumulated % CANDLE_5MIN_INTERVAL < GAME_SPEED_MULTIPLIER) {
                long nowMs = gameTimeUtil.getCurrentGameTimestamp();
                long candleStartMillis = (nowMs / 43_200_000L) * 43_200_000L - 43_200_000L;
                log.info("[GameTimeScheduler] 5분봉 트리거 (candleStartMs={})", candleStartMillis);
                candleAggregator.aggregate5MinCandleAt(candleStartMillis);
            }

            // 매 10초마다 로그 (디버깅용)
            if (currentTick % 10 == 0) {
                logCurrentGameTime();
            }
            
        } catch (Exception e) {
            log.error("[GameTimeScheduler] 게임시간 증가 중 오류 발생", e);
        }
    }
    
    /**
     * 다음 날짜로 전환
     */
    private void advanceToNextDay(long daysPassed) {
        try {
            Object dateObj = redisTemplate.opsForValue().get(GAME_SIMULATION_DATE_KEY);
            LocalDate currentDate = dateObj != null 
                ? LocalDate.parse(dateObj.toString()) 
                : LocalDate.of(2020, 1, 1);
            
            // 외부 지표에서 다음 날짜 조회 (아이템 ID 1번 기준)
            Optional<ExternalIndex> nextIndex = externalIndexRepository
                .findFirstByItemIdAndPriceDateAfterOrderByPriceDateAsc(1L, currentDate);
            
            // 데이터 소진 시 처음부터 순환
            if (nextIndex.isEmpty()) {
                nextIndex = externalIndexRepository.findFirstByItemIdOrderByPriceDateAsc(1L);
            }
            
            LocalDate nextDate = nextIndex.map(ExternalIndex::getPriceDate)
                .orElse(currentDate.plusDays(1));
            
            redisTemplate.opsForValue().set(GAME_SIMULATION_DATE_KEY, nextDate.toString());
            
            log.info("[GameTimeScheduler] 날짜 전환: {} → {} (경과 게임일: {}일)", 
                currentDate, nextDate, daysPassed);
                
        } catch (Exception e) {
            log.error("[GameTimeScheduler] 날짜 전환 중 오류 발생", e);
        }
    }
    
    /**
     * 현재 게임시간 정보 로그 출력
     */
    private void logCurrentGameTime() {
        try {
            Object accObj = stringRedisTemplate.opsForValue().get(GAME_ACCUMULATED_SECONDS_KEY);
            Object tickObj = stringRedisTemplate.opsForValue().get(GAME_SIMULATION_TICK_KEY);
            Object dateObj = redisTemplate.opsForValue().get(GAME_SIMULATION_DATE_KEY);
            
            long accumulated = accObj != null ? Long.parseLong(accObj.toString()) : 0;
            int tick = tickObj != null ? Integer.parseInt(tickObj.toString()) : 0;
            String date = dateObj != null ? dateObj.toString() : "unknown";
            
            long daysPassed = accumulated / SECONDS_PER_DAY;
            long secondsToday = accumulated % SECONDS_PER_DAY;
            
            log.debug("[GameTime] 날짜={}, 경과일={}일, 오늘경과={}초, 틱={}/600", 
                date, daysPassed, secondsToday, tick);
                
        } catch (Exception e) {
            log.warn("[GameTimeScheduler] 게임시간 로그 출력 실패", e);
        }
    }
}
