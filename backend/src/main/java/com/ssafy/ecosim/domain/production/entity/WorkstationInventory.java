package com.ssafy.ecosim.domain.production.entity;

import com.ssafy.ecosim.domain.item.entity.Item;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "workstation_inventory")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WorkstationInventory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "workstation_inventory_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workstation_id", nullable = false)
    private Workstation workstation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_id")
    private Item item;

    @Column(nullable = false)
    private Long quantity;


    @Builder
    public WorkstationInventory(Workstation workstation) {
        this.workstation = workstation;
        this.quantity = 0L;
    }

    public void addMaterial(Item inputItem, Long amount) {
        if (this.item == null) {
            this.item = inputItem;
        } else if (!this.item.getId().equals(inputItem.getId())) {
            throw new IllegalArgumentException("다른 종류의 아이템을 추가할 수 없습니다.");
        }
        this.quantity += amount;
    }

    public void consumeMaterial(Long amount) {
        if (this.quantity < amount) {
            throw new IllegalStateException("재고가 부족합니다.");
        }
        this.quantity -= amount;
        if (this.quantity == 0) {
            this.item = null;
        }
    }
}
