package com.ssafy.ecosim.domain.market.entity;

import com.ssafy.ecosim.global.common.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "market_order")
public class MarketOrder extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "market_order_id")
    private Long id;

    // 아이템 코드는 Integer로 정의되어 있음 (ERD 참조)
    @Column(name = "item_id", nullable = false)
    private Integer itemId;

    @Column(name = "company_id", nullable = false)
    private Long companyId;

    @Enumerated(EnumType.STRING)
    @Column(name = "order_type", nullable = false)
    private OrderType orderType;

    @Column(name = "price", nullable = false)
    private Long price;

    @Column(name = "total_quantity", nullable = false)
    private Long totalQuantity;

    @Column(name = "remaining_quantity", nullable = false)
    private Long remainingQuantity;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private OrderStatus status;

    @Column(name = "is_virtual", nullable = false)
    private Boolean isVirtual;

    @Builder
    public MarketOrder(Long id, Integer itemId, Long companyId, OrderType orderType, Long price, Long totalQuantity, Long remainingQuantity, OrderStatus status, Boolean isVirtual) {
        this.id = id;
        this.itemId = itemId;
        this.companyId = companyId;
        this.orderType = orderType;
        this.price = price;
        this.totalQuantity = totalQuantity;
        this.remainingQuantity = remainingQuantity != null ? remainingQuantity : totalQuantity;
        this.status = status != null ? status : OrderStatus.PENDING;
        this.isVirtual = isVirtual != null ? isVirtual : false;
    }

    // 비즈니스 로직: 잔량 차감 및 상태 변경
    public void executeTrade(Long tradeQuantity) {
        if (this.remainingQuantity < tradeQuantity) {
            throw new IllegalArgumentException("체결 수량이 미체결 잔량보다 많습니다.");
        }
        
        this.remainingQuantity -= tradeQuantity;
        
        if (this.remainingQuantity == 0) {
            this.status = OrderStatus.COMPLETED;
        } else {
            this.status = OrderStatus.PARTIALLY_COMPLETED;
        }
    }

    // 주문 취소 로직
    public void cancelOrder() {
        if (this.status == OrderStatus.COMPLETED || this.status == OrderStatus.CANCELED) {
            throw new IllegalStateException("이미 체결 완료되거나 취소된 주문입니다.");
        }
        this.status = OrderStatus.CANCELED;
    }
}
