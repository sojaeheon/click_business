package com.ssafy.ecosim.domain.production.dto.request;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class ProcessProductionRequest {
    private Long inputItemId; // 소비될 재료 아이템 ID
    private Long outputItemId; // 결과물로 나올 아이템 ID
}
