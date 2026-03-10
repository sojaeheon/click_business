package com.ssafy.ecosim.domain.company.dto.response;

import com.ssafy.ecosim.domain.company.entity.Company;
import lombok.Getter;

@Getter
public class CompanyResponse {
    private final Long id;
    private final String name;

    public CompanyResponse(Company company) {
        this.id = company.getId();
        this.name = company.getName();
    }
}
