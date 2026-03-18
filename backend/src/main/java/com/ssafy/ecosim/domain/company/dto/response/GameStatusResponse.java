package com.ssafy.ecosim.domain.company.dto.response;

import com.ssafy.ecosim.domain.company.entity.Company;
import lombok.Getter;

@Getter
public class GameStatusResponse {

    private final Long companyId;
    private final String companyName;
    private final String industry;   // IndustryType enum 이름 (ex. "GOLD_MINING")
    private final Long money;        // 보유 현금
    private final Long capital;      // 총 자산
    private final String currency;   // 화폐 단위 (고정값 "₵")

    public GameStatusResponse(Company company) {
        this.companyId = company.getId();
        this.companyName = company.getName();
        this.industry = company.getIndustryType() != null ? company.getIndustryType().name() : null;
        this.money = company.getCash();
        this.capital = company.getTotalAsset();
        this.currency = "$";
    }
}
