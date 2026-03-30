package com.ssafy.ecosim.domain.hr.service;

import com.ssafy.ecosim.domain.hr.dto.response.WorkerUpgradeResponse;
import com.ssafy.ecosim.domain.hr.dto.response.WorkerUpgradeResponse.UpgradeResult;
import com.ssafy.ecosim.domain.inventory.entity.InventorySlot;
import com.ssafy.ecosim.domain.inventory.repository.InventorySlotRepository;
import com.ssafy.ecosim.domain.inventory.service.InventoryService;
import com.ssafy.ecosim.domain.item.entity.Item;
import com.ssafy.ecosim.domain.item.repository.ItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 인력소 서비스.
 * 일꾼 강화: 동일 레벨 일꾼 2개 소모 → 확률에 따라 결과 일꾼 지급
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class HRService {

    private static final double[][] UPGRADE_PROBS = {
        // { success, stay, down, reset }  index = level-1
        { 0.70, 0.30, 0.00, 0.00 }, // Lv1 → Lv2
        { 0.50, 0.35, 0.15, 0.00 }, // Lv2 → Lv3
        { 0.15, 0.40, 0.35, 0.10 }, // Lv3 → Lv4
        { 0.05, 0.35, 0.40, 0.20 }, // Lv4 → Lv5
        { 0.01, 0.30, 0.50, 0.19 }, // Lv5 → Lv6
    };

    private final InventorySlotRepository inventorySlotRepository;
    private final InventoryService inventoryService;
    private final ItemRepository itemRepository;

    /**
     * 일꾼 강화 처리
     * - 해당 레벨 일꾼 2개 소모
     * - 확률 계산 후 결과 레벨 일꾼 1개 지급 (reset 시 지급 없음)
     */
    @Transactional
    public WorkerUpgradeResponse upgradeWorker(Long companyId, int currentLevel) {
        if (currentLevel < 1 || currentLevel > 5) {
            throw new IllegalArgumentException("강화 가능한 레벨 범위는 1~5입니다.");
        }

        // 해당 레벨 일꾼 슬롯 조회 (장착 중인 슬롯 제외)
        List<InventorySlot> workerSlots = inventorySlotRepository
                .findByInventory_Company_IdAndItem_WorkerLevel(companyId, currentLevel)
                .stream()
                .filter(s -> !s.isEquipped())
                .toList();

        long totalWorkers = workerSlots.stream().mapToLong(InventorySlot::getQuantity).sum();
        if (totalWorkers < 2) {
            throw new IllegalStateException("동일 레벨 일꾼이 2개 이상 필요합니다. (현재 " + totalWorkers + "개)");
        }

        // 일꾼 2개 소모
        consumeWorkers(workerSlots, 2);

        // 강화 결과 계산
        UpgradeResult result = rollUpgrade(currentLevel);
        int newLevel = calculateNewLevel(currentLevel, result);

        // 결과 일꾼 지급 (reset이면 지급 없음)
        if (result != UpgradeResult.reset) {
            grantWorker(companyId, newLevel);
        }

        return new WorkerUpgradeResponse(result, newLevel);
    }

    private void consumeWorkers(List<InventorySlot> slots, int count) {
        int remaining = count;
        for (InventorySlot slot : slots) {
            if (remaining <= 0) break;
            long qty = slot.getQuantity();
            long take = Math.min(qty, remaining);
            long left = qty - take;
            if (left == 0) slot.clearSlot();
            else slot.setItemAndQuantity(slot.getItem(), left);
            remaining -= (int) take;
        }
    }

    private void grantWorker(Long companyId, int level) {
        Item workerItem = itemRepository.findByWorkerLevel(level)
                .orElseThrow(() -> new IllegalStateException("레벨 " + level + " 일꾼 아이템이 존재하지 않습니다."));
        inventoryService.addItem(companyId, workerItem.getId(), 1L);
    }

    private UpgradeResult rollUpgrade(int level) {
        double[] probs = UPGRADE_PROBS[level - 1];
        double rand = Math.random();
        if (rand < probs[0]) return UpgradeResult.success;
        if (rand < probs[0] + probs[1]) return UpgradeResult.stay;
        if (rand < probs[0] + probs[1] + probs[2]) return UpgradeResult.down;
        return UpgradeResult.reset;
    }

    private int calculateNewLevel(int currentLevel, UpgradeResult result) {
        return switch (result) {
            case success -> currentLevel + 1;
            case stay    -> currentLevel;
            case down    -> Math.max(1, currentLevel - 1);
            case reset   -> 0; // 소멸
        };
    }
}
