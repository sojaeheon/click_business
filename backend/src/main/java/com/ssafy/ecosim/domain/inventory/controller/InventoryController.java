package com.ssafy.ecosim.domain.inventory.controller;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.company.repository.CompanyRepository;
import com.ssafy.ecosim.domain.inventory.dto.request.SlotDecreaseRequest;
import com.ssafy.ecosim.domain.inventory.dto.request.SlotItemRequest;
import com.ssafy.ecosim.domain.inventory.dto.response.InventorySlotResponse;
import com.ssafy.ecosim.domain.inventory.service.InventoryService;
import com.ssafy.ecosim.global.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 인벤토리 API
 * - EQUIPMENT (일꾼), TICKET (확장권) 아이템 보관
 * - 미니게임 보상 수령 시 이곳에 저장됨
 */
@Tag(name = "인벤토리", description = "EQUIPMENT/TICKET 아이템 보관 인벤토리 — 슬롯 조회, 이동, 수량 감소")
@RestController
@RequestMapping("/api/v1/inventory")
public class InventoryController {

    private final InventoryService inventoryService;
    private final CompanyRepository companyRepository;

    public InventoryController(InventoryService inventoryService,
            CompanyRepository companyRepository) {
        this.inventoryService = inventoryService;
        this.companyRepository = companyRepository;
    }

    @Operation(summary = "인벤토리 전체 슬롯 조회", description = "내 인벤토리의 모든 슬롯과 아이템(EQUIPMENT/TICKET) 정보를 반환합니다.")
    @GetMapping
    public ApiResponse<List<InventorySlotResponse>> getMyInventory(
            @AuthenticationPrincipal UserDetails userDetails) {
        Company company = getCompany(userDetails);
        return ApiResponse.success(inventoryService.getInventory(company.getId()));
    }

    @Operation(summary = "슬롯 간 아이템 이동", description = "두 슬롯의 아이템을 스왑하거나 같은 종류면 병합합니다.")
    @PostMapping("/swap")
    public ApiResponse<String> swapSlots(@AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody SlotItemRequest request) {
        Company company = getCompany(userDetails);
        inventoryService.swapSlots(company.getId(), request.getFromSlot(), request.getToSlot());
        return ApiResponse.success("아이템 슬롯 이동에 성공했습니다.");
    }

    @Operation(summary = "[개발용] 아이템 즉시 추가", description = "테스트 목적으로 EQUIPMENT/TICKET 아이템을 인벤토리에 즉시 추가합니다.")
    @PostMapping("/add")
    public ApiResponse<String> devAddItem(@AuthenticationPrincipal UserDetails userDetails,
            @Parameter(description = "추가할 아이템 ID", example = "5") @RequestParam Long itemId,
            @Parameter(description = "추가할 수량", example = "1") @RequestParam Long amount) {
        Company company = getCompany(userDetails);
        inventoryService.addItem(company.getId(), itemId, amount);
        return ApiResponse.success("아이템이 인벤토리에 추가되었습니다.");
    }

    @Operation(summary = "슬롯 아이템 수량 감소", description = "지정한 슬롯의 아이템 수량을 감소시킵니다.")
    @DeleteMapping("/decrease")
    public ApiResponse<String> decreaseItem(@AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody SlotDecreaseRequest request) {
        Company company = getCompany(userDetails);
        inventoryService.decreaseQuantity(company.getId(), request.getSlotIndex(), request.getAmount());
        return ApiResponse.success("슬롯 아이템 수량이 감소되었습니다.");
    }

    @Operation(summary = "인벤토리 슬롯 확장", description = "인벤토리 확장권(TICKET)을 소비해 슬롯 수를 1칸 늘립니다.")
    @PostMapping("/expand")
    public ApiResponse<String> expandInventory(@AuthenticationPrincipal UserDetails userDetails,
            @Parameter(description = "확장권이 있는 슬롯 인덱스", example = "3") @RequestParam int ticketSlotIndex) {
        Company company = getCompany(userDetails);
        inventoryService.expandInventory(company.getId(), ticketSlotIndex);
        return ApiResponse.success("인벤토리 슬롯이 1칸 확장되었습니다.");
    }

    @Operation(summary = "일꾼 장착", description = "인벤토리 슬롯의 일꾼을 장착합니다.")
    @PostMapping("/equip")
    public ApiResponse<String> equipWorker(@AuthenticationPrincipal UserDetails userDetails,
            @Parameter(description = "장착할 일꾼이 있는 슬롯 인덱스", example = "0") @RequestParam int slotIndex) {
        Company company = getCompany(userDetails);
        inventoryService.equipWorker(company.getId(), slotIndex);
        return ApiResponse.success("일꾼이 장착되었습니다.");
    }

    @Operation(summary = "일꾼 장착 해제", description = "장착된 일꾼을 해제합니다.")
    @PostMapping("/unequip")
    public ApiResponse<String> unequipWorker(@AuthenticationPrincipal UserDetails userDetails) {
        Company company = getCompany(userDetails);
        inventoryService.unequipWorker(company.getId());
        return ApiResponse.success("일꾼 장착이 해제되었습니다.");
    }

    /**
     * 인증된 유저의 기업 정보 조회
     */
    private Company getCompany(UserDetails userDetails) {
        Long userId = Long.parseLong(userDetails.getUsername());
        return companyRepository.findByUser_Id(userId)
                .orElseThrow(() -> new IllegalArgumentException("기업을 찾을 수 없습니다."));
    }
}
