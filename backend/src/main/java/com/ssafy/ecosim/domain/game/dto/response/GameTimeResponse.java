package com.ssafy.ecosim.domain.game.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GameTimeResponse {
    private Integer year;           // 년 (예: 2020)
    private Integer month;          // 월 (1~12)
    private Integer day;            // 일 (1~31)
    private Integer hour;           // 시 (0~23)
    private Integer minute;         // 분 (0~59)
    private Integer second;         // 초 (0~59)
    private String formattedDate;   // "2020-01-15"
    private String formattedTime;   // "14:30:45"
    private String fullDateTime;    // "2020-01-15 14:30:45"
    private Integer currentTick;    // 현재 틱 (0~599)
    private Long accumulatedSeconds; // 누적 게임시간(초)
}