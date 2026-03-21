package com.ssafy.ecosim.domain.inventory.controller;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.company.repository.CompanyRepository;
import com.ssafy.ecosim.domain.inventory.dto.request.SlotDecreaseRequest;
import com.ssafy.ecosim.domain.inventory.dto.request.SlotItemRequest;
import com.ssafy.ecosim.domain.inventory.dto.response.WarehouseSlotResponse;
import com.ssafy.ecosim.domain.inventory.service.WarehouseService;
import com.ssafy.ecosim.domain.item.entity.ItemType;
import com.ssafy.ecosim.global.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "창고", description = "MATERIAL/PRODUCT 아이템 보관 창고 — 슬롯 조회, 이동, 확장, 폐기")
@RestController
@RequestMapping("/api/v1/warehouses")
public class WarehouseController {

    private final WarehouseService warehouseService;
    private final CompanyRepository companyRepository;

    public WarehouseController(WarehouseService warehouseService, CompanyRepository companyRepository) {
        this.warehouseService = warehouseService;
        this.companyRepository = companyRepository;
    }

    @Operation(summary = "창고 전체 슬롯 조회", description = "내 기업 창고의 모든 슬롯과 아이템(MATERIAL/PRODUCT) 정보를 반환합니다.")
    @GetMapping
    public ApiResponse<List<WarehouseSlotResponse>> getMyWarehouse(@AuthenticationPrincipal UserDetails userDetails) {
        Company company = getCompany(userDetails);
        return ApiResponse.success(warehouseService.getWarehouse(
                company.getId(), company.getInputItemId(), company.getOutputItemId()));
    }

    @Operation(summary = "슬롯 간 아이템 이동", description = "두 슬롯의 아이템을 스왑하거나 같은 종류면 병합합니다.")
    @PostMapping("/swap")
    public ApiResponse<String> swapOrMergeSlots(@AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody SlotItemRequest request) {
        Company company = getCompany(userDetails);
        warehouseService.swapOrMergeSlots(company.getId(), request.getFromSlot(), request.getToSlot());
        return ApiResponse.success("아이템 슬롯 이동에 성공했습니다.");
    }

    @Operation(summary = "창고 슬롯 확장", description = "창고 확장권(TICKET)을 소비해 슬롯 수를 늘립니다.")
    @PostMapping("/expand")
    public ApiResponse<String> expandWarehouse(@AuthenticationPrincipal UserDetails userDetails,
            @Parameter(description = "확장권이 있는 슬롯 인덱스", example = "3") @RequestParam int ticketSlotIndex) {
        Company company = getCompany(userDetails);
        warehouseService.useExpandTicket(company.getId(), ticketSlotIndex);
        return ApiResponse.success("창고 슬롯이 확장되었습니다.");
    }

    @Operation(summary = "[개발용] 아이템 즉시 추가", description = "테스트 목적으로 지정한 아이템을 창고에 즉시 추가합니다.")
    @PostMapping("/add")
    public ApiResponse<String> devAddItem(@AuthenticationPrincipal UserDetails userDetails,
            @Parameter(description = "추가할 아이템 ID", example = "1") @RequestParam Long itemId,
            @Parameter(description = "추가할 수량", example = "10") @RequestParam Long amount) {
        Company company = getCompany(userDetails);
        warehouseService.addItem(company.getId(), itemId, amount);
        return ApiResponse.success("아이템이 창고에 추가되었습니다.");
    }

    @Operation(summary = "아이템 폐기 (타입 기준)", description = "MATERIAL 또는 PRODUCT 아이템을 지정 수량만큼 창고에서 폐기합니다.")
    @DeleteMapping("/discard")
    public ApiResponse<String> discardItems(@AuthenticationPrincipal UserDetails userDetails,
            @Parameter(description = "폐기할 아이템 종류 (MATERIAL 또는 PRODUCT)", example = "MATERIAL") @RequestParam ItemType itemType,
            @Parameter(description = "폐기할 수량", example = "5") @RequestParam Long amount) {
        Company company = getCompany(userDetails);
        warehouseService.discardByItemType(company.getId(), itemType, amount,
                company.getInputItemId(), company.getOutputItemId());
        return ApiResponse.success("아이템을 폐기했습니다.");
    }

    @Operation(summary = "슬롯 아이템 수량 감소", description = "지정한 슬롯의 아이템 수량을 감소시킵니다.")
    @DeleteMapping("/decrease")
    public ApiResponse<String> decreaseItem(@AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody SlotDecreaseRequest request) {
        Company company = getCompany(userDetails);
        warehouseService.decreaseQuantity(company.getId(), request.getSlotIndex(), request.getAmount());
        return ApiResponse.success("슬롯 아이템 수량이 감소되었습니다.");
    }

    private Company getCompany(UserDetails userDetails) {
        Long userId = Long.parseLong(userDetails.getUsername());
        return companyRepository.findByUser_Id(userId)
                .orElseThrow(() -> new IllegalArgumentException("기업을 찾을 수 없습니다."));
    }
}
