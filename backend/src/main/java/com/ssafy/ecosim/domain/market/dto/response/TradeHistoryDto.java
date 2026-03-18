package com.ssafy.ecosim.domain.market.dto.response;

import com.ssafy.ecosim.domain.market.entity.OrderType;
import com.ssafy.ecosim.domain.market.entity.TradeHistory;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
public class TradeHistoryDto {
    private long tradeHistoryId;
    private long orderId;
    private int itemId;
    private long price;
    private long executionQuantity;
    private OrderType orderType;
    private boolean isCollected;
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
