package com.ssafy.ecosim.domain.production.dto.request;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class AddMaterialRequest {
    private Long itemId;
    private Long amount;
}
