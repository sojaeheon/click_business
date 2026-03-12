package com.ssafy.ecosim.domain.item.controller;

import com.ssafy.ecosim.domain.item.entity.Item;
import com.ssafy.ecosim.domain.item.entity.ItemType;
import com.ssafy.ecosim.domain.item.repository.ItemRepository;
import com.ssafy.ecosim.global.common.ApiResponse;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/items")
public class ItemController {

    private final ItemRepository itemRepository;

    public ItemController(ItemRepository itemRepository) {
        this.itemRepository = itemRepository;
    }

    /**
     * (테스트/개발용 임시) 아이템 데이터베이스에 마스터 데이터 등록
     */
    @PostMapping("/dummy")
    public ApiResponse<Long> createDummyItem(@RequestParam String name,
            @RequestParam String type,
            @RequestParam String description) {
        Item item = Item.builder()
                .name(name)
                .type(ItemType.valueOf(type)) // MATERIAL, PRODUCT, EQUIPMENT, TICKET
                .description(description)
                .build();

        Item savedItem = itemRepository.save(item);
        return ApiResponse.success(savedItem.getId());
    }
}
