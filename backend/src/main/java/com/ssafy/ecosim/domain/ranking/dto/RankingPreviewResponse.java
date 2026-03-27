// backend/src/main/java/com/ssafy/ecosim/domain/ranking/dto/RankingPreviewResponse.java
package com.ssafy.ecosim.domain.ranking.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RankingPreviewResponse {
    private int rank;
    private Long companyId;
    private String companyName;
    private String tier;   // 프론트 호환용
    private Long score;    // 프론트 호환용
}