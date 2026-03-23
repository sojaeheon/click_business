package com.ssafy.ecosim.domain.market.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CandleData {
    private Long open;
    private Long high;
    private Long low;
    private Long close;
    private Long volume;
    private Long timestamp; // 분봉 시작 시간 (밀리초)
}