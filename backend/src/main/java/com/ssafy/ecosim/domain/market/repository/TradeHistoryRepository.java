package com.ssafy.ecosim.domain.market.repository;

import com.ssafy.ecosim.domain.market.entity.TradeHistory;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TradeHistoryRepository extends JpaRepository<TradeHistory, Long> {

    // 특정 아이템의 최근 체결 내역 (전체, 관리 목적)
    @Query("SELECT th FROM TradeHistory th WHERE th.itemId = :itemId ORDER BY th.createdAt DESC")
    List<TradeHistory> findRecentByItemId(@Param("itemId") Integer itemId, Pageable pageable);

    // 특정 회사 + 특정 아이템의 최근 체결 내역 (마켓 페이지 내 내 체결 내역 탭)
    @Query("""
            SELECT th
            FROM TradeHistory th
            WHERE th.itemId = :itemId
              AND th.marketOrderId IN (
                  SELECT mo.id
                  FROM MarketOrder mo
                  WHERE mo.companyId = :companyId
                    AND mo.itemId = :itemId
              )
            ORDER BY th.createdAt DESC
            """)
    List<TradeHistory> findRecentByCompanyIdAndItemId(@Param("companyId") Long companyId, @Param("itemId") Integer itemId, Pageable pageable);

    // 특정 회사의 미수령 체결 목록 (전체 아이템)
    @Query("""
            SELECT th
            FROM TradeHistory th
            WHERE th.isCollected = false
              AND th.marketOrderId IN (
                  SELECT mo.id
                  FROM MarketOrder mo
                  WHERE mo.companyId = :companyId
              )
            ORDER BY th.createdAt DESC
            """)
    List<TradeHistory> findUncollectedByCompanyId(@Param("companyId") Long companyId);
}
