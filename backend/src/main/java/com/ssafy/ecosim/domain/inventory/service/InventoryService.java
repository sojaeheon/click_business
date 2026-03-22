package com.ssafy.ecosim.domain.inventory.service;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.inventory.dto.response.InventorySlotResponse;
import com.ssafy.ecosim.domain.inventory.entity.Inventory;
import com.ssafy.ecosim.domain.inventory.entity.InventorySlot;
import com.ssafy.ecosim.domain.inventory.repository.InventoryRepository;
import com.ssafy.ecosim.domain.inventory.repository.InventorySlotRepository;
import com.ssafy.ecosim.domain.item.entity.Item;
import com.ssafy.ecosim.domain.item.entity.ItemType;
import com.ssafy.ecosim.domain.item.repository.ItemRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class InventoryService {

    private final InventoryRepository inventoryRepository;
    private final InventorySlotRepository inventorySlotRepository;
    private final ItemRepository itemRepository;

    @Value("${inventory.initial-slot-count:10}")
    private int initialSlotCount;

    public InventoryService(InventoryRepository inventoryRepository,
            InventorySlotRepository inventorySlotRepository,
            ItemRepository itemRepository) {
        this.inventoryRepository = inventoryRepository;
        this.inventorySlotRepository = inventorySlotRepository;
        this.itemRepository = itemRepository;
    }

    @Transactional
    public Inventory createDefaultInventory(Company company) {
        Inventory inventory = new Inventory(company, initialSlotCount);
        Inventory saved = inventoryRepository.save(inventory);

        List<InventorySlot> slots = new ArrayList<>();
        for (int i = 0; i < initialSlotCount; i++) {
            slots.add(new InventorySlot(saved, i));
        }
        inventorySlotRepository.saveAll(slots);
        saved.getSlots().addAll(slots); // 동일 트랜잭션 내 1차 캐시에도 반영

        return saved;
    }

    public List<InventorySlotResponse> getInventory(Long companyId) {
        Inventory inventory = findInventory(companyId);
        return inventory.getSlots().stream()
                .sorted(Comparator.comparingInt(InventorySlot::getSlotIndex))
                .map(InventorySlotResponse::new)
                .collect(Collectors.toList());
    }

    @Transactional
    public void addItem(Long companyId, Long itemId, Long amount) {
        if (amount <= 0) throw new IllegalArgumentException("추가할 수량은 1 이상이어야 합니다.");

        Inventory inventory = findInventory(companyId);
        Item item = itemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 아이템입니다."));

        if (item.getType() != ItemType.EQUIPMENT && item.getType() != ItemType.TICKET)
            throw new IllegalArgumentException("인벤토리에는 EQUIPMENT, TICKET 아이템만 보관할 수 있습니다.");

        List<InventorySlot> slots = inventory.getSlots();
        slots.sort(Comparator.comparingInt(InventorySlot::getSlotIndex));
        long remaining = amount;

        for (InventorySlot slot : slots) {
            if (slot.getItem() != null && slot.getItem().getId().equals(itemId)) {
                long space = item.getMaxStackSize() - slot.getQuantity();
                if (space > 0) {
                    long added = Math.min(space, remaining);
                    slot.addItem(item, added);
                    remaining -= added;
                    if (remaining == 0) return;
                }
            }
        }

        for (InventorySlot slot : slots) {
            if (slot.getItem() == null) {
                long added = Math.min(item.getMaxStackSize(), remaining);
                slot.addItem(item, added);
                remaining -= added;
                if (remaining == 0) return;
            }
        }

        if (remaining > 0) throw new IllegalArgumentException("인벤토리 공간이 부족합니다.");
    }

    @Transactional
    public void swapSlots(Long companyId, int fromIndex, int toIndex) {
        Inventory inventory = findInventory(companyId);
        if (fromIndex == toIndex) return;

        InventorySlot from = getSlotByIndex(inventory, fromIndex);
        InventorySlot to = getSlotByIndex(inventory, toIndex);

        if (from.getItem() == null) throw new IllegalArgumentException("출발 슬롯이 비어있습니다.");

        if (to.getItem() == null) {
            to.setItemAndQuantity(from.getItem(), from.getQuantity());
            from.clearSlot();
            return;
        }

        if (to.getItem().getId().equals(from.getItem().getId())) {
            long space = to.getItem().getMaxStackSize() - to.getQuantity();
            if (space > 0) {
                long move = Math.min(space, from.getQuantity());
                to.addItem(to.getItem(), move);
                long left = from.getQuantity() - move;
                if (left <= 0) from.clearSlot();
                else from.setItemAndQuantity(from.getItem(), left);
            }
            return;
        }

        Item tmp = to.getItem();
        long tmpQty = to.getQuantity();
        to.setItemAndQuantity(from.getItem(), from.getQuantity());
        from.setItemAndQuantity(tmp, tmpQty);
    }

    @Transactional
    public void decreaseQuantity(Long companyId, Integer slotIndex, Long amount) {
        if (amount <= 0) throw new IllegalArgumentException("차감할 수량은 1 이상이어야 합니다.");

        Inventory inventory = findInventory(companyId);
        InventorySlot slot = getSlotByIndex(inventory, slotIndex);

        if (slot.getItem() == null) throw new IllegalArgumentException("해당 슬롯이 비어있습니다.");
        if (slot.getQuantity() < amount) throw new IllegalStateException("슬롯의 수량이 부족합니다.");

        long left = slot.getQuantity() - amount;
        if (left == 0) slot.clearSlot();
        else slot.setItemAndQuantity(slot.getItem(), left);
    }

    private Inventory findInventory(Long companyId) {
        return inventoryRepository.findByCompanyId(companyId)
                .orElseThrow(() -> new IllegalArgumentException("인벤토리를 찾을 수 없습니다."));
    }

    private InventorySlot getSlotByIndex(Inventory inventory, int index) {
        return inventory.getSlots().stream()
                .filter(s -> s.getSlotIndex() == index)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("유효하지 않은 슬롯 번호입니다."));
    }
}
