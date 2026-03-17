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

    GOLD_MINING(1, 3L, 1L),      // 금광업:    금 드릴(3) 소모 → 금광석(1) 생산
    GOLD_SMELTING(2, 1L, 2L),    // 금 제련업: 금광석(1) 소모 → 금괴(2) 생산
    MANUFACTURING(3, 2L, 3L);    // 제조업:    금괴(2) 소모    → 금 드릴(3) 생산

    private final Integer industryId;  // industry 테이블 PK (int4)
    private final Long inputItemId;    // 소모 아이템
    private final Long outputItemId;   // 생산 아이템
}
