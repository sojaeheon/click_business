package com.ssafy.ecosim.domain.market.repository;

import com.ssafy.ecosim.domain.market.entity.TradeHistory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TradeHistoryRepository extends JpaRepository<TradeHistory, Long> {
}
