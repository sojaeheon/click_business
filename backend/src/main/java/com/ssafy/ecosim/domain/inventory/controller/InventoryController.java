package com.ssafy.ecosim.domain.inventory.controller;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.company.repository.CompanyRepository;
import com.ssafy.ecosim.domain.inventory.dto.request.SlotDecreaseRequest;
import com.ssafy.ecosim.domain.inventory.dto.request.SlotItemRequest;
import com.ssafy.ecosim.domain.inventory.dto.response.InventorySlotResponse;
import com.ssafy.ecosim.domain.inventory.service.InventoryService;
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

@Tag(name = "인벤토리", description = "창고 조회, 슬롯 이동/확장/아이템 폐기")
@RestController
@RequestMapping("/api/v1/inventory")
public class InventoryController {

    private final InventoryService inventoryService;
    private final CompanyRepository companyRepository;

    public InventoryController(InventoryService inventoryService, CompanyRepository companyRepository) {
        this.inventoryService = inventoryService;
        this.companyRepository = companyRepository;
    }

    @Operation(summary = "창고 전체 슬롯 조회", description = "내 기업 창고의 모든 슬롯과 아이템 정보를 반환합니다.")
    @GetMapping
    public ApiResponse<List<InventorySlotResponse>> getMyInventory(@AuthenticationPrincipal UserDetails userDetails) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = getCompanyByUserId(userId);

        List<InventorySlotResponse> inventory = inventoryService.getInventory(company.getId());
        return ApiResponse.success(inventory);
    }

    @Operation(summary = "슬롯 간 아이템 이동", description = "두 슬롯의 아이템을 스왑하거나 같은 종류일 경우 병합합니다.")
    @PostMapping("/swap")
    public ApiResponse<String> swapOrMergeSlots(@AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody SlotItemRequest request) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = getCompanyByUserId(userId);

        inventoryService.swapOrMergeSlots(company.getId(), request.getFromSlot(), request.getToSlot());
        return ApiResponse.success("아이템 슬롯 이동에 성공했습니다.");
    }

    @Operation(summary = "창고 슬롯 확장", description = "창고 확장권 아이템을 소비해 슬롯 수를 늘립니다.")
    @PostMapping("/expand")
    public ApiResponse<String> expandInventory(@AuthenticationPrincipal UserDetails userDetails,
            @Parameter(description = "확장권이 있는 슬롯 인덱스", example = "3") @RequestParam int ticketSlotIndex) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = getCompanyByUserId(userId);

        inventoryService.useExpandTicket(company.getId(), ticketSlotIndex);
        return ApiResponse.success("창고 슬롯이 확장되었습니다.");
    }

    @Operation(summary = "[개발용] 아이템 즉시 획득", description = "테스트/개발 목적으로 지정한 아이템을 창고에 즉시 추가합니다.")
    @PostMapping("/add")
    public ApiResponse<String> devAddItem(@AuthenticationPrincipal UserDetails userDetails,
            @Parameter(description = "추가할 아이템 ID", example = "1") @RequestParam Long itemId,
            @Parameter(description = "추가할 수량", example = "10") @RequestParam Long amount) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = getCompanyByUserId(userId);

        inventoryService.addItem(company.getId(), itemId, amount);
        return ApiResponse.success("성공적으로 아이템 획득이 처리되었습니다.");
    }

    @Operation(summary = "아이템 폐기 (타입 기준)", description = "지정한 아이템 종류(MATERIAL/PRODUCT)를 수량만큼 창고에서 폐기합니다.")
    @DeleteMapping("/discard")
    public ApiResponse<String> discardItems(@AuthenticationPrincipal UserDetails userDetails,
            @Parameter(description = "폐기할 아이템 종류 (MATERIAL 또는 PRODUCT)", example = "MATERIAL") @RequestParam ItemType itemType,
            @Parameter(description = "폐기할 수량", example = "5") @RequestParam Long amount) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = getCompanyByUserId(userId);

        inventoryService.discardByItemType(company.getId(), itemType, amount);
        return ApiResponse.success("아이템을 폐기했습니다.");
    }

    @Operation(summary = "슬롯 아이템 수량 감소", description = "지정한 슬롯의 아이템 수량을 지정한 만큼 감소시킵니다.")
    @DeleteMapping("/decrease")
    public ApiResponse<String> deleteItem(@AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody SlotDecreaseRequest request) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = getCompanyByUserId(userId);

        inventoryService.decreaseQuantity(company.getId(), request.getSlotIndex(), request.getAmount());
        return ApiResponse.success("성공적으로 슬롯 아이템이 감소 되었습니다.");
    }

    private Company getCompanyByUserId(Long userId) {
        return companyRepository.findByUser_Id(userId)
                .orElseThrow(() -> new IllegalArgumentException("이 유저는 아직 창고(기업)를 소유하고 있지 않습니다."));
    }
}
