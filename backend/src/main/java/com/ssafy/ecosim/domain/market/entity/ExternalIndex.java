package com.ssafy.ecosim.domain.market.entity;

import com.ssafy.ecosim.domain.item.entity.Item;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZonedDateTime;

/**
 * 외부 시장 지표(금, 금괴, 금드릴 등)의 히스토리 데이터를 저장하는 엔티티입니다.
 * DE팀에서 DB에 직접 적재하며, 백엔드에서는 이를 조회하여 가상 주문 생성의 기준가로 활용합니다.
 */
@Entity
@Table(name = "external_index")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ExternalIndex {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "external_index_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_id", nullable = false)
    private Item item;

    @Column(name = "price_date", nullable = false)
    private LocalDate priceDate;

    @Column(name = "open_price", nullable = false)
    private Long openPrice;

    @Column(name = "close_price", nullable = false)
    private Long closePrice;

    @Column(name = "high_price", nullable = false)
    private Long highPrice;

    @Column(name = "low_price", nullable = false)
    private Long lowPrice;

    @Column(name = "fluct_rate", precision = 5, scale = 2)
    private BigDecimal fluctRate;

    @Column(name = "volume")
    private Long volume;

    @Column(name = "transaction_amount")
    private Long transactionAmount;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;

    @Column(name = "open_high_fluct_rate", precision = 5, scale = 2)
    private BigDecimal openHighFluctRate;

    @Column(name = "open_low_fluct_rate", precision = 5, scale = 2)
    private BigDecimal openLowFluctRate;

    @Builder
    public ExternalIndex(Item item, LocalDate priceDate, Long openPrice, Long closePrice, 
                         Long highPrice, Long lowPrice, BigDecimal fluctRate, 
                         Long volume, Long transactionAmount, 
                         BigDecimal openHighFluctRate, BigDecimal openLowFluctRate) {
        this.item = item;
        this.priceDate = priceDate;
        this.openPrice = openPrice;
        this.closePrice = closePrice;
        this.highPrice = highPrice;
        this.lowPrice = lowPrice;
        this.fluctRate = fluctRate;
        this.volume = volume;
        this.transactionAmount = transactionAmount;
        this.openHighFluctRate = openHighFluctRate;
        this.openLowFluctRate = openLowFluctRate;
    }
}
