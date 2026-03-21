package com.ssafy.ecosim.domain.minigame.service;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * application.yml의 minigame.rewards 목록을 바인딩합니다.
 *
 * 예시:
 *   minigame:
 *     rewards:
 *       - item-name: "초보 일꾼"
 *         weight: 59.5
 */
@Component
@ConfigurationProperties(prefix = "minigame")
public class MinigameRewardProperties {

    private List<RewardEntry> rewards = new ArrayList<>();

    public List<RewardEntry> getRewards() {
        return rewards;
    }

    public void setRewards(List<RewardEntry> rewards) {
        this.rewards = rewards;
    }

    public static class RewardEntry {

        private String itemName;
        private double weight;

        public String getItemName() {
            return itemName;
        }

        public void setItemName(String itemName) {
            this.itemName = itemName;
        }

        public double getWeight() {
            return weight;
        }

        public void setWeight(double weight) {
            this.weight = weight;
        }
    }
}
