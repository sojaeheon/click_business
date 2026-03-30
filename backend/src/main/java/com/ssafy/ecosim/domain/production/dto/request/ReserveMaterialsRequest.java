package com.ssafy.ecosim.domain.production.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Schema(description = "재료 예약 요청")
@Getter
@Setter
@NoArgsConstructor
public class ReserveMaterialsRequest {

    @Schema(description = "예약할 재료 수량", example = "10")
    private Long quantity;
}
