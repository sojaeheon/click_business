package com.ssafy.ecosim.domain.market.dto.request;

import com.ssafy.ecosim.domain.market.entity.OrderType;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class UserOrderRequestDto {
    private Integer itemId;
    private OrderType orderType;
    private Long price;
    private Long totalQuantity;
}
