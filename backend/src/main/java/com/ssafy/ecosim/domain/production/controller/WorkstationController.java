package com.ssafy.ecosim.domain.production.controller;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.company.repository.CompanyRepository;
import com.ssafy.ecosim.domain.production.dto.request.ProcessProductionRequest;
import com.ssafy.ecosim.domain.production.dto.request.ReserveMaterialsRequest;
import com.ssafy.ecosim.domain.production.dto.response.WorkstationStatusResponse;
import com.ssafy.ecosim.domain.production.service.WorkstationService;
import com.ssafy.ecosim.global.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@Tag(name = "공장 (워크스테이션)", description = "공장 생성, 가동/중지, 장비 장착, 재료 예약, 생산 처리, 결과물 수확")
@RestController
@RequestMapping("/api/v1/workstations")
public class WorkstationController {

    private final WorkstationService workstationService;
    private final CompanyRepository companyRepository;

    public WorkstationController(WorkstationService workstationService, CompanyRepository companyRepository) {
        this.workstationService = workstationService;
        this.companyRepository = companyRepository;
    }

    @Operation(summary = "공장 생성", description = "내 기업에 새 공장(워크스테이션)을 생성합니다.")
    @PostMapping("/create")
    public ApiResponse<String> createWorkstation(@AuthenticationPrincipal UserDetails userDetails) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = getCompanyByUserId(userId);
        workstationService.createWorkstation(company.getId());
        return ApiResponse.success("공장이 생성 되었습니다.");
    }

    @Operation(summary = "공장 가동/중지 토글", description = "공장의 가동 상태를 전환합니다. 가동 중이면 중지, 중지 상태면 가동합니다.")
    @PostMapping("/{workstationId}/toggle")
    public ApiResponse<String> toggleWorkstation(
            @AuthenticationPrincipal UserDetails userDetails,
            @Parameter(description = "공장 ID", example = "1") @PathVariable Long workstationId) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = getCompanyByUserId(userId);

        boolean isActive = workstationService.toggleWorkstation(company.getId(), workstationId);
        String status = isActive ? "가동" : "중지";
        return ApiResponse.success("공장이 " + status + " 상태로 변경되었습니다.");
    }

    @Operation(summary = "일꾼 장착", description = "인벤토리 슬롯의 일꾼을 공장에 장착합니다.")
    @PostMapping("/{workstationId}/equip-worker")
    public ApiResponse<String> equipWorker(
            @AuthenticationPrincipal UserDetails userDetails,
            @Parameter(description = "공장 ID", example = "1") @PathVariable Long workstationId,
            @Parameter(description = "장착할 일꾼이 있는 인벤토리 슬롯 인덱스", example = "0") @RequestParam Integer slotIndex) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = getCompanyByUserId(userId);
        workstationService.equipWorker(company.getId(), workstationId, slotIndex);
        return ApiResponse.success("일꾼이 장착되었습니다.");
    }

    @Operation(summary = "일꾼 장착 해제", description = "공장에 장착된 일꾼을 해제합니다.")
    @DeleteMapping("/{workstationId}/equip-worker")
    public ApiResponse<String> unequipWorker(
            @AuthenticationPrincipal UserDetails userDetails,
            @Parameter(description = "공장 ID", example = "1") @PathVariable Long workstationId) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = getCompanyByUserId(userId);
        workstationService.unequipWorker(company.getId(), workstationId);
        return ApiResponse.success("일꾼 장착이 해제되었습니다.");
    }

    @Operation(summary = "장비 장착", description = "공장에 장비 아이템을 장착합니다.")
    @PostMapping("/{workstationId}/equip/{equipmentId}")
    public ApiResponse<String> equipEquipment(
            @AuthenticationPrincipal UserDetails userDetails,
            @Parameter(description = "공장 ID", example = "1") @PathVariable Long workstationId,
            @Parameter(description = "장착할 장비 ID", example = "3") @PathVariable Long equipmentId) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = getCompanyByUserId(userId);

        workstationService.equipEquipment(company.getId(), workstationId, equipmentId);
        return ApiResponse.success("장비가 장착되었습니다.");
    }

    @Operation(summary = "재료 예약", description = "공장 생산에 사용할 재료 수량을 예약합니다.")
    @PostMapping("/{workstationId}/reserve")
    public ApiResponse<String> reserveMaterials(
            @AuthenticationPrincipal UserDetails userDetails,
            @Parameter(description = "공장 ID", example = "1") @PathVariable Long workstationId,
            @RequestBody ReserveMaterialsRequest request) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = getCompanyByUserId(userId);

        workstationService.reserveMaterials(company.getId(), workstationId, request.getQuantity());
        return ApiResponse.success("재료가 성공적으로 예약되었습니다.");
    }

    @Operation(summary = "생산 처리", description = "공장의 생산 지연 평가를 수행합니다.")
    @PostMapping("/{workstationId}/process")
    public ApiResponse<String> processProduction(
            @AuthenticationPrincipal UserDetails userDetails,
            @Parameter(description = "공장 ID", example = "1") @PathVariable Long workstationId,
            @RequestBody ProcessProductionRequest request) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = getCompanyByUserId(userId);

        workstationService.processProduction(company.getId(), workstationId);
        return ApiResponse.success("생산 지연 평가가 완료되었습니다.");
    }

    @Operation(summary = "결과물 수확", description = "지연 평가 후 생산 완료된 결과물을 창고로 옮깁니다.")
    @PostMapping("/{workstationId}/harvest")
    public ApiResponse<String> harvestOutput(
            @AuthenticationPrincipal UserDetails userDetails,
            @Parameter(description = "공장 ID", example = "1") @PathVariable Long workstationId) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = getCompanyByUserId(userId);

        // 수확 전 지연 평가를 먼저 수행해야 producedQuantity가 갱신됨
        workstationService.processProduction(company.getId(), workstationId);
        workstationService.harvestOutput(company.getId(), workstationId);
        return ApiResponse.success("결과물을 성공적으로 수확하였습니다.");
    }

    @Operation(summary = "내 공장 상태 조회", description = "현재 로그인한 유저의 공장 상태를 반환합니다. (ID 불필요)")
    @GetMapping("/my")
    public ApiResponse<WorkstationStatusResponse> getMyWorkstationStatus(
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = getCompanyByUserId(userId);
        WorkstationStatusResponse response = workstationService.getMyWorkstationStatus(company.getId());
        return ApiResponse.success(response);
    }

    @Operation(summary = "공장 상태 조회", description = "공장의 현재 상태(가동 여부, 장비, 재료 예약량, 생산량 등)를 반환합니다.")
    @GetMapping("/{workstationId}")
    public ApiResponse<WorkstationStatusResponse> getWorkstationStatus(
            @AuthenticationPrincipal UserDetails userDetails,
            @Parameter(description = "공장 ID", example = "1") @PathVariable Long workstationId) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = getCompanyByUserId(userId);

        workstationService.processProduction(company.getId(), workstationId);
        WorkstationStatusResponse response = workstationService.getWorkstationStatus(company.getId(), workstationId);
        return ApiResponse.success(response);
    }

    private Company getCompanyByUserId(Long userId) {
        return companyRepository.findByUser_Id(userId)
                .orElseThrow(() -> new IllegalArgumentException("이 유저는 아직 회사를 소유하고 있지 않습니다."));
    }
}
