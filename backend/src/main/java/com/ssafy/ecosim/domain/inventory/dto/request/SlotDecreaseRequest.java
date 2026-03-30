package com.ssafy.ecosim.domain.inventory.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;

@Schema(description = "슬롯 수량 감소 요청")
@Getter
public class SlotDecreaseRequest {

    @Schema(description = "수량을 감소시킬 슬롯 인덱스 (0부터 시작)", example = "2")
    @NotNull(message = "슬롯 번호는 필수입니다.")
    @Min(value = 0, message = "슬롯 번호는 0 이상이어야 합니다.")
    private Integer slotIndex;

    @Schema(description = "감소시킬 수량", example = "5")
    @NotNull(message = "차감 수량은 필수입니다.")
    @Min(value = 1, message = "차감 수량은 1 이상이어야 합니다.")
    private Long amount;
}
