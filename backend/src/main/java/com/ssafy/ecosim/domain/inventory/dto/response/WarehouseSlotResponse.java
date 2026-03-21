package com.ssafy.ecosim.domain.inventory.dto.response;

import com.ssafy.ecosim.domain.inventory.entity.WarehouseSlot;
import com.ssafy.ecosim.domain.item.entity.ItemType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;

@Schema(description = "창고 슬롯 응답 (MATERIAL/PRODUCT 전용)")
@Getter
public class WarehouseSlotResponse {

    @Schema(description = "슬롯 인덱스 (0부터 시작)", example = "0")
    private final Integer slotIndex;

    @Schema(description = "아이템 ID (빈 슬롯이면 null)", example = "1")
    private final Long itemId;

    @Schema(description = "아이템 이름 (빈 슬롯이면 null)", example = "철광석")
    private final String itemName;

    @Schema(description = "아이템 종류 (MATERIAL 또는 PRODUCT, 빈 슬롯이면 null)", example = "MATERIAL")
    private final ItemType itemType;

    @Schema(description = "현재 수량 (빈 슬롯이면 0)", example = "50")
    private final Long quantity;

    @Schema(description = "최대 적재 수량 (빈 슬롯이면 null)", example = "100")
    private final Long maxQuantity;

    /**
     * @param slot         창고 슬롯
     * @param inputItemId  회사의 생산 input 아이템 ID (company.inputItemId)
     * @param outputItemId 회사의 생산 output 아이템 ID (company.outputItemId)
     *
     * itemType은 아이템 자체의 DB 타입이 아닌 회사 config 기준으로 결정됩니다.
     *   - 슬롯 아이템 == inputItemId  → MATERIAL
     *   - 슬롯 아이템 == outputItemId → PRODUCT
     */
    public WarehouseSlotResponse(WarehouseSlot slot, Long inputItemId, Long outputItemId) {
        this.slotIndex = slot.getSlotIndex();
        if (slot.getItem() != null) {
            this.itemId = slot.getItem().getId();
            this.itemName = slot.getItem().getName();
            this.quantity = slot.getQuantity();
            this.maxQuantity = slot.getItem().getMaxStackSize();

            Long id = slot.getItem().getId();
            if (id.equals(inputItemId)) {
                this.itemType = ItemType.MATERIAL;
            } else if (id.equals(outputItemId)) {
                this.itemType = ItemType.PRODUCT;
            } else {
                this.itemType = slot.getItem().getType();
            }
        } else {
            this.itemId = null;
            this.itemName = null;
            this.itemType = null;
            this.quantity = 0L;
            this.maxQuantity = null;
        }
    }
}
