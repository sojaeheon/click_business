package com.ssafy.ecosim.domain.hr.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "일꾼 강화 결과 응답")
public class WorkerUpgradeResponse {

    public enum UpgradeResult { success, stay, down, reset }

    @Schema(description = "강화 결과 (success/stay/down/reset)", example = "success")
    private final UpgradeResult result;

    @Schema(description = "강화 후 일꾼 레벨 (reset 시 0)", example = "2")
    private final int newLevel;

    public WorkerUpgradeResponse(UpgradeResult result, int newLevel) {
        this.result = result;
        this.newLevel = newLevel;
    }

    public UpgradeResult getResult() { return result; }
    public int getNewLevel() { return newLevel; }
}
