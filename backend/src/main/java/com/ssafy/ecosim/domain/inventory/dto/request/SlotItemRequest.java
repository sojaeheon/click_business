package com.ssafy.ecosim.domain.inventory.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;

@Schema(description = "슬롯 이동/병합 요청")
@Getter
public class SlotItemRequest {

    @Schema(description = "이동 출발 슬롯 인덱스 (0부터 시작)", example = "0")
    @NotNull(message = "출발 슬롯 번호는 필수입니다.")
    @Min(value = 0, message = "슬롯 번호는 0 이상이어야 합니다.")
    private Integer fromSlot;

    @Schema(description = "이동 도착 슬롯 인덱스 (0부터 시작)", example = "3")
    @NotNull(message = "도착 슬롯 번호는 필수입니다.")
    @Min(value = 0, message = "슬롯 번호는 0 이상이어야 합니다.")
    private Integer toSlot;
}
