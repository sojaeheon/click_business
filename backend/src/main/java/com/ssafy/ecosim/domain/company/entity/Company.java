package com.ssafy.ecosim.domain.company.entity;

import com.ssafy.ecosim.domain.user.entity.User;
import com.ssafy.ecosim.global.common.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "company")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Company extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "company_id")
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "industry_id")
    private Long industryId;

    public IndustryType getIndustryType() {
        for (IndustryType type : IndustryType.values()) {
            if (type.getIndustryId().equals(this.industryId)) return type;
        }
        return null;
    }

    @Column(name = "input_item_id")
    private Long inputItemId;

    @Column(name = "output_item_id")
    private Long outputItemId;

    @Column(name = "production_requirement", nullable = false)
    private Integer productionRequirement; // 소모되는 재료량

    @Column(name = "production_yield", nullable = false)
    private Integer productionYield; // 산출되는 결과물량

    // ERD 기준 추가 필드
    @Column(name = "level", nullable = false)
    private Integer level;

    @Column(name = "cash", nullable = false)
    private Long cash;

    @Column(name = "total_asset", nullable = false)
    private Long totalAsset;

    public Company(User user, String name, IndustryType industryType) {
        this.user = user;
        this.name = name;
        this.industryId = industryType.getIndustryId();
        this.inputItemId = industryType.getInputItemId();
        this.outputItemId = industryType.getOutputItemId();
        this.productionRequirement = 1;
        this.productionYield = 1;
        this.level = 1;
        this.cash = 1_000_000L;   // 초기 지급 현금 100만원
        this.totalAsset = 1_000_000L;
    }
}
