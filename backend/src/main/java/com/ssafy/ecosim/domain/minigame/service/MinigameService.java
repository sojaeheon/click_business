package com.ssafy.ecosim.domain.minigame.service;

import com.ssafy.ecosim.domain.inventory.service.InventoryService;
import com.ssafy.ecosim.domain.item.entity.Item;
import com.ssafy.ecosim.domain.item.repository.ItemRepository;
import com.ssafy.ecosim.domain.minigame.dto.MinigameClaimResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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
     * 예) weights = { "초보 일꾼": 59.5, "견습 일꾼": 10.0, ... }
     *     totalWeight = 100.0
     *     rand = 0 ~ 100 사이 난수
     *     누적합이 rand를 초과하는 첫 번째 항목을 반환
     */
    private String pickItemName() {
        Map<String, Double> weights = rewardProperties.getRewardWeights();

        // Map → 순서 보장 리스트로 변환
        List<Map.Entry<String, Double>> entries = new ArrayList<>(weights.entrySet());

        double total = entries.stream().mapToDouble(Map.Entry::getValue).sum();
        double rand = random.nextDouble() * total;

        double cumulative = 0.0;
        for (Map.Entry<String, Double> entry : entries) {
            cumulative += entry.getValue();
            if (rand < cumulative) {
                return entry.getKey();
            }
        }

        // 부동소수점 오차 보정: 마지막 항목 반환
        return entries.get(entries.size() - 1).getKey();
    }

    // ──────────────────────────────────────────────────────────────────────
    // application.yml 바인딩용 내부 설정 클래스
    // ──────────────────────────────────────────────────────────────────────
    @Component
    @ConfigurationProperties(prefix = "minigame")
    @lombok.Getter
    @lombok.Setter
    public static class MinigameRewardProperties {

        /**
         * 아이템 이름 → 가중치 매핑
         * application.yml의 minigame.reward-weights 섹션과 연결됩니다.
         */
        private Map<String, Double> rewardWeights = new java.util.LinkedHashMap<>();
    }
}
