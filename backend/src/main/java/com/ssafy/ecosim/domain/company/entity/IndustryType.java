package com.ssafy.ecosim.domain.company.entity;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 게임 내 산업군 정의
 * 순환 경제 구조: 금광업 → 금 제련업 → 제조업 → 금광업
 */
@Getter
@RequiredArgsConstructor
public enum IndustryType {

    GOLD_MINING(1, 3L, 1L, 2, 40),    // 금광업: 드릴 2개 소모 → 금광석 40개 생산
    GOLD_SMELTING(2, 1L, 2L, 12, 6),  // 금 제련업: 금광석 12개 소모 → 금괴 6개 생산
    MANUFACTURING(3, 2L, 3L, 20, 2);  // 제조업: 금괴 20개 소모 → 드릴 2개 생산

    private final Integer industryId; // industry 테이블 PK (int4)
    private final Long inputItemId; // 소모 아이템
    private final Long outputItemId; // 생산 아이템
    private final Integer baseRequirement; // 1회 생산 시 소모량 (기본값)
    private final Integer baseYield; // 1회 생산 시 산출량 (기본값)
}
