package com.ssafy.ecosim.domain.inventory.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;

@Getter
public class SlotSwapRequest {
    @NotNull(message = "출발 슬롯 번호는 필수입니다.")
    @Min(value = 0, message = "슬롯 번호는 0 이상이어야 합니다.")
    private Integer fromSlot;

    @NotNull(message = "도착 슬롯 번호는 필수입니다.")
    @Min(value = 0, message = "슬롯 번호는 0 이상이어야 합니다.")
    private Integer toSlot;
}
