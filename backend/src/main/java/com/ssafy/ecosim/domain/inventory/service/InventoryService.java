package com.ssafy.ecosim.domain.inventory.service;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.inventory.dto.response.InventorySlotResponse;
import com.ssafy.ecosim.domain.inventory.entity.CompanyInventory;
import com.ssafy.ecosim.domain.inventory.entity.InventorySlot;
import com.ssafy.ecosim.domain.inventory.repository.CompanyInventoryRepository;
import com.ssafy.ecosim.domain.inventory.repository.InventorySlotRepository;
import com.ssafy.ecosim.domain.item.entity.Item;
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

    private final CompanyInventoryRepository companyInventoryRepository;
    private final InventorySlotRepository inventorySlotRepository;
    private final ItemRepository itemRepository;

    @Value("${warehouse.initial-slot-count:20}")
    private int initialSlotCount;

    @Value("${warehouse.max-stack-size:100}")
    private long maxStackSize;

    @Value("${warehouse.expand-slot-amount:5}")
    private int expandSlotAmount;

    @Value("${warehouse.max-expandable-limit:100}")
    private int maxExpandableLimit;

    public InventoryService(CompanyInventoryRepository companyInventoryRepository,
            InventorySlotRepository inventorySlotRepository,
            ItemRepository itemRepository) {
        this.companyInventoryRepository = companyInventoryRepository;
        this.inventorySlotRepository = inventorySlotRepository;
        this.itemRepository = itemRepository;
    }

    @Transactional
    public CompanyInventory createDefaultInventory(Company company) {
        CompanyInventory defaultInventory = new CompanyInventory(company, initialSlotCount);
        CompanyInventory savedInventory = companyInventoryRepository.save(defaultInventory);

        List<InventorySlot> initialSlots = new ArrayList<>();
        for (int i = 0; i < initialSlotCount; i++) {
            initialSlots.add(new InventorySlot(savedInventory, i));
        }
        inventorySlotRepository.saveAll(initialSlots);

        return savedInventory;
    }

    public List<InventorySlotResponse> getInventory(Long companyId) {
        CompanyInventory inventory = companyInventoryRepository.findByCompanyId(companyId)
                .orElseThrow(() -> new IllegalArgumentException("창고를 찾을 수 없습니다."));

        return inventory.getSlots().stream()
                .sorted(Comparator.comparingInt(InventorySlot::getSlotIndex))
                .map(InventorySlotResponse::new)
                .collect(Collectors.toList());
    }

    @Transactional
    public void addItem(Long companyId, Long itemId, Long amount) {
        if (amount <= 0)
            throw new IllegalArgumentException("추가할 수량은 1 이상이어야 합니다.");

        CompanyInventory inventory = companyInventoryRepository.findByCompanyId(companyId)
                .orElseThrow(() -> new IllegalArgumentException("창고를 찾을 수 없습니다."));
        Item item = itemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 아이템입니다."));

        List<InventorySlot> slots = inventory.getSlots();
        slots.sort(Comparator.comparingInt(InventorySlot::getSlotIndex));

        long remainingAmount = amount;

        // 1. 이미 동일한 아이템이 들어있는 슬롯 탐색 후 남은 여유공간에 먼저 채우기
        for (InventorySlot slot : slots) {
            if (slot.getItem() != null && slot.getItem().getId().equals(itemId)) {
                long availableSpace = maxStackSize - slot.getQuantity();
                if (availableSpace > 0) {
                    long added = Math.min(availableSpace, remainingAmount);
                    slot.addItem(item, added); // 사실상 quantity 증가
                    remainingAmount -= added;

                    if (remainingAmount == 0)
                        return;
                }
            }
        }

        // 2. 다 못채웠다면 (혹은 아예 새 아이템이라면) 앞쪽 빈 슬롯부터 채워넣기
        for (InventorySlot slot : slots) {
            if (slot.getItem() == null) {
                long added = Math.min(maxStackSize, remainingAmount);
                slot.addItem(item, added);
                remainingAmount -= added;

                if (remainingAmount == 0)
                    return;
            }
        }

        // 3. 다 돌았는데도 remainingAmount가 남았다면 창고가 가득 찬 것
        if (remainingAmount > 0) {
            throw new IllegalArgumentException("창고 공간이 부족합니다. 획득 대기 상태로 전환하거나 소지품을 비우세요.");
            // 나중 기획에 따라 우편함으로 보내거나 임시 보관소로 보내는 로직을 추가할 수 있습니다.
        }
    }

    @Transactional
    public void swapOrMergeSlots(Long companyId, int fromSlotIndex, int toSlotIndex) {
        CompanyInventory inventory = companyInventoryRepository.findByCompanyId(companyId)
                .orElseThrow(() -> new IllegalArgumentException("창고를 찾을 수 없습니다."));

        if (fromSlotIndex == toSlotIndex)
            return;

        InventorySlot fromSlot = getSlotByIndex(inventory, fromSlotIndex);
        InventorySlot toSlot = getSlotByIndex(inventory, toSlotIndex);

        if (fromSlot.getItem() == null) {
            throw new IllegalArgumentException("출발 슬롯이 비어있습니다.");
        }

        // 도착 슬롯이 비어있는 경우 (단순 이동)
        if (toSlot.getItem() == null) {
            toSlot.setItemAndQuantity(fromSlot.getItem(), fromSlot.getQuantity());
            fromSlot.clearSlot();
            return;
        }

        // 도착 슬롯에 아이템이 있고, 이름(또는 ID)가 동일한 경우 (스택 병합 시도)
        if (toSlot.getItem().getId().equals(fromSlot.getItem().getId())) {
            long availableSpace = maxStackSize - toSlot.getQuantity();
            if (availableSpace > 0) {
                long amountToMove = Math.min(availableSpace, fromSlot.getQuantity());
                toSlot.addItem(toSlot.getItem(), amountToMove);

                long leftAmount = fromSlot.getQuantity() - amountToMove;
                if (leftAmount <= 0) {
                    fromSlot.clearSlot();
                } else {
                    fromSlot.setItemAndQuantity(fromSlot.getItem(), leftAmount);
                }
            }
            return;
        }

        // 도착 슬롯에 다른 종류의 아이템이 있는 경우 (단순 서로 바꾸기 - Swap)
        Item tempItem = toSlot.getItem();
        long tempQuantity = toSlot.getQuantity();

        toSlot.setItemAndQuantity(fromSlot.getItem(), fromSlot.getQuantity());
        fromSlot.setItemAndQuantity(tempItem, tempQuantity);
    }

    @Transactional
    public void useExpandTicket(Long companyId, int ticketSlotIndex) {
        CompanyInventory inventory = companyInventoryRepository.findByCompanyId(companyId)
                .orElseThrow(() -> new IllegalArgumentException("창고를 찾을 수 없습니다."));

        InventorySlot ticketSlot = getSlotByIndex(inventory, ticketSlotIndex);
        if (ticketSlot.getItem() == null
                || ticketSlot.getItem().getType() != com.ssafy.ecosim.domain.item.entity.ItemType.TICKET) {
            throw new IllegalArgumentException("해당 슬롯에 유효한 확장권(TICKET) 아이템이 없습니다.");
        }

        // 1. 최대 확장 한도 검사
        int currentMaxSlot = inventory.getMaxSlot();
        inventory.expandSlots(expandSlotAmount, maxExpandableLimit); // 제한 초과시 Exception 발생

        // 2. 티켓 차감 (1장 사용)
        long leftAmount = ticketSlot.getQuantity() - 1;
        if (leftAmount <= 0) {
            ticketSlot.clearSlot();
        } else {
            ticketSlot.setItemAndQuantity(ticketSlot.getItem(), leftAmount);
        }

        // 3. 빈 슬롯 추가 생성
        List<InventorySlot> newSlots = new ArrayList<>();
        for (int i = currentMaxSlot; i < currentMaxSlot + expandSlotAmount; i++) {
            newSlots.add(new InventorySlot(inventory, i));
        }
        inventorySlotRepository.saveAll(newSlots);
    }

    private InventorySlot getSlotByIndex(CompanyInventory inventory, int index) {
        return inventory.getSlots().stream()
                .filter(slot -> slot.getSlotIndex() == index)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("유효하지 않은 슬롯 번호입니다."));
    }
}
