package com.ssafy.ecosim.domain.inventory.service;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.inventory.dto.response.WarehouseSlotResponse;
import com.ssafy.ecosim.domain.inventory.entity.Warehouse;
import com.ssafy.ecosim.domain.inventory.entity.WarehouseSlot;
import com.ssafy.ecosim.domain.inventory.repository.WarehouseRepository;
import com.ssafy.ecosim.domain.inventory.repository.WarehouseSlotRepository;
import com.ssafy.ecosim.domain.item.entity.Item;
import com.ssafy.ecosim.domain.item.entity.ItemType;
import com.ssafy.ecosim.domain.item.repository.ItemRepository;
import com.ssafy.ecosim.global.kafka.publisher.WarehouseEventPublisher;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class WarehouseService {

    private final WarehouseRepository warehouseRepository;
    private final WarehouseSlotRepository warehouseSlotRepository;
    private final ItemRepository itemRepository;

    @Value("${warehouse.initial-slot-count:20}")
    private int initialSlotCount;

    @Value("${warehouse.expand-slot-amount:5}")
    private int expandSlotAmount;

    @Value("${warehouse.max-expandable-limit:100}")
    private int maxExpandableLimit;

    private final WarehouseEventPublisher warehouseEventPublisher;

    public WarehouseService(WarehouseRepository warehouseRepository,
            WarehouseSlotRepository warehouseSlotRepository,
            ItemRepository itemRepository,
            WarehouseEventPublisher warehouseEventPublisher) {
        this.warehouseRepository = warehouseRepository;
        this.warehouseSlotRepository = warehouseSlotRepository;
        this.itemRepository = itemRepository;
        this.warehouseEventPublisher = warehouseEventPublisher;
    }

    @Transactional
    public Warehouse createDefaultWarehouse(Company company) {
        Warehouse warehouse = new Warehouse(company, initialSlotCount);
        Warehouse saved = warehouseRepository.save(warehouse);

        List<WarehouseSlot> slots = new ArrayList<>();
        for (int i = 0; i < initialSlotCount; i++) {
            slots.add(new WarehouseSlot(saved, i));
        }
        warehouseSlotRepository.saveAll(slots);

        return saved;
    }

    public List<WarehouseSlotResponse> getWarehouse(Long companyId, Long inputItemId, Long outputItemId) {
        Warehouse warehouse = findWarehouse(companyId);
        return warehouse.getSlots().stream()
                .sorted(Comparator.comparingInt(WarehouseSlot::getSlotIndex))
                .map(slot -> new WarehouseSlotResponse(slot, inputItemId, outputItemId))
                .collect(Collectors.toList());
    }

    /**
     * 창고에 아이템을 추가할 수 있는 여유 공간(수량)을 반환합니다.
     * amount 만큼 수용 가능하면 amount를 리턴, 불가능하면 실제 가용량 리턴.
     */
    public long getAvailableCapacity(Long companyId, Long itemId, long amount) {
        Warehouse warehouse = findWarehouse(companyId);
        Item item = itemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 아이템입니다."));

        List<WarehouseSlot> slots = warehouse.getSlots();
        long capacity = 0;

        // 같은 아이템이 이미 있는 슬롯의 여유
        for (WarehouseSlot slot : slots) {
            if (slot.getItem() != null && slot.getItem().getId().equals(itemId)) {
                capacity += item.getMaxStackSize() - slot.getQuantity();
                if (capacity >= amount)
                    return capacity;
            }
        }
        // 빈 슬롯
        for (WarehouseSlot slot : slots) {
            if (slot.getItem() == null) {
                capacity += item.getMaxStackSize();
                if (capacity >= amount)
                    return capacity;
            }
        }
        return capacity;
    }

    @Transactional
    public void addItem(Long companyId, Long itemId, Long amount) {
        addItem(companyId, itemId, amount, null);
    }

    // 마켓에서 아이템을 구매했을 때 이벤트 발행을 위한 메서드 오버로딩
    @Transactional
    public void addItem(Long companyId, Long itemId, Long amount, String reason) {
        if (amount <= 0)
            throw new IllegalArgumentException("추가할 수량은 1 이상이어야 합니다.");

        Warehouse warehouse = findWarehouse(companyId);
        Item item = itemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 아이템입니다."));

        List<WarehouseSlot> slots = warehouse.getSlots();
        slots.sort(Comparator.comparingInt(WarehouseSlot::getSlotIndex));
        long remaining = amount;
        Instant now = Instant.now();

        for (WarehouseSlot slot : slots) {
            if (slot.getItem() != null && slot.getItem().getId().equals(itemId)) {
                long space = item.getMaxStackSize() - slot.getQuantity();
                if (space > 0) {
                    long added = Math.min(space, remaining);
                    slot.addItem(item, added);
                    remaining -= added;
                    if (reason != null)
                        publishStored(warehouse, slot, companyId, itemId, added, now, reason);
                    if (remaining == 0)
                        return;
                }
            }
        }

        for (WarehouseSlot slot : slots) {
            if (slot.getItem() == null) {
                long added = Math.min(item.getMaxStackSize(), remaining);
                slot.addItem(item, added);
                remaining -= added;
                if (reason != null)
                    publishStored(warehouse, slot, companyId, itemId, added, now, reason);
                if (remaining == 0)
                    return;
            }
        }

        if (remaining > 0)
            throw new IllegalArgumentException("창고 공간이 부족합니다.");
    }

    @Transactional
    public void removeItem(Long companyId, Long itemId, Long amount) {
        removeItem(companyId, itemId, amount, null);
    }

    // 마켓에서 아이템을 판매했을 때 이벤트 발행을 위한 메서드 오버로딩
    @Transactional
    public void removeItem(Long companyId, Long itemId, Long amount, String reason) {
        if (amount <= 0)
            throw new IllegalArgumentException("차감할 수량은 1 이상이어야 합니다.");

        Warehouse warehouse = findWarehouse(companyId);
        List<WarehouseSlot> slots = warehouse.getSlots().stream()
                .filter(s -> s.getItem() != null && s.getItem().getId().equals(itemId))
                .collect(Collectors.toList());

        long total = slots.stream().mapToLong(WarehouseSlot::getQuantity).sum();
        if (total < amount)
            throw new IllegalStateException("아이템 수량이 부족합니다.");

        long remaining = amount;
        Instant now = Instant.now();
        for (WarehouseSlot slot : slots) {
            if (remaining <= 0)
                break;
            long take = Math.min(slot.getQuantity(), remaining);
            long quantityAfter = slot.getQuantity() - take;
            if (quantityAfter == 0)
                slot.clearSlot();
            else
                slot.setItemAndQuantity(slot.getItem(), quantityAfter);
            remaining -= take;
            if (reason != null)
                publishRemoved(warehouse, slot, companyId, itemId, take, quantityAfter, now, reason);
        }
    }

    // Kafka 이벤트 발행 메서드 (아이템 획득)
    private void publishStored(Warehouse warehouse, WarehouseSlot slot, Long companyId, Long itemId,
            long quantityDelta, Instant storedAt, String reason) {
        warehouseEventPublisher.publishItemStored(
                warehouse.getId(), slot.getId(), slot.getSlotIndex(),
                companyId, itemId, quantityDelta, slot.getQuantity(),
                reason, storedAt);
    }

    // Kafka 이벤트 발행 메서드 (아이템 차감)
    private void publishRemoved(Warehouse warehouse, WarehouseSlot slot, Long companyId, Long itemId,
            long quantityDelta, long quantityAfter, Instant removedAt, String reason) {
        warehouseEventPublisher.publishItemRemoved(
                warehouse.getId(), slot.getId(), slot.getSlotIndex(),
                companyId, itemId, quantityDelta, quantityAfter,
                reason, removedAt);
    }

    public long getItemQuantity(Long companyId, Long itemId) {
        Warehouse warehouse = findWarehouse(companyId);
        return warehouse.getSlots().stream()
                .filter(s -> s.getItem() != null && s.getItem().getId().equals(itemId))
                .mapToLong(WarehouseSlot::getQuantity)
                .sum();
    }

    @Transactional
    public void swapOrMergeSlots(Long companyId, int fromIndex, int toIndex) {
        Warehouse warehouse = findWarehouse(companyId);
        if (fromIndex == toIndex) return;

        WarehouseSlot from = getSlotByIndex(warehouse, fromIndex);
        WarehouseSlot to = getSlotByIndex(warehouse, toIndex);

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
    public void useExpandTicket(Long companyId, int ticketSlotIndex) {
        Warehouse warehouse = findWarehouse(companyId);
        WarehouseSlot ticketSlot = getSlotByIndex(warehouse, ticketSlotIndex);

        if (ticketSlot.getItem() == null || ticketSlot.getItem().getType() != ItemType.TICKET)
            throw new IllegalArgumentException("해당 슬롯에 유효한 확장권(TICKET)이 없습니다.");

        int current = warehouse.getMaxSlot();
        warehouse.expandSlots(expandSlotAmount, maxExpandableLimit);

        long left = ticketSlot.getQuantity() - 1;
        if (left <= 0) ticketSlot.clearSlot();
        else ticketSlot.setItemAndQuantity(ticketSlot.getItem(), left);

        List<WarehouseSlot> newSlots = new ArrayList<>();
        for (int i = current; i < current + expandSlotAmount; i++) {
            newSlots.add(new WarehouseSlot(warehouse, i));
        }
        warehouseSlotRepository.saveAll(newSlots);
    }

    @Transactional
    public void decreaseQuantity(Long companyId, Integer slotIndex, Long amount) {
        if (amount <= 0) throw new IllegalArgumentException("차감할 수량은 1 이상이어야 합니다.");

        Warehouse warehouse = findWarehouse(companyId);
        WarehouseSlot slot = getSlotByIndex(warehouse, slotIndex);

        if (slot.getItem() == null) throw new IllegalArgumentException("해당 슬롯이 비어있습니다.");
        if (slot.getQuantity() < amount) throw new IllegalStateException("슬롯의 수량이 부족합니다.");

        long left = slot.getQuantity() - amount;
        if (left == 0) slot.clearSlot();
        else slot.setItemAndQuantity(slot.getItem(), left);
    }

    /**
     * 회사 config 기준으로 MATERIAL(input) 또는 PRODUCT(output) 아이템을 폐기합니다.
     * 아이템의 DB 타입이 아닌 inputItemId/outputItemId로 대상 아이템을 결정합니다.
     */
    @Transactional
    public void discardByItemType(Long companyId, ItemType itemType, Long amount,
                                  Long inputItemId, Long outputItemId) {
        if (amount <= 0) throw new IllegalArgumentException("폐기 수량은 1 이상이어야 합니다.");

        Long targetItemId = (itemType == ItemType.MATERIAL) ? inputItemId : outputItemId;
        if (targetItemId == null)
            throw new IllegalArgumentException("회사의 생산 아이템 설정이 되어있지 않습니다.");

        Warehouse warehouse = findWarehouse(companyId);
        List<WarehouseSlot> slots = warehouse.getSlots().stream()
                .filter(s -> s.getItem() != null && s.getItem().getId().equals(targetItemId))
                .collect(Collectors.toList());

        long total = slots.stream().mapToLong(WarehouseSlot::getQuantity).sum();
        if (total < amount) throw new IllegalStateException("해당 아이템의 수량이 부족합니다.");

        long remaining = amount;
        for (WarehouseSlot slot : slots) {
            if (remaining <= 0) break;
            long take = Math.min(slot.getQuantity(), remaining);
            if (slot.getQuantity() - take == 0) slot.clearSlot();
            else slot.setItemAndQuantity(slot.getItem(), slot.getQuantity() - take);
            remaining -= take;
        }
    }

    private Warehouse findWarehouse(Long companyId) {
        return warehouseRepository.findByCompanyId(companyId)
                .orElseThrow(() -> new IllegalArgumentException("창고를 찾을 수 없습니다."));
    }

    private WarehouseSlot getSlotByIndex(Warehouse warehouse, int index) {
        return warehouse.getSlots().stream()
                .filter(s -> s.getSlotIndex() == index)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("유효하지 않은 슬롯 번호입니다."));
    }
}
