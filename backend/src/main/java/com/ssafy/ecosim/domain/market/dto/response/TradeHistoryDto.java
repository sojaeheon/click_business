package com.ssafy.ecosim.domain.market.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.ssafy.ecosim.domain.market.entity.OrderType;
import com.ssafy.ecosim.domain.market.entity.TradeHistory;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;

import java.time.LocalDateTime;

@Schema(description = "체결 내역 응답")
@Getter
public class TradeHistoryDto {

    @Schema(description = "체결 내역 ID", example = "7")
    private long tradeHistoryId;

    @Schema(description = "원 주문 ID", example = "42")
    private long orderId;

    @Schema(description = "아이템 ID", example = "1")
    private int itemId;

    @Schema(description = "체결 가격", example = "1500")
    private long price;

    @Schema(description = "체결 수량", example = "5")
    private long executionQuantity;

    @Schema(description = "주문 타입 (BUY / SELL)", example = "BUY")
    private OrderType orderType;

    @Schema(description = "수령 완료 여부", example = "false")
    @JsonProperty("isCollected")
    private boolean isCollected;

    @Schema(description = "체결 시각", example = "2026-03-19T11:00:00")
    private LocalDateTime createdAt;

    public TradeHistoryDto(TradeHistory tradeHistory) {
        this.tradeHistoryId = tradeHistory.getId();
        this.orderId = tradeHistory.getMarketOrder().getId();
        this.itemId = tradeHistory.getMarketOrder().getItemId();
        this.price = tradeHistory.getPrice();
        this.executionQuantity = tradeHistory.getExecutionQuantity();
        this.orderType = tradeHistory.getOrderType();
        this.isCollected = tradeHistory.getIsCollected();
        this.createdAt = tradeHistory.getCreatedAt();
    }
}
