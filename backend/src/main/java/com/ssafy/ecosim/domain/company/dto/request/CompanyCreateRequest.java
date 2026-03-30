package com.ssafy.ecosim.domain.company.dto.request;

import com.ssafy.ecosim.domain.company.entity.IndustryType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Schema(description = "기업 생성 요청")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CompanyCreateRequest {

    @Schema(description = "기업 이름 (100자 이내)", example = "에코심 주식회사")
    @NotBlank(message = "기업 이름은 필수입니다.")
    @Size(max = 100, message = "기업 이름은 100자 이내여야 합니다.")
    private String name;

    @Schema(description = "산업군", example = "GOLD_MINING")
    @NotNull(message = "산업군은 필수입니다.")
    private IndustryType industryType;

    public CompanyCreateRequest(String name, IndustryType industryType) {
        this.name = name;
        this.industryType = industryType;
    }
}
