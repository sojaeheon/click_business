// backend/src/main/java/com/ssafy/ecosim/domain/ranking/repository/RankingCurrentRepository.java
package com.ssafy.ecosim.domain.ranking.repository;

import com.ssafy.ecosim.domain.ranking.entity.RankingCurrent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RankingCurrentRepository extends JpaRepository<RankingCurrent, Long> {

    List<RankingCurrent> findAllByOrderByValuationDescCompanyIdAsc(Pageable pageable);
}
