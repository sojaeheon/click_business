package com.ssafy.ecosim.domain.company.controller;

import com.ssafy.ecosim.domain.company.dto.request.CompanyCreateRequest;
import com.ssafy.ecosim.domain.company.dto.response.CompanyResponse;
import com.ssafy.ecosim.domain.company.dto.response.GameStatusResponse;
import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.company.service.CompanyService;
import com.ssafy.ecosim.global.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@Tag(name = "기업", description = "기업 생성, 조회, 게임 상태 조회")
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/companies")
public class CompanyController {

    private final CompanyService companyService;

    @Operation(summary = "기업 생성", description = "현재 로그인한 유저의 기업을 생성합니다.")
    @PostMapping
    public ApiResponse<CompanyResponse> createCompany(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody CompanyCreateRequest request) {

        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = companyService.createCompanyForUser(userId, request.getName(), request.getIndustryType());

        return ApiResponse.success(new CompanyResponse(company));
    }

    @Operation(summary = "내 기업 조회", description = "현재 로그인한 유저의 기업 정보를 반환합니다.")
    @GetMapping("/me")
    public ApiResponse<CompanyResponse> getMyCompany(@AuthenticationPrincipal UserDetails userDetails) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = companyService.getCompanyByUserId(userId);

        return ApiResponse.success(new CompanyResponse(company));
    }

    @Operation(summary = "기업 게임 상태 조회", description = "메인 게임 화면에 필요한 현금, 총 자산 등 기업 상태 데이터를 반환합니다.")
    @GetMapping("/{id}/status")
    public ApiResponse<GameStatusResponse> getCompanyStatus(
            @Parameter(description = "기업 ID", example = "1") @PathVariable Long id) {
        Company company = companyService.getCompanyById(id);
        return ApiResponse.success(new GameStatusResponse(company));
    }
}
