package com.ssafy.ecosim.domain.game.service;

import com.ssafy.ecosim.domain.game.dto.response.GameTimeResponse;
import com.ssafy.ecosim.global.util.GameTimeUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
public class GameTimeService {

    private final GameTimeUtil gameTimeUtil;
    
    private static final int CYCLE_SECONDS = 600; // 10분 사이클

    public GameTimeResponse getCurrentGameTime() {
        // 1. 현재 게임 날짜 조회
        LocalDate currentDate = gameTimeUtil.getCurrentGameDate();
        
        // 2. 현재 틱 조회 (0~599)
        int currentTick = gameTimeUtil.getCurrentTick();
        
        // 3. 누적 게임시간 조회
        long accumulatedSeconds = gameTimeUtil.getAccumulatedGameSeconds();
        
        // 4. 틱을 시:분:초로 변환 (10분 = 600초를 24시간에 매핑)
        // 600초 = 24시간 → 1초 = 144초 (86400/600)
        int totalSecondsInDay = currentTick * 144; // 실제 하루의 초로 환산
        
        int hour = totalSecondsInDay / 3600;
        int minute = (totalSecondsInDay % 3600) / 60;
        int second = totalSecondsInDay % 60;
        
        // 5. 응답 생성
        return GameTimeResponse.builder()
                .year(currentDate.getYear())
                .month(currentDate.getMonthValue())
                .day(currentDate.getDayOfMonth())
                .hour(hour)
                .minute(minute)
                .second(second)
                .formattedDate(currentDate.format(DateTimeFormatter.ISO_LOCAL_DATE))
                .formattedTime(String.format("%02d:%02d:%02d", hour, minute, second))
                .fullDateTime(String.format("%s %02d:%02d:%02d", 
                    currentDate.format(DateTimeFormatter.ISO_LOCAL_DATE), 
                    hour, minute, second))
                .currentTick(currentTick)
                .accumulatedSeconds(accumulatedSeconds)
                .build();
    }
}