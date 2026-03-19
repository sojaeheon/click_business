package com.ssafy.ecosim.domain.production.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Schema(description = "생산 처리 요청")
@Getter
@Setter
@NoArgsConstructor
public class ProcessProductionRequest {

    @Schema(description = "결과물로 나올 아이템 ID", example = "2")
    private Long outputItemId;
}
