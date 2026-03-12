package com.ssafy.ecosim.domain.inventory.controller;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.company.repository.CompanyRepository;
import com.ssafy.ecosim.domain.inventory.dto.request.SlotSwapRequest;
import com.ssafy.ecosim.domain.inventory.dto.response.InventorySlotResponse;
import com.ssafy.ecosim.domain.inventory.service.InventoryService;
import com.ssafy.ecosim.global.common.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/inventory")
public class InventoryController {

    private final InventoryService inventoryService;
    private final CompanyRepository companyRepository;

    public InventoryController(InventoryService inventoryService, CompanyRepository companyRepository) {
        this.inventoryService = inventoryService;
        this.companyRepository = companyRepository;
    }

    /**
     * 내 기업의 창고 전체 슬롯 조회
     */
    @GetMapping
    public ApiResponse<List<InventorySlotResponse>> getMyInventory(@AuthenticationPrincipal UserDetails userDetails) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = getCompanyByUserId(userId);

        List<InventorySlotResponse> inventory = inventoryService.getInventory(company.getId());
        return ApiResponse.success(inventory);
    }

    /**
     * 슬롯 간 아이템 이동 (스왑 및 병합)
     */
    @PostMapping("/swap")
    public ApiResponse<String> swapOrMergeSlots(@AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody SlotSwapRequest request) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = getCompanyByUserId(userId);

        inventoryService.swapOrMergeSlots(company.getId(), request.getFromSlot(), request.getToSlot());
        return ApiResponse.success("아이템 슬롯 이동에 성공했습니다.");
    }

    /**
     * 창고 확장권 소비를 통한 슬롯 증가
     */
    @PostMapping("/expand")
    public ApiResponse<String> expandInventory(@AuthenticationPrincipal UserDetails userDetails,
            @RequestParam int ticketSlotIndex) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = getCompanyByUserId(userId);

        inventoryService.useExpandTicket(company.getId(), ticketSlotIndex);
        return ApiResponse.success("창고 슬롯이 확장되었습니다.");
    }

    /**
     * (테스트/개발용 임시) 아이템을 내 창고에 즉시 획득
     */
    @PostMapping("/add")
    public ApiResponse<String> devAddItem(@AuthenticationPrincipal UserDetails userDetails,
            @RequestParam Long itemId,
            @RequestParam Long amount) {
        Long userId = Long.parseLong(userDetails.getUsername());
        Company company = getCompanyByUserId(userId);

        inventoryService.addItem(company.getId(), itemId, amount);
        return ApiResponse.success("성공적으로 아이템 획득이 처리되었습니다.");
    }

    private Company getCompanyByUserId(Long userId) {
        return companyRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalArgumentException("이 유저는 아직 창고(기업)를 소유하고 있지 않습니다."));
    }
}
