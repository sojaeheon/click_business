package com.ssafy.ecosim.domain.inventory.dto.response;

import com.ssafy.ecosim.domain.inventory.entity.InventorySlot;
import com.ssafy.ecosim.domain.item.entity.ItemType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;

@Schema(description = "인벤토리 슬롯 응답 (EQUIPMENT/TICKET 전용)")
@Getter
public class InventorySlotResponse {

    @Schema(description = "슬롯 고유 ID (PK)", example = "100")
    private final Long slotId;

    @Schema(description = "슬롯 인덱스 (0부터 시작)", example = "0")
    private final Integer slotIndex;

    @Schema(description = "아이템 ID (빈 슬롯이면 null)", example = "5")
    private final Long itemId;

    @Schema(description = "아이템 이름 (빈 슬롯이면 null)", example = "고급 용광로")
    private final String itemName;

    @Schema(description = "아이템 종류 (EQUIPMENT 또는 TICKET, 빈 슬롯이면 null)", example = "EQUIPMENT")
    private final ItemType itemType;

    @Schema(description = "현재 수량 (빈 슬롯이면 0)", example = "1")
    private final Long quantity;

    @Schema(description = "최대 적재 수량 (빈 슬롯이면 null)", example = "10")
    private final Long maxQuantity;

    @Schema(description = "일꾼 레벨 (일꾼 아이템만, 빈 슬롯 또는 비일꾼 아이템이면 null)", example = "2")
    private final Integer workerLevel;

    @Schema(description = "장착 여부", example = "true")
    private final boolean equipped;

    public InventorySlotResponse(InventorySlot slot) {
        this.slotId = slot.getId();
        this.slotIndex = slot.getSlotIndex();
        this.equipped = slot.isEquipped();
        if (slot.getItem() != null) {
            this.itemId = slot.getItem().getId();
            this.itemName = slot.getItem().getName();
            this.itemType = slot.getItem().getType();
            this.quantity = slot.getQuantity();
            this.maxQuantity = slot.getItem().getMaxStackSize();
            this.workerLevel = slot.getItem().getWorkerLevel();
        } else {
            this.itemId = null;
            this.itemName = null;
            this.itemType = null;
            this.quantity = 0L;
            this.maxQuantity = null;
            this.workerLevel = null;
        }
    }
}
