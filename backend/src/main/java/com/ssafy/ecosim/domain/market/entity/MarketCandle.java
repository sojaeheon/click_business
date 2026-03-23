package com.ssafy.ecosim.domain.market.entity;

import com.ssafy.ecosim.global.common.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "market_candle", 
       uniqueConstraints = @UniqueConstraint(columnNames = {"item_id", "candle_time"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MarketCandle extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "candle_id")
    private Long id;

    @Column(name = "item_id", nullable = false)
    private Integer itemId;

    @Column(name = "open_price", nullable = false)
    private Long openPrice;

    @Column(name = "high_price", nullable = false)
    private Long highPrice;

    @Column(name = "low_price", nullable = false)
    private Long lowPrice;

    @Column(name = "close_price", nullable = false)
    private Long closePrice;

    @Column(name = "volume", nullable = false)
    private Long volume;

    @Column(name = "candle_time", nullable = false)
    private LocalDateTime candleTime;

    @Builder
    public MarketCandle(Integer itemId, Long openPrice, Long highPrice, Long lowPrice, 
                        Long closePrice, Long volume, LocalDateTime candleTime) {
        this.itemId = itemId;
        this.openPrice = openPrice;
        this.highPrice = highPrice;
        this.lowPrice = lowPrice;
        this.closePrice = closePrice;
        this.volume = volume;
        this.candleTime = candleTime;
    }
}