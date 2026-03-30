package com.ssafy.ecosim.domain.market.dto.request;

import com.ssafy.ecosim.domain.market.entity.OrderType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Schema(description = "주문 생성 요청")
@Getter
@Setter
@NoArgsConstructor
public class UserOrderRequestDto {

    @Schema(description = "아이템 ID", example = "1")
    private Integer itemId;

    @Schema(description = "주문 타입 (BUY: 매수 / SELL: 매도)", example = "BUY")
    private OrderType orderType;

    @Schema(description = "주문 가격", example = "1500")
    private Long price;

    @Schema(description = "주문 수량", example = "10")
    private Long totalQuantity;
}
