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

    /**
     * 기업 생성 시 기본 인벤토리 초기화 (EQUIPMENT/TICKET 보관용)
     * 초보 일꾼 1개 기본 제공
     */
    @Transactional
    public Inventory createDefaultInventory(Company company) {
        Inventory inventory = new Inventory(company, initialSlotCount);
        Inventory saved = inventoryRepository.save(inventory);

        List<InventorySlot> slots = new ArrayList<>();
        for (int i = 0; i < initialSlotCount; i++) {
            slots.add(new InventorySlot(saved, i));
        }
        inventorySlotRepository.saveAll(slots);

        // 초보 일꾼 1개 기본 제공
        Item beginnerWorker = itemRepository.findByName("초보 일꾼")
                .orElseThrow(() -> new IllegalStateException("초보 일꾼 아이템을 찾을 수 없습니다."));
        slots.get(0).addItem(beginnerWorker, 1L);

        return saved;
    }

    /**
     * 인벤토리 전체 슬롯 조회
     */
    public List<InventorySlotResponse> getInventory(Long companyId) {
        Inventory inventory = findInventory(companyId);
        return inventory.getSlots().stream()
                .sorted(Comparator.comparingInt(InventorySlot::getSlotIndex))
                .map(InventorySlotResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * 인벤토리에 아이템 추가 (스택 가능한 경우 자동 병합)
     */
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

    /**
     * 슬롯 간 아이템 이동/병합 (같은 아이템이면 수량 합산)
     */
    @Transactional
    public void swapSlots(Long companyId, int fromIndex, int toIndex) {
        Inventory inventory = findInventory(companyId);
        if (fromIndex == toIndex) return;

        InventorySlot from = getSlotByIndex(inventory, fromIndex);
        InventorySlot to = getSlotByIndex(inventory, toIndex);

        if (from.isEquipped() || to.isEquipped()) {
            throw new IllegalStateException("장착 중인 아이템은 슬롯을 변경할 수 없습니다. 장착 해제 후 다시 시도해주세요.");
        }

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

    /**
     * 슬롯 아이템 수량 감소
     */
    @Transactional
    public void decreaseQuantity(Long companyId, Integer slotIndex, Long amount) {
        if (amount <= 0) throw new IllegalArgumentException("차감할 수량은 1 이상이어야 합니다.");

        Inventory inventory = findInventory(companyId);
        InventorySlot slot = getSlotByIndex(inventory, slotIndex);

        if (slot.getItem() == null) throw new IllegalArgumentException("해당 슬롯이 비어있습니다.");
        if (slot.getQuantity() < amount) throw new IllegalStateException("슬롯의 수량이 부족합니다.");

        if (slot.isEquipped()) {
            throw new IllegalStateException("장착 중인 아이템은 버릴 수 없습니다.");
        }

        long left = slot.getQuantity() - amount;
        if (left == 0) slot.clearSlot();
        else slot.setItemAndQuantity(slot.getItem(), left);
    }

    /**
     * 인벤토리 확장권 사용하여 슬롯 1칸 확장
     */
    @Transactional
    public void expandInventory(Long companyId, int ticketSlotIndex) {
        Inventory inventory = findInventory(companyId);
        InventorySlot ticketSlot = getSlotByIndex(inventory, ticketSlotIndex);

        if (ticketSlot.getItem() == null) 
            throw new IllegalArgumentException("해당 슬롯이 비어있습니다.");
        
        if (ticketSlot.getItem().getType() != ItemType.TICKET || 
            !ticketSlot.getItem().getName().contains("인벤토리 확장권"))
            throw new IllegalArgumentException("인벤토리 확장권이 아닙니다.");

        // 인벤토리 슬롯 1칸 확장
        int currentMaxSlot = inventory.getMaxSlot();
        inventory.expandSlots(1);

        // 확장권 1개 소모
        long left = ticketSlot.getQuantity() - 1;
        if (left <= 0) ticketSlot.clearSlot();
        else ticketSlot.setItemAndQuantity(ticketSlot.getItem(), left);

        // 새 슬롯 추가
        InventorySlot newSlot = new InventorySlot(inventory, currentMaxSlot);
        inventorySlotRepository.save(newSlot);
    }

    /**
     * 일꾼 장착
     */
    @Transactional
    public void equipWorker(Long companyId, Integer slotIndex) {
        Inventory inventory = findInventory(companyId);
        InventorySlot targetSlot = getSlotByIndex(inventory, slotIndex);

        if (targetSlot.getItem() == null) {
            throw new IllegalArgumentException("슬롯이 비어있습니다.");
        }
        if (targetSlot.getItem().getType() != ItemType.EQUIPMENT) {
            throw new IllegalArgumentException("EQUIPMENT 타입만 장착할 수 있습니다.");
        }

        // 기존 장착 해제 (한 번에 하나만 장착 가능하다고 가정)
        inventory.getSlots().forEach(InventorySlot::unequip);

        // 새로 장착
        targetSlot.equip();
    }

    /**
     * 일꾼 장착 해제
     */
    @Transactional
    public void unequipWorker(Long companyId) {
        Inventory inventory = findInventory(companyId);
        inventory.getSlots().forEach(InventorySlot::unequip);
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
