package com.ssafy.ecosim.domain.inventory.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;

@Getter
public class SlotDecreaseRequest {

    @NotNull(message = "슬롯 번호는 필수입니다.")
    @Min(value = 0, message = "슬롯 번호는 0 이상이어야 합니다.")
    private Integer slotIndex;

    @NotNull(message = "차감 수량은 필수입니다.")
    @Min(value = 1, message = "차감 수량은 1 이상이어야 합니다.")
    private Long amount;
}
