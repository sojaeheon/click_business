package com.ssafy.ecosim.domain.company.dto.response;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.company.entity.IndustryType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;

@Schema(description = "기업 정보 응답")
@Getter
public class CompanyResponse {

    @Schema(description = "기업 ID", example = "1")
    private final Long id;

    @Schema(description = "기업 이름", example = "에코심 주식회사")
    private final String name;

    @Schema(description = "산업군", example = "GOLD_MINING")
    private final IndustryType industryType;

    public CompanyResponse(Company company) {
        this.id = company.getId();
        this.name = company.getName();
        this.industryType = company.getIndustryType();
    }
}
