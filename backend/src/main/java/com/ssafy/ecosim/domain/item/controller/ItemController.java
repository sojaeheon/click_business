package com.ssafy.ecosim.domain.item.controller;

import com.ssafy.ecosim.domain.item.entity.Item;
import com.ssafy.ecosim.domain.item.entity.ItemType;
import com.ssafy.ecosim.domain.item.repository.ItemRepository;
import com.ssafy.ecosim.global.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

@Tag(name = "아이템", description = "아이템 마스터 데이터 관리")
@RestController
@RequestMapping("/api/v1/items")
public class ItemController {

    private final ItemRepository itemRepository;

    public ItemController(ItemRepository itemRepository) {
        this.itemRepository = itemRepository;
    }

    @Operation(summary = "[개발용] 아이템 마스터 데이터 등록", description = "아이템 DB에 마스터 데이터를 직접 등록합니다. 타입은 MATERIAL, PRODUCT, EQUIPMENT, TICKET 중 하나입니다.")
    @PostMapping("/dummy")
    public ApiResponse<Long> createDummyItem(
            @Parameter(description = "아이템 이름", example = "목재") @RequestParam String name,
            @Parameter(description = "아이템 타입 (MATERIAL / PRODUCT / EQUIPMENT / TICKET)", example = "MATERIAL") @RequestParam String type,
            @Parameter(description = "아이템 설명", example = "기본 자원 재료입니다.") @RequestParam String description) {
        Item item = Item.builder()
                .name(name)
                .type(ItemType.valueOf(type))
                .description(description)
                .build();

        Item savedItem = itemRepository.save(item);
        return ApiResponse.success(savedItem.getId());
    }
}
