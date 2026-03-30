package com.ssafy.ecosim.global.util;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;

/**
 * 게임 시뮬레이션 시간을 관리하는 유틸리티 클래스
 * 
 * 서버 가동 시간 기준으로 게임시간을 계산합니다.
 * - 실제 10분(600초) = 게임 1일(86,400초)
 * - 실제 1초 = 게임 144초
 * 
 * GameTimeScheduler가 매초 게임시간을 증가시키며,
 * 이 클래스는 조회 기능만 제공합니다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GameTimeUtil {
    
    private final RedisTemplate<String, Object> redisTemplate;
    private final RedisTemplate<String, String> stringRedisTemplate; // 숫자 조회용
    
    // Redis 키
    private static final String GAME_ACCUMULATED_SECONDS_KEY = "game:accumulated:seconds";
    private static final String GAME_SIMULATION_DATE_KEY = "game:simulation:date";
    private static final String GAME_SIMULATION_TICK_KEY = "game:simulation:tick";
    private static final String GAME_SIMULATION_START_KEY = "game:simulation:start_date"; // 시뮬레이션 최초 시작일
    
    // 게임 시간 상수
    private static final int SECONDS_PER_DAY = 86400; // 게임 1일 = 86,400초
    
    /**
     * 게임 시뮬레이션의 현재 시간을 epoch milliseconds로 반환합니다.
     * 
     * @return 게임시간 기준 현재 timestamp (epoch millis)
     */
    public long getCurrentGameTimestamp() {
        try {
            // Redis에서 누적 게임시간 조회
            Object accObj = stringRedisTemplate.opsForValue().get(GAME_ACCUMULATED_SECONDS_KEY);
            long accumulatedSeconds = accObj != null ? Long.parseLong(accObj.toString()) : 0;
            
            // 게임 날짜 조회
            LocalDate gameDate = getCurrentGameDate();
            
            // 오늘의 경과 시간 (초)
            long secondsToday = accumulatedSeconds % SECONDS_PER_DAY;
            
            // LocalDate + 초 → epoch millis
            return gameDate.atStartOfDay()
                .plusSeconds(secondsToday)
                .atZone(ZoneId.systemDefault())
                .toInstant()
                .toEpochMilli();
                
        } catch (Exception e) {
            log.error("[GameTimeUtil] 게임 타임스탬프 계산 실패", e);
            // 폴백: 기본 날짜 반환
            return LocalDate.of(2020, 1, 1)
                .atStartOfDay()
                .atZone(ZoneId.systemDefault())
                .toInstant()
                .toEpochMilli();
        }
    }
    
    /**
     * 게임시간 기준 현재 날짜를 반환합니다.
     * 
     * @return 게임시간 기준 현재 날짜
     */
    public LocalDate getCurrentGameDate() {
        Object dateObj = redisTemplate.opsForValue().get(GAME_SIMULATION_DATE_KEY);
        
        if (dateObj == null) {
            log.warn("[GameTimeUtil] Redis {}가 없습니다. 기본값 사용", GAME_SIMULATION_DATE_KEY);
            return LocalDate.of(2020, 1, 1);
        }
        
        try {
            return LocalDate.parse(dateObj.toString());
        } catch (Exception e) {
            log.error("[GameTimeUtil] Redis {} 파싱 실패: {}", GAME_SIMULATION_DATE_KEY, dateObj, e);
            return LocalDate.of(2020, 1, 1);
        }
    }
    
    /**
     * 현재 사이클 내 틱(0~599)을 반환합니다.
     * 
     * @return 현재 틱 (0~599)
     */
    public int getCurrentTick() {
        Object tickObj = stringRedisTemplate.opsForValue().get(GAME_SIMULATION_TICK_KEY);
        
        if (tickObj == null) {
            return 0;
        }
        
        try {
            return Integer.parseInt(tickObj.toString());
        } catch (Exception e) {
            log.error("[GameTimeUtil] Redis {} 파싱 실패: {}", GAME_SIMULATION_TICK_KEY, tickObj, e);
            return 0;
        }
    }
    
    /**
     * 누적 게임시간(초)을 반환합니다.
     * 
     * @return 누적 게임시간 (초 단위)
     */
    public long getAccumulatedGameSeconds() {
        Object accObj = stringRedisTemplate.opsForValue().get(GAME_ACCUMULATED_SECONDS_KEY);
        
        if (accObj == null) {
            return 0;
        }
        
        try {
            return Long.parseLong(accObj.toString());
        } catch (Exception e) {
            log.error("[GameTimeUtil] Redis {} 파싱 실패: {}", GAME_ACCUMULATED_SECONDS_KEY, accObj, e);
            return 0;
        }
    }

    /**
     * 시뮬레이션 최초 시작 시각을 epoch millis로 반환합니다.
     * 서버 시작 시 Redis에 저장된 게임 시작일(2020-01-01 etc)을 사용합니다.
     * 
     * @return 시뮬레이션 시작 epoch millis
     */
    public long getSimulationStartTimestamp() {
        try {
            // 현재 게임 날짜가 아니라 "최초 시작일"을 가져옴
            // game:simulation:date는 날짜가 진행될수록 바뀌므로,
            // 최초 시작일은 별도 키(game:simulation:start_date)로 저장 필요.
            // 없으면 기본 2020-01-01 00:00:00 사용
            Object startObj = redisTemplate.opsForValue().get(GAME_SIMULATION_START_KEY);
            LocalDate startDate = startObj != null
                ? LocalDate.parse(startObj.toString())
                : LocalDate.of(2020, 1, 1);

            return startDate.atStartOfDay(ZoneId.systemDefault())
                .toInstant().toEpochMilli();
        } catch (Exception e) {
            log.error("[GameTimeUtil] 시뮬레이션 시작 시각 조회 실패", e);
            return LocalDate.of(2020, 1, 1)
                .atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
        }
    }

    /**
     * 시뮬레이션 최초 시작 날짜(LocalDate)를 반환합니다.
     * CandleAggregator에서 epoch millis 변환 시 사용합니다.
     */
    public LocalDate getSimulationStartDate() {
        try {
            Object startObj = redisTemplate.opsForValue().get(GAME_SIMULATION_START_KEY);
            if (startObj != null) {
                return LocalDate.parse(startObj.toString());
            }
        } catch (Exception e) {
            log.error("[GameTimeUtil] 시뮬레이션 시작일 조회 실패", e);
        }
        return LocalDate.of(2020, 1, 1);
    }
}
