package com.ssafy.ecosim.domain.minigame.service;

import com.ssafy.ecosim.domain.inventory.service.InventoryService;
import com.ssafy.ecosim.domain.item.entity.Item;
import com.ssafy.ecosim.domain.item.repository.ItemRepository;
import com.ssafy.ecosim.domain.minigame.dto.MinigameClaimResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Random;

@Service
@RequiredArgsConstructor
public class MinigameService {

    private final ItemRepository itemRepository;
    private final InventoryService inventoryService;
    private final MinigameRewardProperties rewardProperties;

    private final Random random = new Random();

    /**
     * 보상 수령:
     * 1) application.yml의 가중치로 아이템 이름을 랜덤 선택
     * 2) 해당 아이템을 DB에서 조회
     * 3) InventoryService.addItem()으로 인벤토리 슬롯에 저장
     * 4) 획득한 아이템 정보 반환
     */
    @Transactional
    public MinigameClaimResponse claimReward(Long companyId) {
        String pickedName = pickItemName();

        Item item = itemRepository.findByName(pickedName)
                .orElseThrow(() -> new IllegalStateException(
                        "보상 아이템을 찾을 수 없습니다: " + pickedName
                                + " (DataInitializer가 실행되었는지 확인하세요)"));

        inventoryService.addItem(companyId, item.getId(), 1L);

        return new MinigameClaimResponse(item);
    }

    /**
     * 가중치 기반 랜덤 아이템 이름 선택.
     *
     * 예) rewards = [{ itemName: "초보 일꾼", weight: 59.5 }, ...]
     *     totalWeight = 100.0
     *     rand = 0 ~ 100 사이 난수
     *     누적합이 rand를 초과하는 첫 번째 항목을 반환
     */
    private String pickItemName() {
        List<MinigameRewardProperties.RewardEntry> rewards = rewardProperties.getRewards();

        if (rewards.isEmpty()) {
            throw new IllegalStateException("보상 목록이 비어 있습니다. application.yml의 minigame.rewards 설정을 확인하세요.");
        }

        double total = rewards.stream().mapToDouble(MinigameRewardProperties.RewardEntry::getWeight).sum();
        double rand = random.nextDouble() * total;

        double cumulative = 0.0;
        for (MinigameRewardProperties.RewardEntry entry : rewards) {
            cumulative += entry.getWeight();
            if (rand < cumulative) {
                return entry.getItemName();
            }
        }

        // 부동소수점 오차 보정: 마지막 항목 반환
        return rewards.get(rewards.size() - 1).getItemName();
    }
}
