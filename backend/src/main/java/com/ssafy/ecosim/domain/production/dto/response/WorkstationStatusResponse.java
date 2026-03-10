package com.ssafy.ecosim.domain.production.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class WorkstationStatusResponse {
    private Long workstationId;
    private Integer level;
    private Boolean isActive;

    // Input info
    private Long inputItemId;
    private String inputItemName;
    private Long inputQuantity;

    // Output info
    private Long outputItemId;
    private String outputItemName;
    private Long outputQuantity;

    // Equipment info
    private Long equipmentId;
    private String equipmentName;
    private Integer equipmentLevel;
}
