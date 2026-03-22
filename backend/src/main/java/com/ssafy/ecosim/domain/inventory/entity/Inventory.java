package com.ssafy.ecosim.domain.inventory.entity;

import com.ssafy.ecosim.domain.company.entity.Company;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "inventory")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Inventory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "inventory_id")
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id", nullable = false, unique = true)
    private Company company;

    @Column(name = "max_slot", nullable = false)
    private Integer maxSlot;

    @OneToMany(mappedBy = "inventory", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<InventorySlot> slots = new ArrayList<>();

    public Inventory(Company company, Integer initialMaxSlot) {
        this.company = company;
        this.maxSlot = initialMaxSlot;
    }

    public void expandSlots(Integer amount) {
        this.maxSlot += amount;
    }
}
