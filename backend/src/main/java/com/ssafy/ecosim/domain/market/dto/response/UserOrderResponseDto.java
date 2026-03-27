package com.ssafy.ecosim.domain.market.dto.response;

import com.ssafy.ecosim.domain.market.entity.MarketOrder;
import com.ssafy.ecosim.domain.market.entity.OrderStatus;
import com.ssafy.ecosim.domain.market.entity.OrderType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;

import java.time.LocalDateTime;

@Schema(description = "사용자 주문 내역 응답")
@Getter
public class UserOrderResponseDto {

    @Schema(description = "주문 ID", example = "42")
    private String orderId;

    @Schema(description = "아이템 ID", example = "1")
    private Integer itemId;

    @Schema(description = "주문 타입 (BUY/SELL)")
    private OrderType orderType;

    @Schema(description = "주문 가격", example = "113900")
    private Long price;

    @Schema(description = "요청 전체 수량", example = "100")
    private Long totalQuantity;

    @Schema(description = "미체결 잔량", example = "30")
    private Long remainingQuantity;

    @Schema(description = "주문 상태 (PENDING/PARTIALLY_COMPLETED/COMPLETED/CANCELED)")
    private OrderStatus status;

    @Schema(description = "주문 생성 일시")
    private LocalDateTime createdAt;

    public UserOrderResponseDto(MarketOrder order) {
        this.orderId = order.getId().toString();
        this.itemId = order.getItemId();
        this.orderType = order.getOrderType();
        this.price = order.getPrice();
        this.totalQuantity = order.getTotalQuantity();
        this.remainingQuantity = order.getRemainingQuantity();
        this.status = order.getStatus();
        this.createdAt = order.getCreatedAt();
    }
}
