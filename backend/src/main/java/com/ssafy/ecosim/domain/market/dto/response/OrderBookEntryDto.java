package com.ssafy.ecosim.domain.market.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class OrderBookEntryDto {
    private long price;
    private long totalQuantity;
}
