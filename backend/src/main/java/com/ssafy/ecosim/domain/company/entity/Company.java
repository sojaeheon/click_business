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

    @Column(name = "input_item_id")
    private Long inputItemId;

    @Column(name = "output_item_id")
    private Long outputItemId;

    @Column(name = "production_requirement", nullable = false)
    private Integer productionRequirement; // 소모되는 재료량

    @Column(name = "production_yield", nullable = false)
    private Integer productionYield; // 산출되는 결과물량

    public Company(User user, String name, Long inputItemId, Long outputItemId) {
        this.user = user;
        this.name = name;
        this.inputItemId = inputItemId;
        this.outputItemId = outputItemId;
        this.productionRequirement = 1; // 기본값 1
        this.productionYield = 1; // 기본값 1
    }
}
