package com.ssafy.ecosim.domain.hr.controller;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.company.repository.CompanyRepository;
import com.ssafy.ecosim.domain.hr.dto.request.WorkerUpgradeRequest;
import com.ssafy.ecosim.domain.hr.dto.response.WorkerUpgradeResponse;
import com.ssafy.ecosim.domain.hr.service.HRService;
import com.ssafy.ecosim.global.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@Tag(name = "인력소", description = "일꾼 강화")
@RestController
@RequestMapping("/api/v1/hr")
public class HRController {

    private final HRService hrService;
    private final CompanyRepository companyRepository;

    public HRController(HRService hrService, CompanyRepository companyRepository) {
        this.hrService = hrService;
        this.companyRepository = companyRepository;
    }

    @Operation(
        summary = "일꾼 강화",
        description = "동일 레벨 일꾼 2개를 소모하여 강화를 시도합니다. " +
                      "결과: success(레벨업) / stay(유지) / down(레벨다운) / reset(소멸)"
    )
    @PostMapping("/upgrade")
    public ApiResponse<WorkerUpgradeResponse> upgradeWorker(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody WorkerUpgradeRequest request) {

        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = companyRepository.findByUser_Id(userId)
                .orElseThrow(() -> new IllegalArgumentException("기업을 먼저 생성해주세요."));

        WorkerUpgradeResponse response = hrService.upgradeWorker(company.getId(), request.getCurrentLevel());
        return ApiResponse.success(response);
    }
}
