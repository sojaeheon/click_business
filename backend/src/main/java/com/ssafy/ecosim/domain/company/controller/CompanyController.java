package com.ssafy.ecosim.domain.company.controller;

import com.ssafy.ecosim.domain.company.dto.request.CompanyCreateRequest;
import com.ssafy.ecosim.domain.company.dto.response.CompanyResponse;
import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.company.service.CompanyService;
import com.ssafy.ecosim.global.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/companies")
public class CompanyController {

    private final CompanyService companyService;

    /**
     * 유저의 기업을 생성합니다.
     */
    @PostMapping
    public ApiResponse<CompanyResponse> createCompany(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody CompanyCreateRequest request) {

        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = companyService.createCompanyForUser(userId, request.getName());

        return ApiResponse.success(new CompanyResponse(company));
    }

    /**
     * 현재 로그인한 유저의 기업 정보를 조회합니다.
     */
    @GetMapping("/me")
    public ApiResponse<CompanyResponse> getMyCompany(@AuthenticationPrincipal UserDetails userDetails) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = companyService.getCompanyByUserId(userId);

        return ApiResponse.success(new CompanyResponse(company));
    }
}
