package com.ssafy.ecosim.domain.production.controller;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.company.repository.CompanyRepository;
import com.ssafy.ecosim.domain.production.dto.request.ProcessProductionRequest;
import com.ssafy.ecosim.domain.production.dto.response.WorkstationStatusResponse;
import com.ssafy.ecosim.domain.production.service.WorkstationService;
import com.ssafy.ecosim.global.common.ApiResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/workstations")
public class WorkstationController {

    private final WorkstationService workstationService;
    private final CompanyRepository companyRepository;

    public WorkstationController(WorkstationService workstationService, CompanyRepository companyRepository) {
        this.workstationService = workstationService;
        this.companyRepository = companyRepository;
    }

    private Company getCompanyByUserId(Long userId) {
        return companyRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalArgumentException("이 유저는 아직 회사를 소유하고 있지 않습니다."));
    }

    @PostMapping("/create")
    public ApiResponse<String> createWorkstation(@AuthenticationPrincipal UserDetails userDetails) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = getCompanyByUserId(userId);
        workstationService.createWorkstation(company.getId());
        return ApiResponse.success("공장이 생성 되었습니다.");
    }

    @PostMapping("/{workstationId}/toggle")
    public ApiResponse<String> toggleWorkstation(@AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long workstationId) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = getCompanyByUserId(userId);

        boolean isActive = workstationService.toggleWorkstation(company.getId(), workstationId);
        String status = isActive ? "가동" : "중지";
        return ApiResponse.success("공장이 " + status + " 상태로 변경되었습니다.");
    }

    @PostMapping("/{workstationId}/equip/{equipmentId}")
    public ApiResponse<String> equipEquipment(@AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long workstationId,
            @PathVariable Long equipmentId) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = getCompanyByUserId(userId);

        workstationService.equipEquipment(company.getId(), workstationId, equipmentId);
        return ApiResponse.success("장비가 장착되었습니다.");
    }

    @PostMapping("/{workstationId}/process")
    public ApiResponse<String> processProduction(@AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long workstationId,
            @RequestBody ProcessProductionRequest request) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = getCompanyByUserId(userId);

        workstationService.processProduction(company.getId(), workstationId, request.getOutputItemId());
        return ApiResponse.success("생산 지연 평가가 완료되었습니다.");
    }

    @PostMapping("/{workstationId}/harvest")
    public ApiResponse<String> harvestOutput(@AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long workstationId) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = getCompanyByUserId(userId);

        workstationService.harvestOutput(company.getId(), workstationId);
        return ApiResponse.success("결과물을 성공적으로 수확하였습니다.");
    }

    @GetMapping("/{workstationId}")
    public ApiResponse<WorkstationStatusResponse> getWorkstationStatus(@AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long workstationId) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = getCompanyByUserId(userId);

        // 임시로 요구 재료 1L, 결과물 2L로 세팅 (또는 기존과 같이 1L)
        workstationService.processProduction(company.getId(), workstationId);
        // 임시 요구 재료 1L를 파라미터로 함께 조회
        WorkstationStatusResponse response = workstationService.getWorkstationStatus(company.getId(), workstationId);
        return ApiResponse.success(response);
    }
}
