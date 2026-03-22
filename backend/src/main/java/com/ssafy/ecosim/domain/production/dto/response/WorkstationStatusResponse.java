package com.ssafy.ecosim.domain.production.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

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

    @Schema(description = "장착된 일꾼 레벨 (null = 미장착)", example = "3")
    private Integer equippedWorkerLevel;

    @Schema(description = "장착된 일꾼 슬롯 인덱스 (null = 미장착)", example = "0")
    private Integer equippedWorkerSlotIndex;

    @Schema(description = "예약 재료 소진 예상 시각 (비가동 또는 재료 없으면 null)", example = "2026-03-22T19:30:00Z")
    private Instant expectedEndTime;
}
