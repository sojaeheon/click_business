package com.ssafy.ecosim.domain.market.repository;

import com.ssafy.ecosim.domain.market.entity.MarketOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import com.ssafy.ecosim.domain.market.entity.OrderStatus;

public interface MarketOrderRepository extends JpaRepository<MarketOrder, Long> {
    List<MarketOrder> findByCompanyIdAndItemIdAndStatusInOrderByCreatedAtDesc(
            Long companyId, Integer itemId, List<OrderStatus> statuses);
}
