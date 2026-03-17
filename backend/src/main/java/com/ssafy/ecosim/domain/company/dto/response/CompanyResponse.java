package com.ssafy.ecosim.domain.company.dto.response;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.company.entity.IndustryType;
import lombok.Getter;

@Getter
public class CompanyResponse {
    private final Long id;
    private final String name;
    private final IndustryType industryType;

    public CompanyResponse(Company company) {
        this.id = company.getId();
        this.name = company.getName();
        this.industryType = company.getIndustryType();
    }
}
