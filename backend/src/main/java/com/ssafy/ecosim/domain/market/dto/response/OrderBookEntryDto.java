package com.ssafy.ecosim.domain.market.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Schema(description = "호가 단위 항목")
@Getter
@AllArgsConstructor
public class OrderBookEntryDto {

    @Schema(description = "호가 가격", example = "1500")
    private long price;

    @Schema(description = "해당 호가의 총 수량", example = "30")
    private long totalQuantity;
}
