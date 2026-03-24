package com.ssafy.ecosim.domain.minigame.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Schema(description = "미니게임 플레이 가능 상태 응답")
@Getter
@AllArgsConstructor
public class MinigameStatusResponse {

    @Schema(description = "플레이 가능 여부", example = "true")
    private final boolean canPlay;

    @Schema(description = "불가 사유 (canPlay가 false인 경우)", example = "인벤토리가 가득 찼습니다.")
    private final String reason;

    @Schema(description = "필요 금액", example = "100000")
    private final long cost;

    public static MinigameStatusResponse success(long cost) {
        return new MinigameStatusResponse(true, null, cost);
    }

    public static MinigameStatusResponse failure(String reason, long cost) {
        return new MinigameStatusResponse(false, reason, cost);
    }
}
