package com.ssafy.ecosim.domain.company.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CompanyCreateRequest {

    @NotBlank(message = "기업 이름은 필수입니다.")
    @Size(max = 100, message = "기업 이름은 100자 이내여야 합니다.")
    private String name;

    public CompanyCreateRequest(String name) {
        this.name = name;
    }
}
