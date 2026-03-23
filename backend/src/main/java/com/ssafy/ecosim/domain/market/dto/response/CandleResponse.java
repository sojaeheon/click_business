package com.ssafy.ecosim.domain.market.dto.response;

import com.ssafy.ecosim.domain.market.dto.CandleData;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CandleResponse {
    private Long open;
    private Long high;
    private Long low;
    private Long close;
    private Long volume;
    private Long timestamp;
    private Boolean isLive;  // 현재 진행중인 분봉 여부

    public static CandleResponse from(CandleData candle, boolean isLive) {
        return CandleResponse.builder()
            .open(candle.getOpen())
            .high(candle.getHigh())
            .low(candle.getLow())
            .close(candle.getClose())
            .volume(candle.getVolume())
            .timestamp(candle.getTimestamp())
            .isLive(isLive)
            .build();
    }
}