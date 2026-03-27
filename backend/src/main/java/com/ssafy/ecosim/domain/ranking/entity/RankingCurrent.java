package com.ssafy.ecosim.domain.ranking.entity;

import jakarta.persistence.*;
import lombok.Getter;

import java.time.LocalDateTime;

@Entity
@Table(name = "ranking_current")
@Getter
public class RankingCurrent {

    @Id
    @Column(name = "company_id")
    private Long companyId;

    @Column(name = "valuation", nullable = false)
    private Long valuation;

    @Column(name = "ranking_updated_at", nullable = false)
    private LocalDateTime rankingUpdatedAt;
}