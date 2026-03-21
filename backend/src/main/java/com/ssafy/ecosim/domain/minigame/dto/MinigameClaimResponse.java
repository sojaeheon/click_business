package com.ssafy.ecosim.domain.minigame.dto;

import com.ssafy.ecosim.domain.item.entity.Item;
import com.ssafy.ecosim.domain.item.entity.ItemType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;

@Schema(description = "미니게임 보상 수령 응답")
@Getter
public class MinigameClaimResponse {

    @Schema(description = "획득한 아이템 ID", example = "4")
    private final Long itemId;

    @Schema(description = "획득한 아이템 이름", example = "초보 일꾼")
    private final String itemName;

    @Schema(description = "아이템 종류 (EQUIPMENT 또는 TICKET)", example = "EQUIPMENT")
    private final ItemType itemType;

    @Schema(description = "일꾼 레벨 (일꾼 아이템만, 나머지는 null)", example = "1")
    private final Integer workerLevel;

    public MinigameClaimResponse(Item item) {
        this.itemId = item.getId();
        this.itemName = item.getName();
        this.itemType = item.getType();
        this.workerLevel = item.getWorkerLevel();
    }
}
