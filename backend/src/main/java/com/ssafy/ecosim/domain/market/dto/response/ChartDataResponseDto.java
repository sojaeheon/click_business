package com.ssafy.ecosim.domain.market.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

@Schema(description = "실시간 누적 차트 데이터 응답")
@Getter
@AllArgsConstructor
public class ChartDataResponseDto {

    @Schema(description = "아이템 ID", example = "1")
    private int itemId;

    @Schema(description = "차트 포인트 목록 (과거 -> 최신 순 정렬)")
    private List<ChartPointDto> points;

    @Schema(description = "개별 차트 포인트")
    @Getter
    @AllArgsConstructor
    public static class ChartPointDto {
        @Schema(description = "체결 시각(epoch millis)", example = "1742634816000")
        private Long timestamp;

        @Schema(description = "체결 가격", example = "113900")
        private Long price;
    }
}
