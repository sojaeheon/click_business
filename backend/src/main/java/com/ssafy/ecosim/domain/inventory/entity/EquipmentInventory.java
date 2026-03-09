package com.ssafy.ecosim.domain.inventory.entity;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.item.entity.Item;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "equipment_inventory")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EquipmentInventory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "equipment_inventory_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_id", nullable = false)
    private Item item;

    @Column(nullable = false)
    private Integer level;

    @Column(name = "is_equipped", nullable = false)
    private Boolean isEquipped;

    @Column(name = "slot_index", nullable = false)
    private Integer slotIndex;

    @Column(name = "max_slot", nullable = false)
    private Integer maxSlot;

    @Builder
    public EquipmentInventory(Company company, Item item, Integer level, Integer slotIndex,
            Integer maxSlot) {
        this.company = company;
        this.item = item;
        this.level = level;
        this.isEquipped = false;
        this.slotIndex = slotIndex;
        this.maxSlot = maxSlot;
    }

    public void equip() {
        this.isEquipped = true;
    }

    public void unequip() {
        this.isEquipped = false;
    }
}
