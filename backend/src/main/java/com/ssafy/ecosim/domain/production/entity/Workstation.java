package com.ssafy.ecosim.domain.production.entity;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.inventory.entity.EquipmentInventory;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "workstation")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Workstation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "workstation_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "equipment_inventory_id")
    private EquipmentInventory equipmentInventory; // 장착된 장비 (null 가능)

    @Column(name = "workstation_level", nullable = false)
    private Integer workstationLevel;

    @Column(name = "last_tick_time")
    private LocalDateTime lastTickTime;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive;

    @Column(name = "reserved_quantity", nullable = false)
    private Long reservedQuantity; // 예약된 재료량

    @Column(name = "produced_quantity", nullable = false)
    private Long producedQuantity; // 생산 완료된 결과물량

    @Builder
    public Workstation(Company company, Integer workstationLevel) {
        this.company = company;
        this.workstationLevel = workstationLevel;
        this.isActive = false;
        this.lastTickTime = LocalDateTime.now();
        this.reservedQuantity = 0L;
        this.producedQuantity = 0L;
    }

    public void addReservedQuantity(Long amount) {
        this.reservedQuantity += amount;
    }

    public void consumeReservedQuantity(Long amount) {
        if (this.reservedQuantity < amount) {
            throw new IllegalStateException("예약된 재료가 부족합니다.");
        }
        this.reservedQuantity -= amount;
    }

    public void addProducedQuantity(Long amount) {
        this.producedQuantity += amount;
    }

    public void clearProducedQuantity() {
        this.producedQuantity = 0L;
    }

    public void equipEquipment(EquipmentInventory equipmentInventory) {
        this.equipmentInventory = equipmentInventory;
        equipmentInventory.equip();
    }

    public void unequipEquipment() {
        if (this.equipmentInventory != null) {
            this.equipmentInventory.unequip();
            this.equipmentInventory = null;
        }
    }

    public void toggleActive() {
        this.isActive = !this.isActive;
        if (this.isActive) {
            // 가동을 시작할 때, 이전의 밀린 시간을 계산하지 않도록 초기화
            this.lastTickTime = LocalDateTime.now();
        }
    }

    public void updateLastTickTime(LocalDateTime time) {
        this.lastTickTime = time;
    }
}
