package com.ssafy.ecosim.domain.inventory.dto.response;

import com.ssafy.ecosim.domain.inventory.entity.InventorySlot;
import com.ssafy.ecosim.domain.item.entity.ItemType;
import lombok.Getter;

@Getter
public class InventorySlotResponse {
    private Integer slotIndex;
    private Long itemId;
    private String itemName;
    private ItemType itemType;
    private Long quantity;
    private Long maxQuantity;

    public InventorySlotResponse(InventorySlot slot) {
        this.slotIndex = slot.getSlotIndex();
        if (slot.getItem() != null) {
            this.itemId = slot.getItem().getId();
            this.itemName = slot.getItem().getName();
            this.itemType = slot.getItem().getType();
            this.quantity = slot.getQuantity();
            this.maxQuantity = slot.getItem().getMaxStackSize();
        } else {
            // 빈 슬롯 처리
            this.itemId = null;
            this.itemName = null;
            this.itemType = null;
            this.quantity = 0L;
        }
    }
}
