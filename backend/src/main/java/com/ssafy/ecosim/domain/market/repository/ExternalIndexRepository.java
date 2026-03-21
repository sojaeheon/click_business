package com.ssafy.ecosim.domain.market.repository;

import com.ssafy.ecosim.domain.market.entity.ExternalIndex;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface ExternalIndexRepository extends JpaRepository<ExternalIndex, Long> {

    /**
     * 특정 아이템의 특정 날짜 지표를 조회합니다.
     */
    Optional<ExternalIndex> findByItemIdAndPriceDate(Long itemId, LocalDate priceDate);

    /**
     * 특정 아이템의 가장 과거 지표를 조회합니다. (시뮬레이션 시작용)
     */
    Optional<ExternalIndex> findFirstByItemIdOrderByPriceDateAsc(Long itemId);

    /**
     * 특정 아이템의 특정 날짜 이후 가장 빠른 지표를 조회합니다. (순차 시뮬레이션용)
     */
    Optional<ExternalIndex> findFirstByItemIdAndPriceDateAfterOrderByPriceDateAsc(Long itemId, LocalDate priceDate);

    /**
     * 특정 아이템의 가장 최근 지표를 조회합니다.
     */
    Optional<ExternalIndex> findFirstByItemIdOrderByPriceDateDesc(Long itemId);
}
