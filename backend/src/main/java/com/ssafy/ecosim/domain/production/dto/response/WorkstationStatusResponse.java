package com.ssafy.ecosim.domain.production.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;

@Schema(description = "공장 상태 응답")
@Getter
@Builder
public class WorkstationStatusResponse {

    @Schema(description = "공장 ID", example = "1")
    private Long workstationId;

    @Schema(description = "공장 레벨", example = "1")
    private Integer level;

    @Schema(description = "가동 중 여부", example = "true")
    private Boolean isActive;

    @Schema(description = "예약된 재료 수량", example = "10")
    private Long reservedQuantity;

    @Schema(description = "생산 완료된 수량", example = "5")
    private Long producedQuantity;

    @Schema(description = "결과물 아이템 ID", example = "2")
    private Long outputItemId;

    @Schema(description = "결과물 아이템 이름", example = "정제 금속")
    private String outputItemName;

    @Schema(description = "결과물 수량", example = "5")
    private Long outputQuantity;

    @Schema(description = "장착된 장비 ID", example = "3")
    private Long equipmentId;

    @Schema(description = "장착된 장비 이름", example = "고급 용광로")
    private String equipmentName;

    @Schema(description = "장착된 장비 레벨", example = "2")
    private Integer equipmentLevel;
}
