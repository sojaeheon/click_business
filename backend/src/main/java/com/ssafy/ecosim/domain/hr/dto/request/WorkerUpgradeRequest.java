package com.ssafy.ecosim.domain.hr.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

@Schema(description = "일꾼 강화 요청")
public class WorkerUpgradeRequest {

    @Schema(description = "현재 강화할 일꾼 레벨 (1~5)", example = "1")
    @NotNull(message = "현재 레벨은 필수입니다.")
    @Min(value = 1, message = "레벨은 1 이상이어야 합니다.")
    @Max(value = 5, message = "레벨 6은 최대 레벨로 강화 불가합니다.")
    private Integer currentLevel;

    public WorkerUpgradeRequest() {}

    public Integer getCurrentLevel() { return currentLevel; }
    public void setCurrentLevel(Integer currentLevel) { this.currentLevel = currentLevel; }
}
