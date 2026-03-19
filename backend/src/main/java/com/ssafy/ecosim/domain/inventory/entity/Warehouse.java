package com.ssafy.ecosim.domain.inventory.entity;

import com.ssafy.ecosim.domain.company.entity.Company;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "warehouse")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Warehouse {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "warehouse_id")
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id", nullable = false, unique = true)
    private Company company;

    @Column(name = "max_slot", nullable = false)
    private Integer maxSlot;

    @OneToMany(mappedBy = "warehouse", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<WarehouseSlot> slots = new ArrayList<>();

    public Warehouse(Company company, Integer initialMaxSlot) {
        this.company = company;
        this.maxSlot = initialMaxSlot;
    }

    public void expandSlots(Integer amount, Integer maxLimit) {
        if (this.maxSlot + amount > maxLimit) {
            throw new IllegalArgumentException("창고의 최대 확장 한도를 초과할 수 없습니다.");
        }
        this.maxSlot += amount;
    }
}
