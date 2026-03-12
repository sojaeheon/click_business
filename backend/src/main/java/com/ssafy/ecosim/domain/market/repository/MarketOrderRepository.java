package com.ssafy.ecosim.domain.market.repository;

import com.ssafy.ecosim.domain.market.entity.MarketOrder;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MarketOrderRepository extends JpaRepository<MarketOrder, Long> {
}
