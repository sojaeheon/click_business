package com.ssafy.ecosim.domain.market.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@EntityListeners(AuditingEntityListener.class)
@Table(name = "trade_history")
public class TradeHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "trade_history_id")
    private Long id;

    // 단방향 매핑 (MarketOrder가 TradeHistory를 몰라도 됨)
    // 외래 키를 직접 ID로 관리 (또는 ManyToOne 연관관계 매핑 선택 가능)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "market_order_id", nullable = false)
    private MarketOrder marketOrder;

    @Enumerated(EnumType.STRING)
    @Column(name = "order_type", nullable = false)
    private OrderType orderType;

    @Column(name = "price", nullable = false)
    private Long price;

    @Column(name = "execution_quantity", nullable = false)
    private Long executionQuantity;

    @Column(name = "is_collected", nullable = false)
    private Boolean isCollected;

    // 해당 테이블 ERD는 created_at 만 존재하므로 BaseEntity 상속 대신 직접 선언
    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public TradeHistory(MarketOrder marketOrder, OrderType orderType, Long price, Long executionQuantity) {
        this.marketOrder = marketOrder;
        this.orderType = orderType;
        this.price = price;
        this.executionQuantity = executionQuantity;
        this.isCollected = false; // 체결 시점엔 항상 수령 전 상태
    }

    // 아이템/대금 수령 처리
    public void collect() {
        if (Boolean.TRUE.equals(this.isCollected)) {
            throw new IllegalStateException("이미 수령 처리 완료된 거래입니다.");
        }
        this.isCollected = true;
    }
}
