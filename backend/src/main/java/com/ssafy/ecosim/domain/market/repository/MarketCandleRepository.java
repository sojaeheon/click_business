package com.ssafy.ecosim.domain.market.repository;

import com.ssafy.ecosim.domain.market.entity.MarketCandle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface MarketCandleRepository extends JpaRepository<MarketCandle, Long> {
    
    /**
     * 특정 아이템의 특정 시간 이후 분봉 조회 (최신순)
     */
    List<MarketCandle> findByItemIdAndCandleTimeAfterOrderByCandleTimeDesc(
        Integer itemId, LocalDateTime after);
    
    /**
     * 특정 아이템의 특정 타입 최근 N개 분봉 조회
     */
    List<MarketCandle> findTop100ByItemIdAndCandleTypeOrderByCandleTimeDesc(
        Integer itemId, MarketCandle.CandleType candleType);
}