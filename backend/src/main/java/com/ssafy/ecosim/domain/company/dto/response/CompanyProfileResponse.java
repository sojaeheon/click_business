package com.ssafy.ecosim.domain.company.dto.response;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.inventory.entity.Inventory;
import com.ssafy.ecosim.domain.inventory.entity.InventorySlot;
import com.ssafy.ecosim.domain.inventory.entity.Warehouse;
import com.ssafy.ecosim.domain.inventory.entity.WarehouseSlot;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;

@Schema(description = "기업 프로필 페이지 응답 (UI 전용)")
@Getter
public class CompanyProfileResponse {

    @Schema(description = "기업 ID")
    private final Long companyId;

    @Schema(description = "기업명")
    private final String companyName;

    @Schema(description = "산업군")
    private final String industry;

    @Schema(description = "보유 현금")
    private final Long cash;

    @Schema(description = "총 자산")
    private final Long totalAsset;

    @Schema(description = "기업 레벨")
    private final Integer level;

    @Schema(description = "창고 최대 슬롯 수")
    private final Integer warehouseMaxSlots;

    @Schema(description = "창고 사용 슬롯 수 (아이템이 있는 슬롯)")
    private final long warehouseUsedSlots;

    @Schema(description = "인벤토리 최대 슬롯 수")
    private final Integer inventoryMaxSlots;

    @Schema(description = "인벤토리 사용 슬롯 수 (아이템이 있는 슬롯)")
    private final long inventoryUsedSlots;

    public CompanyProfileResponse(Company company, Warehouse warehouse, Inventory inventory) {
        this.companyId = company.getId();
        this.companyName = company.getName();
        this.industry = company.getIndustryType() != null ? company.getIndustryType().name() : null;
        this.cash = company.getCash();
        this.totalAsset = company.getTotalAsset();
        this.level = company.getLevel();

        this.warehouseMaxSlots = warehouse.getMaxSlot();
        this.warehouseUsedSlots = warehouse.getSlots().stream()
                .filter(s -> s.getItem() != null).count();

        this.inventoryMaxSlots = inventory.getMaxSlot();
        this.inventoryUsedSlots = inventory.getSlots().stream()
                .filter(s -> s.getItem() != null).count();
    }
}
