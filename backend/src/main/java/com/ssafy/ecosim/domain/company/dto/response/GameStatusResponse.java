package com.ssafy.ecosim.domain.company.dto.response;

import com.ssafy.ecosim.domain.company.entity.Company;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;

@Schema(description = "게임 메인 화면 기업 상태 응답")
@Getter
public class GameStatusResponse {

    @Schema(description = "기업 ID", example = "1")
    private final Long companyId;

    @Schema(description = "기업 이름", example = "에코심 주식회사")
    private final String companyName;

    @Schema(description = "산업군 코드", example = "GOLD_MINING")
    private final String industry;

    @Schema(description = "보유 현금", example = "1000000")
    private final Long money;

    @Schema(description = "총 자산", example = "5000000")
    private final Long capital;

    @Schema(description = "화폐 단위", example = "$")
    private final String currency;

    public GameStatusResponse(Company company) {
        this.companyId = company.getId();
        this.companyName = company.getName();
        this.industry = company.getIndustryType() != null ? company.getIndustryType().name() : null;
        this.money = company.getCash();
        this.capital = company.getTotalAsset();
        this.currency = "$";
    }
}
