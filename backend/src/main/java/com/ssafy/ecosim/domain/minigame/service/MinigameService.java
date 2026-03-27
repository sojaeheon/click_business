package com.ssafy.ecosim.domain.minigame.service;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.company.repository.CompanyRepository;
import com.ssafy.ecosim.domain.inventory.service.InventoryService;
import com.ssafy.ecosim.domain.item.entity.Item;
import com.ssafy.ecosim.domain.item.repository.ItemRepository;
import com.ssafy.ecosim.domain.minigame.dto.MinigameClaimResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ssafy.ecosim.global.kafka.publisher.CompanyCashEventPublisher;

import java.time.Instant;
import java.util.List;
import java.util.Random;

@Service
@RequiredArgsConstructor
public class MinigameService {

    private final ItemRepository itemRepository;
    private final InventoryService inventoryService;
    private final MinigameRewardProperties rewardProperties;
    private final CompanyRepository companyRepository;
    private final CompanyCashEventPublisher companyCashEventPublisher;


    private final Random random = new Random();
    private static final long MINIGAME_COST = 100000L; // 미니게임 비용

    public long getMinigameCost() {
        return MINIGAME_COST;
    }

    /**
     * 보상 수령:
     * 1) 미니게임 비용(100,000원) 차감
     * 2) application.yml의 가중치로 아이템 이름을 랜덤 선택
     * 3) 해당 아이템을 DB에서 조회
     * 4) InventoryService.addItem()으로 인벤토리 슬롯에 저장
     * 5) 획득한 아이템 정보 반환
     */
    /**
     * 미니게임 플레이 가능 여부 확인
     */
    public void checkPlayable(Company company) {
        // 1. 인벤토리 공간 확인
        if (!inventoryService.hasSpace(company.getId())) {
            throw new IllegalStateException("인벤토리가 가득 찼습니다. 먼저 공간을 비워주세요.");
        }
    }

    /**
     * 현금 잔액 확인
     */
    public void checkAffordable(Company company) {
        if (company.getCash() < MINIGAME_COST) {
            throw new IllegalStateException("잔액이 부족합니다. 필요 금액: " + MINIGAME_COST + "원");
        }
    }

    /**
     * 미니게임 시작 (비용 차감)
     */
    @Transactional
    public void start(Company company) {
        // 검증
        checkPlayable(company);
        checkAffordable(company);

        // 비용 차감 및 상태 저장
        company.spendCash(MINIGAME_COST);
        company.setMinigamePaid(true);
        companyRepository.save(company);
        companyCashEventPublisher.publishCashChanged(
            company.getId(),
            company.getCash(),           // 변경 후 잔액
            -MINIGAME_COST,              // 변화량(차감)
            "MINIGAME_START",
            null,                        // reference_id(optional)
            Instant.now()
        );
    }

    @Transactional
    public MinigameClaimResponse claimReward(Company company) {
        // 1. 지불 여부 확인
        if (!company.isMinigamePaid()) {
            throw new IllegalStateException("미니게임 비용이 지불되지 않았습니다.");
        }

        // 2. 인벤토리 공간 재확인 (보상 지급 전)
        checkPlayable(company);

        // 3. 지불 상태 초기화 및 저장
        company.setMinigamePaid(false);
        companyRepository.save(company);

        // 4. 랜덤 아이템 선택
        String pickedName = pickItemName();

        Item item = itemRepository.findByName(pickedName)
                .orElseThrow(() -> new IllegalStateException(
                        "보상 아이템을 찾을 수 없습니다: " + pickedName
                                + " (DataInitializer가 실행되었는지 확인하세요)"));

        // 5. 인벤토리에 아이템 추가
        inventoryService.addItem(company.getId(), item.getId(), 1L);

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
